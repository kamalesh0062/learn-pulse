from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from jose import jwt, JWTError
import hashlib
import hmac
import secrets
from backend.app.core.config import settings

PBKDF2_ALGORITHM = "pbkdf2_sha256"
PBKDF2_ITERATIONS = 310_000
LEGACY_SALT = "learnpulse_salt_2026"

def hash_password(password: str) -> str:
    """PBKDF2-HMAC-SHA256 with a random per-user salt."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS)
    return f"{PBKDF2_ALGORITHM}${PBKDF2_ITERATIONS}${salt}${digest.hex()}"

def _legacy_hash(password: str) -> str:
    return hashlib.sha256((password + LEGACY_SALT).encode("utf-8")).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password hash. Accepts legacy static-salt SHA-256 hashes so existing accounts keep working."""
    if not hashed_password:
        return False
    if hashed_password.startswith(f"{PBKDF2_ALGORITHM}$"):
        try:
            _, iterations, salt, expected = hashed_password.split("$")
            digest = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), int(iterations))
        except ValueError:
            return False
        return hmac.compare_digest(digest.hex(), expected)
    return hmac.compare_digest(_legacy_hash(plain_password), hashed_password)

def needs_rehash(hashed_password: str) -> bool:
    """True for legacy hashes that should be upgraded on the next successful login."""
    return not hashed_password.startswith(f"{PBKDF2_ALGORITHM}${PBKDF2_ITERATIONS}$")

def create_access_token(subject: Any, role: str, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "role": role
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None
