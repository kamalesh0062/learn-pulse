from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.app.database.session import get_db
from backend.app.database.models import Topic, Lecture, User
from backend.app.schemas.courses import TopicCreate, TopicOut, TopicBase
from backend.app.api.deps import get_current_user, get_current_teacher, ensure_lecture_owner, ensure_topic_owner

router = APIRouter(prefix="/topics", tags=["Topics"])

def _validate_time_range(start_time: int, end_time: int) -> None:
    if start_time < 0 or end_time <= start_time:
        raise HTTPException(status_code=400, detail="end_time must be greater than start_time, and both must be non-negative")

@router.get("", response_model=List[TopicOut])
def get_topics(lecture_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Topic)
    if lecture_id:
        query = query.filter(Topic.lecture_id == lecture_id)
    return query.order_by(Topic.start_time.asc()).all()

@router.get("/{topic_id}", response_model=TopicOut)
def get_topic(topic_id: int, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic

@router.post("", response_model=TopicOut, status_code=status.HTTP_201_CREATED)
def create_topic(
    data: TopicCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    lecture = db.query(Lecture).filter(Lecture.id == data.lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    ensure_lecture_owner(db, lecture, current_user)
    _validate_time_range(data.start_time, data.end_time)

    topic = Topic(
        lecture_id=data.lecture_id,
        title=data.title,
        start_time=data.start_time,
        end_time=data.end_time,
        description=data.description
    )
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return topic

@router.put("/{topic_id}", response_model=TopicOut)
def update_topic(
    topic_id: int,
    data: TopicBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    ensure_topic_owner(db, topic, current_user)
    _validate_time_range(data.start_time, data.end_time)

    topic.title = data.title
    topic.start_time = data.start_time
    topic.end_time = data.end_time
    topic.description = data.description
    db.commit()
    db.refresh(topic)
    return topic

@router.delete("/{topic_id}")
def delete_topic(
    topic_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    ensure_topic_owner(db, topic, current_user)
    db.delete(topic)
    db.commit()
    return {"status": "success", "message": "Topic deleted"}
