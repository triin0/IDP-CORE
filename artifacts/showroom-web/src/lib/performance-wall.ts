export const PERF_LIMITS = {
  INSTANCE_THRESHOLD: 5,
  MAX_DRAW_CALLS: 100,
  LOD_DISTANCES: [0, 50, 150] as const,
  ADAPTIVE_DPR: [0.5, 2] as [number, number],
} as const;
