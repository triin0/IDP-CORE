"""Identity Forgery Elimination — JWT-based WebSocket authentication.

Generates HS256 signed JWTs for WebSocket session authentication.
Every presence connection must present a valid token. Forged, expired,
or mismatched tokens trigger immediate connection severance (1008).
"""
import os
import time
import uuid
import jwt
import logging

logger = logging.getLogger("security")

JWT_SECRET = os.getenv("SHOWROOM_JWT_SECRET", "sovereign-showroom-secret-" + str(uuid.uuid4())[:8])
JWT_ALGORITHM = "HS256"
TOKEN_TTL_SECONDS = 3600


def create_session_token(user_id: str) -> dict:
    session_id = str(uuid.uuid4())
    now = time.time()
    payload = {
        "sub": user_id,
        "sid": session_id,
        "iat": int(now),
        "exp": int(now + TOKEN_TTL_SECONDS),
        "iss": "sovereign-showroom",
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return {
        "token": token,
        "sessionId": session_id,
        "userId": user_id,
        "expiresAt": int(now + TOKEN_TTL_SECONDS),
    }


def verify_token(token: str, expected_user_id: str | None = None) -> dict:
    try:
        decoded = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "sid", "iat", "exp", "iss"]},
        )
    except jwt.ExpiredSignatureError:
        raise TokenError("Token expired", code="TOKEN_EXPIRED")
    except jwt.InvalidTokenError as e:
        raise TokenError(f"Invalid token: {e}", code="TOKEN_INVALID")

    if decoded.get("iss") != "sovereign-showroom":
        raise TokenError("Invalid issuer", code="TOKEN_INVALID_ISSUER")

    if expected_user_id is not None and decoded.get("sub") != expected_user_id:
        raise TokenError(
            f"User ID mismatch: token claims '{decoded.get('sub')}' but URL says '{expected_user_id}'",
            code="TOKEN_USER_MISMATCH",
        )

    return decoded


class TokenError(Exception):
    def __init__(self, message: str, code: str = "TOKEN_ERROR"):
        super().__init__(message)
        self.code = code
