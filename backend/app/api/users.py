from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List
from backend.app.database.session import get_db
from backend.app.database.models import (
    User, Course, QuizResult, VideoEvent, EngagementLog, DifficultyScore, Notification, AuditLog
)
from backend.app.schemas.auth import UserOut
from backend.app.api.deps import get_current_user, get_current_admin

router = APIRouter(prefix="/users", tags=["Users"])

VALID_ROLES = ["student", "teacher", "admin"]

class RoleUpdate(BaseModel):
    role: str

@router.get("", response_model=List[UserOut])
def get_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    return db.query(User).order_by(User.id.asc()).all()

@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if user_id != current_user.id and current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="You can only view your own profile")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: int,
    data: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    role = data.role.lower()
    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Role must be one of {VALID_ROLES}")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot change your own role")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    previous = user.role
    user.role = role
    db.add(AuditLog(user_id=current_user.id, action="USER_ROLE_CHANGED", details=f"{user.email}: {previous} -> {role}"))
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if db.query(Course).filter(Course.teacher_id == user_id).count() > 0:
        raise HTTPException(status_code=409, detail="This teacher still owns courses. Delete or reassign them first.")

    # SQLite does not enforce ON DELETE CASCADE by default, so remove the user's activity explicitly
    for model, column in [
        (QuizResult, QuizResult.student_id),
        (VideoEvent, VideoEvent.student_id),
        (EngagementLog, EngagementLog.student_id),
        (DifficultyScore, DifficultyScore.student_id),
        (Notification, Notification.user_id),
    ]:
        db.query(model).filter(column == user_id).delete()

    email = user.email
    db.delete(user)
    db.add(AuditLog(user_id=current_user.id, action="USER_DELETED", details=f"Deleted account {email}"))
    db.commit()
    return {"status": "success", "message": "User deleted"}
