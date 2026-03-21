export function visualSanity(pos: [number, number, number]): boolean {
  const [x, y, z] = pos;
  if (y < 0) return false;
  const dist = Math.sqrt(x * x + z * z);
  if (dist > 100) return false;
  return true;
}
