from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from backend.app.database.session import get_db
from backend.app.database.models import Topic, User
from backend.app.api.deps import get_current_user
from backend.app.services.learning import (
    recompute_topic_difficulty, student_topic_difficulties, serialize_difficulty
)
from ml.difficulty_engine import DifficultyEngine

router = APIRouter(prefix="/difficulty", tags=["Difficulty Engine"])

class DifficultyCalculateRequest(BaseModel):
    engagement_score: Optional[float] = Field(default=None, ge=0, le=100)
    quiz_score: Optional[float] = Field(default=None, ge=0, le=100)
    replay_count: int = Field(default=0, ge=0)
    pause_count: int = Field(default=0, ge=0)
    watch_time_ratio: Optional[float] = Field(default=1.0, ge=0)

@router.post("/calculate")
def calculate_difficulty(
    data: DifficultyCalculateRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Stateless what-if calculator for the difficulty formula. Nothing is saved:
    stored scores are only ever derived from recorded activity (see /difficulty/recompute).
    """
    score, label = DifficultyEngine.calculate_difficulty(
        engagement_score=data.engagement_score,
        quiz_score=data.quiz_score,
        replay_count=data.replay_count,
        pause_count=data.pause_count,
        watch_time_ratio=data.watch_time_ratio
    )
    return {
        "difficulty_score": score,
        "difficulty_label": label,
        "color": DifficultyEngine.get_difficulty_color(label)
    }

@router.get("/topics")
def get_my_topic_difficulties(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return student_topic_difficulties(db, current_user.id)

@router.post("/recompute/{topic_id}")
def recompute_my_topic_difficulty(
    topic_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    record = recompute_topic_difficulty(db, current_user.id, topic)
    if record is None:
        raise HTTPException(status_code=404, detail="No recorded activity for this topic yet")
    return serialize_difficulty(record, topic, topic.lecture)
