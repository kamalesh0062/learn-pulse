from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from backend.app.database.session import get_db
from backend.app.database.models import Course, Lecture, Topic, User
from backend.app.schemas.courses import CourseCreate, CourseOut, CourseBase
from backend.app.api.deps import get_current_user, get_current_teacher, ensure_course_owner

router = APIRouter(prefix="/courses", tags=["Courses"])

@router.get("", response_model=List[CourseOut])
def get_courses(db: Session = Depends(get_db)):
    courses = db.query(Course).order_by(Course.created_at.desc()).all()
    return courses

@router.get("/{course_id}", response_model=CourseOut)
def get_course(course_id: int, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course

@router.post("", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
def create_course(
    data: CourseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    teacher_id = current_user.id if current_user.role == "teacher" else (data.teacher_id or current_user.id)
    course = Course(
        teacher_id=teacher_id,
        title=data.title,
        course_code=data.course_code,
        description=data.description
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course

@router.put("/{course_id}", response_model=CourseOut)
def update_course(
    course_id: int,
    data: CourseBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    ensure_course_owner(course, current_user)

    course.title = data.title
    course.course_code = data.course_code
    course.description = data.description
    db.commit()
    db.refresh(course)
    return course

@router.delete("/{course_id}")
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    ensure_course_owner(course, current_user)
    db.delete(course)
    db.commit()
    return {"status": "success", "message": "Course deleted"}
