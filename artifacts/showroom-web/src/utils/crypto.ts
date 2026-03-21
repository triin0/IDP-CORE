function sortKeysDeep(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  if (typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return obj;
}

export function canonicalize(payload: unknown): string {
  return JSON.stringify(sortKeysDeep(payload));
}

export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPayload(payload: unknown): Promise<{ canonical: string; hash: string }> {
  const canonical = canonicalize(payload);
  const hash = await sha256(canonical);
  return { canonical, hash };
}

export async function verifiedFetch(
  url: string,
  payload: unknown,
  options: RequestInit = {},
): Promise<Response> {
  const { canonical, hash } = await hashPayload(payload);
  return fetch(url, {
    ...options,
    method: options.method ?? "POST",
    headers: {
      ...options.headers as Record<string, string>,
      "Content-Type": "application/json",
      "X-Payload-Hash": hash,
    },
    body: canonical,
  });
}
