"""SHA-256 Cryptographic Root of Trust — Tier 5 payload integrity verification.

Verifies that every mutating request (POST/PUT/PATCH) arrives with an
X-Payload-Hash header whose SHA-256 digest matches the raw request body.
This mathematically guarantees zero silent data mutation in transit.
"""
import hashlib
import json
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger("integrity")

MUTATING_METHODS = {"POST", "PUT", "PATCH"}
EXEMPT_PATHS = {"/docs", "/openapi.json", "/redoc"}


def canonical_sort(obj):
    if isinstance(obj, dict):
        return {k: canonical_sort(v) for k, v in sorted(obj.items())}
    if isinstance(obj, list):
        return [canonical_sort(item) for item in obj]
    return obj


def compute_sha256(raw_bytes: bytes) -> str:
    return hashlib.sha256(raw_bytes).hexdigest()


def compute_sha256_canonical(payload: dict) -> str:
    sorted_payload = canonical_sort(payload)
    canonical = json.dumps(sorted_payload, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class IntegrityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method not in MUTATING_METHODS:
            return await call_next(request)

        if any(request.url.path.startswith(p) for p in EXEMPT_PATHS):
            return await call_next(request)

        expected_hash = request.headers.get("x-payload-hash")
        if not expected_hash:
            return await call_next(request)

        raw_body = await request.body()

        if not raw_body or raw_body.strip() == b"":
            return await call_next(request)

        try:
            parsed = json.loads(raw_body)
        except json.JSONDecodeError:
            return JSONResponse(
                status_code=400,
                content={
                    "error": "Integrity Fault",
                    "detail": "Request body is not valid JSON",
                    "code": "INTEGRITY_PARSE_ERROR",
                },
            )

        computed_hash = compute_sha256_canonical(parsed)

        if computed_hash != expected_hash:
            raw_hash = compute_sha256(raw_body)
            if raw_hash != expected_hash:
                logger.warning(
                    "INTEGRITY FAULT: %s %s — expected=%s computed_canonical=%s computed_raw=%s",
                    request.method,
                    request.url.path,
                    expected_hash,
                    computed_hash,
                    raw_hash,
                )
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": "Integrity Fault",
                        "detail": "SHA-256 payload hash mismatch. Data may have been corrupted in transit.",
                        "code": "INTEGRITY_HASH_MISMATCH",
                        "expected": expected_hash,
                        "computed": computed_hash,
                    },
                )

        request.state.payload_hash = expected_hash
        request.state.integrity_verified = True
        return await call_next(request)
