export const ASSET_LIMITS = {
  MAX_VERTICES: 50_000,
  MAX_TEXTURE_RES: 1024,
  ALLOWED_FORMATS: [".glb", ".gltf", ".webp", ".png", ".mp3", ".ogg"],
} as const;

export function validateAssetUrl(url: string): boolean {
  const ext = url.slice(url.lastIndexOf(".")).toLowerCase();
  return ASSET_LIMITS.ALLOWED_FORMATS.includes(ext as any);
}
