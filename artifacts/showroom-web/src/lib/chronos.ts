import { create } from "zustand";

export interface WorldSnapshot {
  id: string;
  name: string;
  timestamp: number;
  sceneGraph: Record<string, SceneNode>;
  metadata: {
    version: number;
    author: string;
    description: string;
  };
}

export interface SceneNode {
  id: string;
  type: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  props: Record<string, unknown>;
  parentId: string | null;
  locked: boolean;
}

interface ChronosState {
  currentSnapshot: WorldSnapshot | null;
  snapshots: WorldSnapshot[];
  isDirty: boolean;
  autoSaveEnabled: boolean;
  lastSavedAt: number;
  worldLocked: boolean;
  setSnapshot: (snapshot: WorldSnapshot) => void;
  markDirty: () => void;
  markClean: () => void;
  addSnapshot: (snapshot: WorldSnapshot) => void;
  toggleAutoSave: () => void;
  setWorldLocked: (locked: boolean) => void;
  getNode: (nodeId: string) => SceneNode | undefined;
  updateNode: (nodeId: string, updates: Partial<SceneNode>) => void;
  removeNode: (nodeId: string) => void;
}

const AUTO_SAVE_INTERVAL_MS = 5_000;
const MAX_SNAPSHOTS = 50;

export const useChronosStore = create<ChronosState>((set, get) => ({
  currentSnapshot: null,
  snapshots: [],
  isDirty: false,
  autoSaveEnabled: true,
  lastSavedAt: 0,
  worldLocked: false,
  setSnapshot: (snapshot) => set({ currentSnapshot: snapshot, isDirty: false, lastSavedAt: Date.now() }),
  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false, lastSavedAt: Date.now() }),
  addSnapshot: (snapshot) =>
    set((state) => ({
      snapshots: [...state.snapshots, snapshot].slice(-MAX_SNAPSHOTS),
    })),
  toggleAutoSave: () => set((state) => ({ autoSaveEnabled: !state.autoSaveEnabled })),
  setWorldLocked: (locked) => set({ worldLocked: locked }),
  getNode: (nodeId) => get().currentSnapshot?.sceneGraph[nodeId],
  updateNode: (nodeId, updates) =>
    set((state) => {
      if (state.worldLocked) return state;
      if (!state.currentSnapshot) return state;
      const node = state.currentSnapshot.sceneGraph[nodeId];
      if (!node) return state;
      if (node.locked) return state;
      return {
        currentSnapshot: {
          ...state.currentSnapshot,
          sceneGraph: {
            ...state.currentSnapshot.sceneGraph,
            [nodeId]: { ...node, ...updates },
          },
          metadata: {
            ...state.currentSnapshot.metadata,
            version: state.currentSnapshot.metadata.version + 1,
          },
        },
        isDirty: true,
      };
    }),
  removeNode: (nodeId) =>
    set((state) => {
      if (state.worldLocked) return state;
      if (!state.currentSnapshot) return state;
      const { [nodeId]: _, ...rest } = state.currentSnapshot.sceneGraph;
      return {
        currentSnapshot: {
          ...state.currentSnapshot,
          sceneGraph: rest,
        },
        isDirty: true,
      };
    }),
}));

export function createSnapshot(
  name: string,
  sceneGraph: Record<string, SceneNode>,
  author: string = "system",
  description: string = "",
): WorldSnapshot {
  return {
    id: crypto.randomUUID(),
    name,
    timestamp: Date.now(),
    sceneGraph,
    metadata: { version: 1, author, description },
  };
}

export function diffSnapshots(
  a: WorldSnapshot,
  b: WorldSnapshot,
): { added: string[]; removed: string[]; modified: string[] } {
  const aKeys = new Set(Object.keys(a.sceneGraph));
  const bKeys = new Set(Object.keys(b.sceneGraph));
  const added = [...bKeys].filter((k) => !aKeys.has(k));
  const removed = [...aKeys].filter((k) => !bKeys.has(k));
  const modified = [...aKeys].filter(
    (k) => bKeys.has(k) && JSON.stringify(a.sceneGraph[k]) !== JSON.stringify(b.sceneGraph[k]),
  );
  return { added, removed, modified };
}

export { AUTO_SAVE_INTERVAL_MS, MAX_SNAPSHOTS };
