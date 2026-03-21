"""Chronos snapshot persistence for world state management."""
import json
import time
import uuid
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class SceneNodeSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    type: str
    position: list[float]
    rotation: list[float]
    scale: list[float]
    props: dict
    parentId: str | None = None
    locked: bool = False


class SnapshotMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int = 1
    author: str = "system"
    description: str = ""


class WorldSnapshotSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str
    timestamp: float
    sceneGraph: dict[str, SceneNodeSchema]
    metadata: SnapshotMetadata


class SnapshotCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    snapshot: WorldSnapshotSchema
    autoSave: bool = False


class SnapshotStore:
    def __init__(self, max_snapshots: int = 50) -> None:
        self._store: Dict[str, dict] = {}
        self._max_snapshots = max_snapshots
        self._lock_owner: Optional[str] = None

    def save(self, snapshot: WorldSnapshotSchema, auto_save: bool = False) -> dict:
        data = snapshot.model_dump()
        data["savedAt"] = time.time()
        data["autoSave"] = auto_save
        self._store[snapshot.id] = data

        if len(self._store) > self._max_snapshots:
            oldest_key = min(self._store, key=lambda k: self._store[k]["savedAt"])
            del self._store[oldest_key]

        return {"id": snapshot.id, "savedAt": data["savedAt"]}

    def get(self, snapshot_id: str) -> dict | None:
        return self._store.get(snapshot_id)

    def list_all(self, limit: int = 100, offset: int = 0) -> list[dict]:
        snapshots = sorted(
            self._store.values(),
            key=lambda s: s["timestamp"],
            reverse=True,
        )
        return [
            {"id": s["id"], "name": s["name"], "timestamp": s["timestamp"],
             "version": s.get("metadata", {}).get("version", 1)}
            for s in snapshots[offset:offset + limit]
        ]

    def delete(self, snapshot_id: str) -> bool:
        return self._store.pop(snapshot_id, None) is not None

    def lock_world(self, owner: str) -> bool:
        if self._lock_owner is not None:
            return False
        self._lock_owner = owner
        return True

    def unlock_world(self, owner: str) -> bool:
        if self._lock_owner != owner:
            return False
        self._lock_owner = None
        return True

    def is_locked(self) -> bool:
        return self._lock_owner is not None

    def get_lock_owner(self) -> str | None:
        return self._lock_owner

    def diff(self, id_a: str, id_b: str) -> dict | None:
        a = self.get(id_a)
        b = self.get(id_b)
        if not a or not b:
            return None
        a_keys = set(a.get("sceneGraph", {}).keys())
        b_keys = set(b.get("sceneGraph", {}).keys())
        added = list(b_keys - a_keys)
        removed = list(a_keys - b_keys)
        modified = [
            k for k in a_keys & b_keys
            if json.dumps(a["sceneGraph"][k], sort_keys=True)
            != json.dumps(b["sceneGraph"][k], sort_keys=True)
        ]
        return {"added": added, "removed": removed, "modified": modified}


snapshot_store = SnapshotStore()
