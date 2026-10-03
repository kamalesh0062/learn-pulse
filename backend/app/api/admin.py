import os
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.database.session import get_db
from backend.app.database.models import User, Course, Lecture, Topic, Quiz, EngagementLog, AuditLog
from backend.app.api.deps import get_current_admin
from backend.app.core.config import settings, DB_PATH, ML_DIR

router = APIRouter(prefix="/admin", tags=["System Administration"])

@router.get("/status")
def get_system_status(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    teacher_count = db.query(User).filter(User.role == "teacher").count()
    student_count = db.query(User).filter(User.role == "student").count()
    course_count = db.query(Course).count()
    lecture_count = db.query(Lecture).count()
    topic_count = db.query(Topic).count()
    quiz_count = db.query(Quiz).count()
    log_count = db.query(EngagementLog).count()
    admin_count = db.query(User).filter(User.role == "admin").count()

    predictor = getattr(request.app.state, "predictor", None)
    model_loaded = predictor is not None and predictor.model is not None
    try:
        from computer_vision.mediapipe_detector import MEDIAPIPE_AVAILABLE
    except Exception:
        MEDIAPIPE_AVAILABLE = False
    ai_provider = "gemini" if settings.GEMINI_API_KEY else ("openai" if settings.OPENAI_API_KEY else "local")

    db_size_kb = round(os.path.getsize(DB_PATH) / 1024, 1) if os.path.exists(DB_PATH) else 0.0
    model_path = ML_DIR / "random_forest.pkl"

    audits = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(20).all()
    audit_list = [
        {"id": a.id, "user_id": a.user_id, "action": a.action, "details": a.details, "timestamp": a.timestamp.isoformat() if a.timestamp else None}
        for a in audits
    ]

    return {
        "status": "healthy",
        "version": settings.VERSION,
        "database": {
            "path": str(DB_PATH),
            "size_kb": db_size_kb,
            "teacher_count": teacher_count,
            "student_count": student_count,
            "admin_count": admin_count,
            "course_count": course_count,
            "lecture_count": lecture_count,
            "topic_count": topic_count,
            "quiz_count": quiz_count,
            "engagement_logs": log_count
        },
        "ml_engine": {
            "model_path": str(model_path),
            "model_file_exists": os.path.exists(model_path),
            "model_loaded": model_loaded,
            "classifier": "Random Forest" if model_loaded else "Rule-based fallback",
            "cv_detector": "MediaPipe FaceLandmarker (browser, WebAssembly)",
            "server_mediapipe_available": MEDIAPIPE_AVAILABLE
        },
        "ai_provider": {
            "gemini_active": bool(settings.GEMINI_API_KEY),
            "openai_active": bool(settings.OPENAI_API_KEY),
            "active_provider": ai_provider,
            "fallback_active": ai_provider == "local"
        },
        "audit_logs": audit_list
    }
