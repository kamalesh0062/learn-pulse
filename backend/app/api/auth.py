from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.database.models import User, AuditLog, Notification
from backend.app.schemas.auth import UserRegister, UserLogin, UserOut, Token, UserUpdate
from backend.app.core.security import hash_password, verify_password, needs_rehash, create_access_token
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

SELF_REGISTER_ROLES = ["student", "teacher"]

def _token_response(user: User) -> dict:
    return {
        "access_token": create_access_token(subject=user.id, role=user.role),
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "department": user.department,
            "enrollment_no": user.enrollment_no,
            "camera_consent": user.camera_consent
        }
    }

@router.post("/register", response_model=Token)
def register(data: UserRegister, db: Session = Depends(get_db)):
    role = data.role.lower()
    if role not in SELF_REGISTER_ROLES:
        raise HTTPException(status_code=403, detail="Only student and teacher accounts can be self-registered")
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    email = data.email.lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=data.name.strip(),
        email=email,
        password_hash=hash_password(data.password),
        role=role,
        department=data.department or ("Computer Science" if role == "teacher" else None),
        enrollment_no=data.enrollment_no or (f"ENR{db.query(User).count() + 1001}" if role == "student" else None),
        # Camera analytics is opt-in for newly registered accounts
        camera_consent=False
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    db.add(AuditLog(user_id=user.id, action="USER_REGISTERED", details=f"User registered with role {user.role}"))
    db.add(Notification(
        user_id=user.id,
        title="Welcome to LearnPulse AI",
        message="Your account is ready. Camera-based engagement analytics is off until you enable it in Privacy Controls."
    ))
    db.commit()

    return _token_response(user)

@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # The requested portal must match the account's role; the account's own role is always what gets issued
    if data.role and data.role.lower() != user.role:
        raise HTTPException(status_code=403, detail=f"This account is registered as {user.role}, not {data.role.lower()}")

    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(data.password)

    db.add(AuditLog(user_id=user.id, action="USER_LOGIN", details=f"{user.role.capitalize()} {user.email} logged in"))
    db.commit()

    return _token_response(user)

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=UserOut)
def update_me(data: UserUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if data.name:
        current_user.name = data.name.strip()
    if data.email and data.email.lower() != current_user.email:
        email = data.email.lower()
        if db.query(User).filter(User.email == email, User.id != current_user.id).first():
            raise HTTPException(status_code=400, detail="Email already registered")
        current_user.email = email
    if data.password:
        if len(data.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        current_user.password_hash = hash_password(data.password)
    if data.department is not None:
        current_user.department = data.department
    if data.camera_consent is not None and data.camera_consent != current_user.camera_consent:
        current_user.camera_consent = data.camera_consent
        db.add(AuditLog(
            user_id=current_user.id,
            action="CAMERA_CONSENT_UPDATED",
            details=f"Camera analytics consent set to {data.camera_consent}"
        ))

    db.commit()
    db.refresh(current_user)
    return current_user
