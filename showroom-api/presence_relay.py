"""WebSocket presence relay for collaborative 3D workspace."""
import asyncio
import json
import time
from typing import Dict, Set
from fastapi import WebSocket, WebSocketDisconnect

PRESENCE_TIMEOUT_S = 10
HEARTBEAT_INTERVAL_S = 5

class PresenceManager:
    def __init__(self) -> None:
        self.connections: Dict[str, WebSocket] = {}
        self.state: Dict[str, dict] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            if user_id in self.connections:
                try:
                    await self.connections[user_id].close()
                except Exception:
                    pass
            self.connections[user_id] = ws
            self.state[user_id] = {
                "userId": user_id,
                "cursor3D": [0, 0, 0],
                "selectedNodeId": None,
                "lastSeen": time.time(),
            }
        await self.broadcast({
            "type": "presence:update",
            **self.state[user_id],
        }, exclude={user_id})

    async def disconnect(self, user_id: str) -> None:
        async with self._lock:
            self.connections.pop(user_id, None)
            self.state.pop(user_id, None)
        await self.broadcast({
            "type": "presence:leave",
            "userId": user_id,
        })

    async def update(self, user_id: str, data: dict) -> None:
        async with self._lock:
            if user_id in self.state:
                self.state[user_id].update(data)
                self.state[user_id]["lastSeen"] = time.time()
        await self.broadcast({
            "type": "presence:update",
            "userId": user_id,
            **data,
        }, exclude={user_id})

    async def broadcast(self, message: dict, exclude: Set[str] | None = None) -> None:
        exclude = exclude or set()
        payload = json.dumps(message)
        async with self._lock:
            dead: list[str] = []
            for uid, ws in self.connections.items():
                if uid in exclude:
                    continue
                try:
                    await ws.send_text(payload)
                except Exception:
                    dead.append(uid)
            for uid in dead:
                self.connections.pop(uid, None)
                self.state.pop(uid, None)

    async def resolve_conflict(
        self, local_ts: float, remote_ts: float, target_id: str,
    ) -> str:
        return "local-wins" if local_ts >= remote_ts else "remote-wins"

    def sanitize_update(self, data: dict) -> dict:
        ALLOWED_FIELDS = {"cursor3D", "selectedNodeId", "displayName"}
        return {k: v for k, v in data.items() if k in ALLOWED_FIELDS}

    def get_active_peers(self) -> list[dict]:
        now = time.time()
        return [
            s for s in self.state.values()
            if now - s.get("lastSeen", 0) < PRESENCE_TIMEOUT_S
        ]

presence_manager = PresenceManager()
