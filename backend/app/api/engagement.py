import base64
import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database.session import get_db
from backend.app.database.models import EngagementLog, VideoEvent, User, Lecture, Topic
from backend.app.schemas.engagement import (
    VideoEventLog, FrameAnalysisRequest, FrameAnalysisResponse,
    EngagementEventCreate, EngagementEventResponse,
    EngagementPredictRequest, EngagementPredictResponse
)
from backend.app.api.deps import get_current_user
from backend.app.services.learning import recompute_topic_difficulty, topic_for_position
from computer_vision.mediapipe_detector import MediaPipeDetector
from ml.predict import EngagementPredictor

router = APIRouter(prefix="/engagement", tags=["Engagement & Computer Vision"])

detector = MediaPipeDetector()
predictor = EngagementPredictor()

CONSENT_ERROR = "Camera analytics consent has not been granted for this account."

@router.post("/events", response_model=EngagementEventResponse, status_code=status.HTTP_201_CREATED)
def record_engagement_event(
    data: EngagementEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Receives privacy-first aggregated numerical engagement metrics from the React browser.
    Validates authenticated student, lecture, and topic IDs, and persists engagement log to DB.
    """
    if not current_user.camera_consent:
        raise HTTPException(status_code=403, detail=CONSENT_ERROR)

    # Validate Lecture ID
    lecture = db.query(Lecture).filter(Lecture.id == data.lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail=f"Lecture with ID {data.lecture_id} not found.")

    # A client-supplied topic must belong to this lecture; otherwise resolve it from the timeline
    if data.topic_id:
        topic = db.query(Topic).filter(Topic.id == data.topic_id, Topic.lecture_id == data.lecture_id).first()
        if not topic:
            raise HTTPException(status_code=404, detail=f"Topic with ID {data.topic_id} not found in lecture {data.lecture_id}.")
    else:
        topic = topic_for_position(db, data.lecture_id, data.timestamp_seconds or 0.0)
    topic_id = topic.id if topic else None

    # Normalize metrics values
    pitch = data.metrics.pitch if data.metrics else 0.0
    yaw = data.metrics.yaw if data.metrics else 0.0
    roll = data.metrics.roll if data.metrics else 0.0
    ear = data.metrics.ear if data.metrics else 0.30
    gaze_offset = data.metrics.gaze_offset if data.metrics else 0.0

    # Normalize confidence to decimal (0.0 to 1.0)
    conf = data.confidence
    if conf > 1.0:
        conf = conf / 100.0
    conf = max(0.0, min(1.0, conf))

    # Save EngagementLog
    log = EngagementLog(
        student_id=current_user.id,
        lecture_id=data.lecture_id,
        topic_id=topic_id,
        timestamp_seconds=data.timestamp_seconds or 0.0,
        focus_state=data.state,
        pitch=pitch,
        yaw=yaw,
        roll=roll,
        ear=ear,
        gaze_offset=gaze_offset,
        confidence=conf
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    difficulty = recompute_topic_difficulty(db, current_user.id, topic) if topic else None

    return {
        "status": "success",
        "id": log.id,
        "focus_state": log.focus_state,
        "confidence": round(log.confidence * 100, 1),
        "topic_id": topic_id,
        "difficulty_score": difficulty.difficulty_score if difficulty else None,
        "difficulty_label": difficulty.difficulty_label if difficulty else None,
        "message": "Aggregated engagement event persisted successfully."
    }

@router.post("/predict", response_model=EngagementPredictResponse)
def predict_engagement_state(
    data: EngagementPredictRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Executes real Random Forest ML model classification from numerical metrics payload.
    Used when frontend requests server-side ML model inference without raw webcam frames.
    """
    metrics = {
        "pitch": data.pitch,
        "yaw": data.yaw,
        "roll": data.roll,
        "ear": data.ear,
        "gaze_offset": data.gaze_offset,
        "face_detected": data.face_detected
    }
    state, conf = predictor.predict_from_metrics(metrics)
    return {
        "focus_state": state,
        "confidence": round(conf * 100, 1),
        "metrics": metrics
    }

@router.post("/analyze_frame", response_model=FrameAnalysisResponse)
def analyze_frame(
    data: FrameAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Server-side alternative to browser inference: decodes a base64 JPEG frame in memory,
    computes MediaPipe facial landmarks, head pose and EAR, and returns the focus state.
    """
    if not data.image_base64:
        raise HTTPException(status_code=422, detail="image_base64 is required.")
    if not current_user.camera_consent:
        raise HTTPException(status_code=403, detail=CONSENT_ERROR)
    if not detector.mp_available:
        raise HTTPException(
            status_code=503,
            detail="Server-side MediaPipe is not installed. Use /engagement/predict with browser-computed metrics."
        )

    try:
        image_str = data.image_base64
        if "," in image_str:
            image_str = image_str.split(",")[1]
        nparr = np.frombuffer(base64.b64decode(image_str), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    except Exception:
        frame = None
    if frame is None:
        raise HTTPException(status_code=422, detail="image_base64 could not be decoded as an image.")

    # The frame only ever exists in memory for the duration of this request
    metrics = detector.process_frame(frame)
    state, conf = predictor.predict_from_metrics(metrics)

    if data.lecture_id:
        lecture = db.query(Lecture).filter(Lecture.id == data.lecture_id).first()
        if not lecture:
            raise HTTPException(status_code=404, detail=f"Lecture with ID {data.lecture_id} not found.")
        timestamp_sec = data.timestamp_seconds or 0.0
        topic = topic_for_position(db, lecture.id, timestamp_sec)
        db.add(EngagementLog(
            student_id=current_user.id,
            lecture_id=lecture.id,
            topic_id=topic.id if topic else None,
            timestamp_seconds=timestamp_sec,
            focus_state=state,
            pitch=float(metrics["pitch"]),
            yaw=float(metrics["yaw"]),
            roll=float(metrics["roll"]),
            ear=float(metrics["ear"]),
            gaze_offset=float(metrics.get("gaze_offset", 0.0)),
            confidence=float(conf)
        ))
        db.commit()
        if topic:
            recompute_topic_difficulty(db, current_user.id, topic)

    return {
        "status": "success",
        "focus_state": state,
        "confidence": round(conf * 100, 1),
        "metrics": {
            "pitch": round(metrics["pitch"], 1),
            "yaw": round(metrics["yaw"], 1),
            "roll": round(metrics["roll"], 1),
            "ear": round(metrics["ear"], 3),
            "gaze_offset": round(metrics.get("gaze_offset", 0.0), 2),
            "face_detected": metrics["face_detected"]
        }
    }

@router.post("/events/video")
def log_video_event(
    data: VideoEventLog,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lecture = db.query(Lecture).filter(Lecture.id == data.lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail=f"Lecture with ID {data.lecture_id} not found.")

    event = VideoEvent(
        student_id=current_user.id,
        lecture_id=data.lecture_id,
        event_type=data.event_type,
        position_seconds=data.position_seconds
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # Replays and pauses feed the difficulty score of the topic they happened in
    if data.event_type in ["REPLAY", "PAUSE"]:
        topic = topic_for_position(db, data.lecture_id, data.position_seconds)
        if topic:
            recompute_topic_difficulty(db, current_user.id, topic)

    return {"status": "recorded", "event_id": event.id}
