import { useChronosStore } from "./chronos";

export function lockWorld(): void {
  useChronosStore.getState().setWorldLocked(true);
}

export function unlockWorld(): void {
  useChronosStore.getState().setWorldLocked(false);
}

export function lockNode(nodeId: string): void {
  const state = useChronosStore.getState();
  if (!state.currentSnapshot) return;
  const node = state.currentSnapshot.sceneGraph[nodeId];
  if (!node) return;
  useChronosStore.setState({
    currentSnapshot: {
      ...state.currentSnapshot,
      sceneGraph: {
        ...state.currentSnapshot.sceneGraph,
        [nodeId]: { ...node, locked: true },
      },
    },
  });
}

export function unlockNode(nodeId: string): void {
  const state = useChronosStore.getState();
  if (!state.currentSnapshot) return;
  const node = state.currentSnapshot.sceneGraph[nodeId];
  if (!node) return;
  useChronosStore.setState({
    currentSnapshot: {
      ...state.currentSnapshot,
      sceneGraph: {
        ...state.currentSnapshot.sceneGraph,
        [nodeId]: { ...node, locked: false },
      },
    },
  });
}

export function isWorldLocked(): boolean {
  return useChronosStore.getState().worldLocked;
}

export function isNodeLocked(nodeId: string): boolean {
  return useChronosStore.getState().getNode(nodeId)?.locked ?? false;
}

export function getWorldVersion(): number {
  return useChronosStore.getState().currentSnapshot?.metadata.version ?? 0;
}
