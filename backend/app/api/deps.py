from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.database.models import User, Course, Lecture, Topic
from backend.app.core.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_error

    payload = decode_token(token)
    if not payload or not payload.get("sub"):
        credentials_error.detail = "Could not validate credentials"
        raise credentials_error

    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        credentials_error.detail = "Could not validate credentials"
        raise credentials_error

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        credentials_error.detail = "User no longer exists"
        raise credentials_error

    return user

def get_current_teacher(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Teacher access required")
    return current_user

def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

def ensure_course_owner(course: Course, user: User) -> None:
    """Teachers may only modify their own courses; admins may modify any."""
    if user.role != "admin" and course.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="You can only modify your own courses")

def ensure_lecture_owner(db: Session, lecture: Lecture, user: User) -> None:
    course = db.query(Course).filter(Course.id == lecture.course_id).first()
    if course:
        ensure_course_owner(course, user)

def ensure_topic_owner(db: Session, topic: Topic, user: User) -> None:
    lecture = db.query(Lecture).filter(Lecture.id == topic.lecture_id).first()
    if lecture:
        ensure_lecture_owner(db, lecture, user)
