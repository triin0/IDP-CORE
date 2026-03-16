import { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import type { ApiErrorBody, ApiOk, ArtRequest, GeneratedArt } from '@app/types';

const artSchema = z.object({
  id: z.string().uuid(),
  prompt: z.string(),
  style: z.enum(['pixel', 'vector', 'isometric', 'handpainted', 'lowpoly', 'concept']),
  assetType: z.enum(['character', 'environment', 'icon', 'item', 'ui', 'texture']),
  width: z.number().int(),
  height: z.number().int(),
  seed: z.number().int(),
  imageDataUrl: z.string(),
  createdAt: z.string()
});

const artListSchema = z.array(artSchema);

const apiOkSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({ data: dataSchema }) as z.ZodType<ApiOk<z.infer<T>>>;

const apiErrorSchema: z.ZodType<ApiErrorBody> = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
    details: z.unknown().optional()
  })
});

const getBaseUrl = (): string => {
  // In dev, point to local server; in prod, same origin.
  const fromEnv = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  return 'http://localhost:4000';
};

export const useArtApi = (): {
  baseUrl: string;
  items: ReadonlyArray<GeneratedArt>;
  busy: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (req: ArtRequest) => Promise<GeneratedArt>;
  openById: (id: string) => Promise<void>;
} => {
  const baseUrl = useMemo(() => getBaseUrl(), []);
  const [items, setItems] = useState<GeneratedArt[]>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const parseError = async (res: Response): Promise<string> => {
    const text = await res.text();
    try {
      const json = JSON.parse(text) as unknown;
      const parsed = apiErrorSchema.safeParse(json);
      if (parsed.success) {
        const rid = parsed.data.error.requestId ? ` (requestId: ${parsed.data.error.requestId})` : '';
        return `${parsed.data.error.code}: ${parsed.data.error.message}${rid}`;
      }
    } catch {
      // ignore
    }
    return `HTTP ${res.status}: ${text.slice(0, 200)}`;
  };

  const refresh = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/api/art?limit=18`, { method: 'GET' });
      if (!res.ok) {
        throw new Error(await parseError(res));
      }
      const json = (await res.json()) as unknown;
      const parsed = apiOkSchema(artListSchema).parse(json);
      setItems(parsed.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setBusy(false);
    }
  }, [baseUrl]);

  const create = useCallback(
    async (req: ArtRequest): Promise<GeneratedArt> => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`${baseUrl}/api/art`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req)
        });
        if (!res.ok) {
          throw new Error(await parseError(res));
        }
        const json = (await res.json()) as unknown;
        const parsed = apiOkSchema(artSchema).parse(json);
        setItems((prev) => [parsed.data, ...prev.filter((x) => x.id !== parsed.data.id)].slice(0, 18));
        return parsed.data;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to generate';
        setError(msg);
        throw e instanceof Error ? e : new Error(msg);
      } finally {
        setBusy(false);
      }
    },
    [baseUrl]
  );

  const openById = useCallback(
    async (id: string): Promise<void> => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`${baseUrl}/api/art/${id}`, { method: 'GET' });
        if (!res.ok) {
          throw new Error(await parseError(res));
        }
        const json = (await res.json()) as unknown;
        const parsed = apiOkSchema(artSchema).parse(json);
        const it = parsed.data;

        // Simple "details" interaction: open image in a new tab with context in the URL hash.
        const w = window.open();
        if (w) {
          w.document.title = `Art ${it.id}`;
          w.document.body.style.margin = '0';
          w.document.body.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto';
          w.document.body.style.background = '#0b1020';
          w.document.body.style.color = 'white';
          w.document.body.innerHTML = `
            <div style="padding:16px; display:grid; gap:10px;">
              <div style="font-weight:800;">${escapeHtml(it.prompt)}</div>
              <div style="opacity:.8; font-size:13px;">${escapeHtml(it.assetType)} • ${escapeHtml(it.style)} • ${it.width}×${it.height} • seed ${it.seed}</div>
              <img src="${it.imageDataUrl}" style="max-width:100%; border-radius:14px; border:1px solid rgba(255,255,255,.14);" />
              <a style="opacity:.85" href="${it.imageDataUrl}" download="art-${it.id}.png">Download (best-effort)</a>
            </div>`;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to open');
      } finally {
        setBusy(false);
      }
    },
    [baseUrl]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { baseUrl, items, busy, error, refresh, create, openById };
};

const escapeHtml = (s: string): string =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
