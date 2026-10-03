from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.app.database.session import get_db
from backend.app.database.models import Lecture, Course, User
from backend.app.schemas.courses import LectureCreate, LectureOut, LectureBase
from backend.app.api.deps import get_current_user, get_current_teacher, ensure_course_owner, ensure_lecture_owner

router = APIRouter(prefix="/lectures", tags=["Lectures"])

@router.get("", response_model=List[LectureOut])
def get_lectures(course_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Lecture)
    if course_id:
        query = query.filter(Lecture.course_id == course_id)
    return query.order_by(Lecture.id.asc()).all()

@router.get("/{lecture_id}", response_model=LectureOut)
def get_lecture(lecture_id: int, db: Session = Depends(get_db)):
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    return lecture

@router.post("", response_model=LectureOut, status_code=status.HTTP_201_CREATED)
def create_lecture(
    data: LectureCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    course = db.query(Course).filter(Course.id == data.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    ensure_course_owner(course, current_user)

    lecture = Lecture(
        course_id=data.course_id,
        title=data.title,
        video_url=data.video_url,
        duration_seconds=data.duration_seconds
    )
    db.add(lecture)
    db.commit()
    db.refresh(lecture)
    return lecture

@router.put("/{lecture_id}", response_model=LectureOut)
def update_lecture(
    lecture_id: int,
    data: LectureBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    ensure_lecture_owner(db, lecture, current_user)

    lecture.title = data.title
    lecture.video_url = data.video_url
    lecture.duration_seconds = data.duration_seconds
    db.commit()
    db.refresh(lecture)
    return lecture

@router.delete("/{lecture_id}")
def delete_lecture(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    ensure_lecture_owner(db, lecture, current_user)
    db.delete(lecture)
    db.commit()
    return {"status": "success", "message": "Lecture deleted"}
