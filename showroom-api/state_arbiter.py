"""Shadow Branch Eradication — Sovereign State Arbiter.

Maintains monotonic state versions per entity. When an offline client
reconnects and flushes stale operations, the arbiter detects the version
mismatch and returns the Authoritative Manifest to correct the client's
local reality.

Protocol:
  - Every entity (vehicle bid pool) has a monotonic state_version counter.
  - Clients must include their last-known state_version in mutating requests.
  - If client version < server version → 409 Conflict + Authoritative Manifest.
  - If client version == server version → operation proceeds, version increments.
  - If client omits version (legacy) → operation proceeds without conflict check.
"""
import time
import threading
from typing import Any


class StateArbiter:
    def __init__(self) -> None:
        self._versions: dict[str, int] = {}
        self._lock = threading.Lock()
        self._history: list[dict[str, Any]] = []
        self._max_history = 200

    def get_version(self, entity_key: str) -> int:
        with self._lock:
            return self._versions.get(entity_key, 0)

    def check_and_increment(self, entity_key: str, client_version: int | None) -> tuple[bool, int]:
        with self._lock:
            current = self._versions.get(entity_key, 0)

            if client_version is not None and client_version < current:
                return False, current

            self._versions[entity_key] = current + 1

            self._history.append({
                "entity": entity_key,
                "fromVersion": current,
                "toVersion": current + 1,
                "clientVersion": client_version,
                "timestamp": time.time(),
            })
            if len(self._history) > self._max_history:
                self._history = self._history[-self._max_history:]

            return True, current + 1

    def get_all_versions(self) -> dict[str, int]:
        with self._lock:
            return dict(self._versions)

    def get_history(self, entity_key: str | None = None, limit: int = 50) -> list[dict]:
        with self._lock:
            if entity_key:
                filtered = [h for h in self._history if h["entity"] == entity_key]
            else:
                filtered = list(self._history)
            return filtered[-limit:]


state_arbiter = StateArbiter()
