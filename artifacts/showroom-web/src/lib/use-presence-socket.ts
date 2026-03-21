import { useEffect, useRef } from "react";
import { usePresenceStore } from "./presence-system";

const BROADCAST_INTERVAL_MS = 50;

export function usePresenceSocket(wsUrl: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const { setPeer, removePeer, localUserId } = usePresenceStore();

  useEffect(() => {
    if (!localUserId) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

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

    ws.onclose = () => { wsRef.current = null; };

    return () => { ws.close(); wsRef.current = null; };
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

  return wsRef;
}
