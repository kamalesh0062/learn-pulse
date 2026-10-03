from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.database.models import Notification, User
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])

def _serialize(n: Notification) -> dict:
    return {
        "id": n.id,
        "user_id": n.user_id,
        "title": n.title,
        "message": n.message,
        "read": bool(n.read),
        "created_at": n.created_at.isoformat() if n.created_at else None
    }

@router.get("")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notifs = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.id.desc()).limit(50).all()
    return [_serialize(n) for n in notifs]

@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    updated = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read == False  # noqa: E712
    ).update({Notification.read: True})
    db.commit()
    return {"status": "success", "updated": updated}

@router.post("/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notif = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == current_user.id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.read = True
    db.commit()
    return {"status": "success"}
