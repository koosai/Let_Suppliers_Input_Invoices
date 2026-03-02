import os

import bcrypt
from fastapi import Cookie, HTTPException, status
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

COOKIE_NAME = "admin_session"
SESSION_MAX_AGE = 8 * 60 * 60


def _get_serializer() -> URLSafeTimedSerializer:
    secret = os.getenv("SESSION_SECRET", "change-this-secret")
    return URLSafeTimedSerializer(secret_key=secret, salt="admin-session")


def verify_admin_credentials(username: str, password: str) -> bool:
    expected_user = os.getenv("ADMIN_USERNAME")
    expected_hash = os.getenv("ADMIN_PASSWORD_HASH")
    if not expected_user or not expected_hash:
        return False
    if username != expected_user:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), expected_hash.encode("utf-8"))
    except ValueError:
        return False


def create_session_token(username: str) -> str:
    return _get_serializer().dumps({"username": username})


def verify_session_token(token: str) -> bool:
    try:
        _get_serializer().loads(token, max_age=SESSION_MAX_AGE)
        return True
    except (BadSignature, SignatureExpired):
        return False


def require_admin_session(admin_session: str | None = Cookie(default=None)) -> None:
    if not admin_session or not verify_session_token(admin_session):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
