from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any

VIDEO_EVENT_TYPES = ["PLAY", "PAUSE", "SEEK", "REPLAY", "COMPLETE"]

class VideoEventLog(BaseModel):
    lecture_id: int
    event_type: str # PLAY, PAUSE, SEEK, REPLAY, COMPLETE
    position_seconds: int = Field(default=0, ge=0)

    @field_validator('event_type')
    def validate_event_type(cls, v):
        v = v.upper()
        if v not in VIDEO_EVENT_TYPES:
            raise ValueError(f"event_type must be one of {VIDEO_EVENT_TYPES}")
        return v

class EngagementMetrics(BaseModel):
    pitch: float = Field(default=0.0, ge=-90.0, le=90.0)
    yaw: float = Field(default=0.0, ge=-90.0, le=90.0)
    roll: float = Field(default=0.0, ge=-90.0, le=90.0)
    ear: float = Field(default=0.30, ge=0.0, le=1.0)
    gaze_offset: float = Field(default=0.0, ge=0.0, le=2.0)
    face_detected: bool = True

class EngagementEventCreate(BaseModel):
    lecture_id: int
    topic_id: Optional[int] = None
    timestamp: Optional[str] = None
    timestamp_seconds: Optional[float] = 0.0
    state: str = Field(..., description="Focused, Distracted, Low Engagement, Away")
    confidence: float = Field(default=0.95, ge=0.0, le=100.0)
    metrics: Optional[EngagementMetrics] = None

    @field_validator('state')
    def validate_state(cls, v):
        valid_states = ["Focused", "Distracted", "Low Engagement", "Away"]
        if v not in valid_states:
            raise ValueError(f"State must be one of {valid_states}")
        return v

class EngagementEventResponse(BaseModel):
    status: str
    id: Optional[int] = None
    focus_state: str
    confidence: float
    topic_id: Optional[int] = None
    difficulty_score: Optional[float] = None
    difficulty_label: Optional[str] = None
    message: str = "Event recorded successfully"

class EngagementPredictRequest(BaseModel):
    pitch: float = 0.0
    yaw: float = 0.0
    roll: float = 0.0
    ear: float = 0.30
    gaze_offset: float = 0.0
    face_detected: bool = True

class EngagementPredictResponse(BaseModel):
    focus_state: str
    confidence: float
    metrics: Dict[str, Any]

class FrameAnalysisRequest(BaseModel):
    image_base64: Optional[str] = None
    lecture_id: Optional[int] = None
    timestamp_seconds: Optional[float] = 0.0

class FrameAnalysisResponse(BaseModel):
    status: str
    focus_state: str # Focused, Distracted, Low Engagement, Away
    confidence: float
    metrics: Dict[str, Any]
