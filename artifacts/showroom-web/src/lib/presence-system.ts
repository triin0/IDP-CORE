import { create } from "zustand";

export interface PresenceUser {
  userId: string;
  displayName: string;
  color: string;
  cursor3D: [number, number, number];
  selectedNodeId: string | null;
  lastSeen: number;
}

interface PresenceState {
  peers: Map<string, PresenceUser>;
  localUserId: string;
  setPeer: (userId: string, data: Partial<PresenceUser>) => void;
  removePeer: (userId: string) => void;
  setLocalUser: (userId: string) => void;
  getActivePeers: () => PresenceUser[];
}

const PRESENCE_TIMEOUT_MS = 10_000;
const CURSOR_LERP_FACTOR = 0.15;

export const usePresenceStore = create<PresenceState>((set, get) => ({
  peers: new Map(),
  localUserId: "",
  setPeer: (userId, data) =>
    set((state) => {
      const peers = new Map(state.peers);
      const existing = peers.get(userId) ?? {
        userId,
        displayName: "User",
        color: generatePresenceColor(userId),
        cursor3D: [0, 0, 0] as [number, number, number],
        selectedNodeId: null,
        lastSeen: Date.now(),
      };
      peers.set(userId, { ...existing, ...data, lastSeen: Date.now() });
      return { peers };
    }),
  removePeer: (userId) =>
    set((state) => {
      const peers = new Map(state.peers);
      peers.delete(userId);
      return { peers };
    }),
  setLocalUser: (userId) =>
    set((state) => {
      const peers = new Map(state.peers);
      if (!peers.has(userId)) {
        peers.set(userId, {
          userId,
          displayName: "You",
          color: generatePresenceColor(userId),
          cursor3D: [0, 0, 0] as [number, number, number],
          selectedNodeId: null,
          lastSeen: Date.now(),
        });
      }
      return { localUserId: userId, peers };
    }),
  getActivePeers: () => {
    const now = Date.now();
    return [...get().peers.values()].filter(
      (p) => now - p.lastSeen < PRESENCE_TIMEOUT_MS && p.userId !== get().localUserId,
    );
  },
}));

function generatePresenceColor(userId: string): string {
  const PALETTE = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
    "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
    "#BB8FCE", "#85C1E9", "#F8C471", "#82E0AA",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function reconcilePresenceCommand(
  localCommand: { action: string; targetId?: string },
  remoteCommand: { action: string; targetId?: string; timestamp: number },
  localTimestamp: number,
): "local-wins" | "remote-wins" {
  if (localCommand.targetId !== remoteCommand.targetId) return "local-wins";
  return localTimestamp >= remoteCommand.timestamp ? "local-wins" : "remote-wins";
}

export function lerpCursor3D(
  current: [number, number, number],
  target: [number, number, number],
  factor: number = CURSOR_LERP_FACTOR,
): [number, number, number] {
  return [
    current[0] + (target[0] - current[0]) * factor,
    current[1] + (target[1] - current[1]) * factor,
    current[2] + (target[2] - current[2]) * factor,
  ];
}
