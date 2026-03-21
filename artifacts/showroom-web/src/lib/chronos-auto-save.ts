import { useEffect, useRef } from "react";
import { useChronosStore, AUTO_SAVE_INTERVAL_MS } from "./chronos";

export function useAutoSave(apiUrl: string) {
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const { autoSaveEnabled, markClean, addSnapshot } = useChronosStore();

  useEffect(() => {
    if (!autoSaveEnabled) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(async () => {
      const state = useChronosStore.getState();
      if (!state.isDirty || !state.currentSnapshot || state.worldLocked) return;

      try {
        const response = await fetch(`${apiUrl}/api/snapshots`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            snapshot: state.currentSnapshot,
            autoSave: true,
          }),
        });

        if (response.ok) {
          markClean();
          addSnapshot(state.currentSnapshot);
        }
      } catch (err) {
        console.warn("[Chronos] Auto-save failed, will retry:", err);
      }
    }, AUTO_SAVE_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoSaveEnabled, apiUrl, markClean, addSnapshot]);

  return { autoSaveEnabled };
}

export async function loadSnapshot(
  apiUrl: string,
  snapshotId: string,
): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}/api/snapshots/${snapshotId}`);
    if (!response.ok) return false;
    const snapshot = await response.json();
    useChronosStore.getState().setSnapshot(snapshot);
    return true;
  } catch {
    return false;
  }
}

export async function listSnapshots(
  apiUrl: string,
): Promise<Array<{ id: string; name: string; timestamp: number }>> {
  try {
    const response = await fetch(`${apiUrl}/api/snapshots`);
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}
