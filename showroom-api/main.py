"""Lexus RX300 Showroom API — Hardened by Vindicator (12 FastAPI passes).

Transformations applied:
  Pass 1: declarative_base() → DeclarativeBase (SQLAlchemy 2.0)
  Pass 2: Column() → mapped_column()
  Pass 3: List[X] → list[X] (PEP 585)
  Pass 4: class Config → model_config = ConfigDict() (Pydantic V2)
  Pass 5: sync def → async def
  Pass 6: Hardcoded DB URL → os.getenv("DATABASE_URL")
  Pass 7: Pinned requirements
  Pass 8/9: limit/offset pagination
  Pass 10: GZipMiddleware
  Pass 48: Presence relay (WebSocket)
  Pass 49: Chronos snapshot store
  Tier 5: SHA-256 Cryptographic Root of Trust
"""
import os
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from sqlalchemy import create_engine, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker, relationship, mapped_column, Mapped
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from integrity import IntegrityMiddleware

DATABASE_URL = os.getenv("SHOWROOM_DATABASE_URL", "sqlite:///./showroom.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class Vehicle(Base):
    __tablename__ = "vehicles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    color: Mapped[str] = mapped_column(String, default="silver")
    model_url: Mapped[str | None] = mapped_column(String, nullable=True)
    bids = relationship("Bid", back_populates="vehicle")


class Bid(Base):
    __tablename__ = "bids"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    vehicle_id: Mapped[int] = mapped_column(Integer, ForeignKey("vehicles.id"))
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    payload_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    state_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    vehicle = relationship("Vehicle", back_populates="bids")


class VehicleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    year: int
    price: float
    color: str


class BidCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    vehicle_id: int
    amount: float
    user_id: str
    state_version: int | None = None


class BidResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    vehicle_id: int
    amount: float
    user_id: str
    payload_hash: str | None = None
    state_version: int | None = None


app = FastAPI(title="Lexus RX300 Showroom API", version="1.0.0")
app.add_middleware(IntegrityMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*", "X-Payload-Hash"],
    expose_headers=["X-Payload-Hash"],
    allow_credentials=True,
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.on_event("startup")
async def startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    if db.query(Vehicle).count() == 0:
        db.add(Vehicle(name="Lexus RX300", year=2024, price=42000.0, color="silver", model_url="/models/lexus-rx300.glb"))
        db.add(Vehicle(name="Lexus RX350h", year=2025, price=48500.0, color="obsidian", model_url="/models/lexus-rx350h.glb"))
        db.add(Vehicle(name="Lexus RX500h F Sport", year=2025, price=62500.0, color="white nova", model_url="/models/lexus-rx500h.glb"))
        db.commit()
    db.close()


@app.get("/api/health")
async def health():
    return {"ok": True, "engine": "FastAPI Vindicator (12 passes)"}


@app.get("/api/vehicles", response_model=list[VehicleResponse])
async def get_vehicles(
    db: Session = Depends(get_db),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
):
    return db.query(Vehicle).offset(offset).limit(limit).all()


@app.get("/api/vehicles/{vehicle_id}", response_model=VehicleResponse)
async def get_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    v = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return v


@app.post("/api/bids")
async def create_bid(bid: BidCreate, request: Request, db: Session = Depends(get_db)):
    from state_arbiter import state_arbiter
    entity_key = f"vehicle:{bid.vehicle_id}:bids"

    accepted, new_version = state_arbiter.check_and_increment(entity_key, bid.state_version)

    if not accepted:
        current_bids = db.query(Bid).filter(
            Bid.vehicle_id == bid.vehicle_id
        ).order_by(Bid.created_at.desc()).limit(10).all()

        manifest = {
            "highestBid": max((b.amount for b in current_bids), default=0),
            "bidCount": len(current_bids),
            "recentBids": [
                {"id": b.id, "amount": b.amount, "user_id": b.user_id}
                for b in current_bids[:5]
            ],
        }

        return JSONResponse(
            status_code=409,
            content={
                "error": "Shadow Branch Detected",
                "detail": "Your state version is stale. Another operation has modified this entity.",
                "code": "STATE_VERSION_CONFLICT",
                "clientVersion": bid.state_version,
                "serverVersion": new_version,
                "authoritativeManifest": manifest,
            },
        )

    bid_data = bid.model_dump(exclude={"state_version"})
    bid_data["payload_hash"] = getattr(request.state, "payload_hash", None)
    bid_data["state_version"] = new_version
    new_bid = Bid(**bid_data)
    db.add(new_bid)
    db.commit()
    db.refresh(new_bid)

    return {
        "id": new_bid.id,
        "vehicle_id": new_bid.vehicle_id,
        "amount": new_bid.amount,
        "user_id": new_bid.user_id,
        "payload_hash": new_bid.payload_hash,
        "state_version": new_version,
    }


@app.get("/api/bids/{vehicle_id}", response_model=list[BidResponse])
async def get_vehicle_bids(
    vehicle_id: int,
    db: Session = Depends(get_db),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
):
    return db.query(Bid).filter(Bid.vehicle_id == vehicle_id).offset(offset).limit(limit).all()


from presence_relay import presence_manager
from security import create_session_token, verify_token, TokenError
import logging

security_logger = logging.getLogger("security")


AUTH_DISABLED = os.getenv("AUTH_DISABLED", "true").lower() == "true"


@app.post("/api/auth/session")
async def create_session(request: Request, user_id: str | None = None):
    if AUTH_DISABLED:
        resolved_user = user_id or "dev-user-001"
    else:
        authenticated_user = getattr(request.state, "user_id", None)
        if not authenticated_user:
            return JSONResponse(status_code=401, content={"error": "Authentication required"})
        if user_id and user_id != authenticated_user:
            return JSONResponse(
                status_code=403,
                content={"error": "Cannot mint token for another user"},
            )
        resolved_user = authenticated_user
    return create_session_token(resolved_user)


@app.websocket("/ws/presence/{user_id}")
async def presence_ws(websocket: WebSocket, user_id: str, token: str | None = None):
    if not token:
        token = websocket.query_params.get("token")

    if not token:
        security_logger.warning("IDENTITY FORGERY BLOCKED: No token provided for user_id=%s", user_id)
        await websocket.close(code=1008, reason="Authentication required")
        return

    try:
        claims = verify_token(token, expected_user_id=user_id)
    except TokenError as e:
        security_logger.warning(
            "IDENTITY FORGERY BLOCKED: %s (code=%s, claimed_user=%s)",
            str(e), e.code, user_id,
        )
        await websocket.close(code=1008, reason=f"Authentication failed: {e.code}")
        return

    security_logger.info(
        "Authenticated WebSocket: user=%s session=%s",
        claims["sub"], claims["sid"],
    )

    await presence_manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "presence:update":
                sanitized = presence_manager.sanitize_update(data)
                await presence_manager.update(user_id, sanitized)
            elif data.get("type") == "command:conflict":
                resolution = await presence_manager.resolve_conflict(
                    data.get("localTs", 0),
                    data.get("remoteTs", 0),
                    data.get("targetId", ""),
                )
                await websocket.send_json({"type": "command:conflict", "resolution": resolution})
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        await presence_manager.disconnect(user_id)


@app.get("/api/presence/active")
async def get_active_presence():
    return {"peers": presence_manager.get_active_peers(), "conflictMode": "last-write-wins"}


from snapshot_store import snapshot_store, SnapshotCreate


@app.post("/api/snapshots")
async def create_snapshot(body: SnapshotCreate, request: Request):
    result = snapshot_store.save(body.snapshot, body.autoSave)
    payload_hash = getattr(request.state, "payload_hash", None)
    if payload_hash:
        result["payloadHash"] = payload_hash
    return result


@app.get("/api/snapshots")
async def list_snapshots(limit: int = Query(default=100, le=500), offset: int = Query(default=0, ge=0)):
    return snapshot_store.list_all(limit=limit, offset=offset)


@app.get("/api/snapshots/{snapshot_id}")
async def get_snapshot(snapshot_id: str):
    snapshot = snapshot_store.get(snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return snapshot


@app.delete("/api/snapshots/{snapshot_id}")
async def delete_snapshot(snapshot_id: str):
    return {"deleted": snapshot_store.delete(snapshot_id)}


@app.post("/api/world/lock")
async def lock_world(owner: str = "system"):
    success = snapshot_store.lock_world(owner)
    return {"locked": success, "owner": snapshot_store.get_lock_owner()}


@app.post("/api/world/unlock")
async def unlock_world(owner: str = "system"):
    return {"unlocked": snapshot_store.unlock_world(owner)}


@app.get("/api/world/status")
async def world_status():
    return {
        "locked": snapshot_store.is_locked(),
        "lockOwner": snapshot_store.get_lock_owner(),
        "snapshotCount": len(snapshot_store._store),
    }


@app.get("/api/snapshots/diff/{id_a}/{id_b}")
async def diff_snapshots(id_a: str, id_b: str):
    result = snapshot_store.diff(id_a, id_b)
    if result is None:
        raise HTTPException(status_code=404, detail="One or both snapshots not found")
    return result


@app.get("/api/integrity/status")
async def integrity_status():
    return {
        "tier": 5,
        "protocol": "SHA-256 Cryptographic Root of Trust",
        "verification": "X-Payload-Hash header on POST/PUT/PATCH",
        "rejection": "400 Integrity Fault on hash mismatch",
        "audit": "payload_hash column on bids table",
    }


@app.get("/api/state/versions")
async def get_state_versions():
    from state_arbiter import state_arbiter
    return {
        "versions": state_arbiter.get_all_versions(),
        "protocol": "monotonic-version + LWW",
    }


@app.get("/api/state/version/{vehicle_id}")
async def get_vehicle_state_version(vehicle_id: int):
    from state_arbiter import state_arbiter
    entity_key = f"vehicle:{vehicle_id}:bids"
    return {
        "entity": entity_key,
        "version": state_arbiter.get_version(entity_key),
    }


@app.get("/api/state/manifest/{vehicle_id}")
async def get_authoritative_manifest(vehicle_id: int, db: Session = Depends(get_db)):
    from state_arbiter import state_arbiter
    entity_key = f"vehicle:{vehicle_id}:bids"
    current_bids = db.query(Bid).filter(
        Bid.vehicle_id == vehicle_id
    ).order_by(Bid.created_at.desc()).limit(20).all()

    return {
        "entity": entity_key,
        "stateVersion": state_arbiter.get_version(entity_key),
        "highestBid": max((b.amount for b in current_bids), default=0),
        "bidCount": len(current_bids),
        "recentBids": [
            {"id": b.id, "amount": b.amount, "user_id": b.user_id, "state_version": b.state_version}
            for b in current_bids[:10]
        ],
    }


@app.get("/api/state/history")
async def get_state_history(entity: str | None = None, limit: int = Query(default=50, le=200)):
    from state_arbiter import state_arbiter
    return {"history": state_arbiter.get_history(entity, limit)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
