import { useEffect, useRef, useState } from "react";
import { usePresenceStore } from "./presence-system";

const BROADCAST_INTERVAL_MS = 50;
const API_BASE = import.meta.env.VITE_SHOWROOM_API_URL || "http://localhost:8000";

async function fetchSessionToken(userId: string): Promise<string> {
  const resp = await fetch(`${API_BASE}/api/auth/session?user_id=${encodeURIComponent(userId)}`, {
    method: "POST",
  });
  if (!resp.ok) throw new Error("Failed to obtain session token");
  const data = await resp.json();
  return data.token;
}

export function usePresenceSocket(wsUrl: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const { setPeer, removePeer, localUserId } = usePresenceStore();
  const [authStatus, setAuthStatus] = useState<"pending" | "authenticated" | "rejected">("pending");

  useEffect(() => {
    if (!localUserId) return;
    let cancelled = false;

    (async () => {
      let token: string;
      try {
        token = await fetchSessionToken(localUserId);
      } catch {
        setAuthStatus("rejected");
        return;
      }
      if (cancelled) return;

      const separator = wsUrl.includes("?") ? "&" : "?";
      const authenticatedUrl = `${wsUrl}${separator}token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(authenticatedUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setAuthStatus("authenticated");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "presence:update" && msg.userId !== localUserId) {
            setPeer(msg.userId, {
              displayName: msg.displayName,
              cursor3D: msg.cursor3D,
              selectedNodeId: msg.selectedNodeId,
            });
          } else if (msg.type === "presence:leave") {
            removePeer(msg.userId);
          } else if (msg.type === "command:conflict") {
            console.warn("[Presence] Conflict resolved:", msg.resolution);
          }
        } catch {}
      };

      ws.onclose = (event) => {
        wsRef.current = null;
        if (event.code === 1008) {
          setAuthStatus("rejected");
          console.error("[Presence] Connection severed: identity verification failed");
        }
      };
    })();

    return () => {
      cancelled = true;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [wsUrl, localUserId, setPeer, removePeer]);

  const broadcastCursor = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    broadcastCursor.current = setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const state = usePresenceStore.getState();
      const local = state.peers.get(state.localUserId);
      if (!local) return;

      ws.send(JSON.stringify({
        type: "presence:update",
        userId: state.localUserId,
        displayName: local.displayName,
        cursor3D: local.cursor3D,
        selectedNodeId: local.selectedNodeId,
      }));
    }, BROADCAST_INTERVAL_MS);

    return () => clearInterval(broadcastCursor.current);
  }, []);

  return { wsRef, authStatus };
}
