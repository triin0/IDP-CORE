import React from 'react';
import { z } from 'zod';
import type { Art, CreateArtRequest, ListArtsResponse, UpdateArtRequest } from '../../types/art.js';
import { useApi, ApiError } from './hooks/useApi.js';
import { ArtEditor } from './components/ArtEditor.js';
import { ArtList } from './components/ArtList.js';

const ArtSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['draft', 'published']),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

const ListArtsResponseSchema = z.object({
  items: z.array(ArtSchema)
});

const HealthSchema = z.object({ ok: z.boolean() });

export const App = (): JSX.Element => {
  const api = useApi();

  const [items, setItems] = React.useState<Art[]>([]);
  const [selected, setSelected] = React.useState<Art | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [saving, setSaving] = React.useState<boolean>(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async (): Promise<void> => {
    setError(null);
    const data: ListArtsResponse = await api.get('/arts', ListArtsResponseSchema);
    setItems(data.items);
  }, [api]);

  React.useEffect(() => {
    const run = async (): Promise<void> => {
      try {
        setLoading(true);
        await api.get('/health', HealthSchema);
        await refresh();
      } catch (e: unknown) {
        const message = e instanceof ApiError ? `${e.code}: ${e.message}` : 'Failed to load app.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [api, refresh]);

  const onCreate = async (req: CreateArtRequest): Promise<void> => {
    try {
      setSaving(true);
      setError(null);
      const created = await api.post('/arts', req, ArtSchema);
      // Put newest first.
      setItems((prev) => [created, ...prev]);
      setSelected(created);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : 'Failed to create artwork.');
    } finally {
      setSaving(false);
    }
  };

  const onUpdate = async (id: string, req: UpdateArtRequest): Promise<void> => {
    try {
      setSaving(true);
      setError(null);
      const updated = await api.put(`/arts/${id}`, req, ArtSchema);
      setItems((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setSelected(updated);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : 'Failed to update artwork.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string): Promise<void> => {
    try {
      setDeletingId(id);
      setError(null);
      await api.del(`/arts/${id}`);
      setItems((prev) => prev.filter((a) => a.id !== id));
      setSelected((prev) => (prev?.id === id ? null : prev));
    } catch (e: unknown) {
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : 'Failed to delete artwork.');
    } finally {
      setDeletingId(null);
    }
  };

  const selectedId = selected?.id ?? null;

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <h1>Art Creation</h1>
          <p>Create simple SVG-based artworks, save drafts, and publish them.</p>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setSelected(null);
            void refresh();
          }}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {loading ? <div className="muted">Loading…</div> : null}

      <div className="grid" style={{ marginTop: 12 }}>
        <ArtEditor
          selected={selected}
          saving={saving}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onResetSelection={() => setSelected(null)}
        />

        <ArtList
          items={items}
          selectedId={selectedId}
          onSelect={(a) => setSelected(a)}
          onDelete={onDelete}
          deletingId={deletingId}
        />
      </div>
    </div>
  );
};
