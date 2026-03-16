import React, { useMemo, useState } from 'react';
import type { ArtRequest, GeneratedArt } from '@app/types';
import { ArtForm } from './components/ArtForm.js';
import { Gallery } from './components/Gallery.js';
import { useArtApi } from './hooks/useArtApi.js';

export const App = (): React.ReactElement => {
  const api = useArtApi();

  const [latest, setLatest] = useState<GeneratedArt | null>(null);

  const merged = useMemo(() => {
    const items = [...api.items];
    if (latest && !items.some((x) => x.id === latest.id)) {
      items.unshift(latest);
    }
    return items;
  }, [api.items, latest]);

  const onGenerate = async (req: ArtRequest): Promise<void> => {
    const created = await api.create(req);
    setLatest(created);
  };

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1 className="h1">Game Art Generator</h1>
          <div className="sub">
            Generates game-ready placeholder art by default; optionally uses OpenAI when configured.
          </div>
        </div>
        <div className="pill">API: {api.baseUrl}</div>
      </div>

      <div className="grid">
        <div className="card">
          <ArtForm busy={api.busy} onGenerate={onGenerate} />
          {api.error ? <div className="err" style={{ marginTop: 12 }}>{api.error}</div> : null}
          <div className="sub" style={{ marginTop: 12 }}>
            Tip: set <code>OPENAI_API_KEY</code> on the server to enable real image generation.
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 800 }}>Recent generations</div>
              <div className="sub">Stored in Postgres via parameterized queries.</div>
            </div>
            <button className="btn" style={{ width: 'auto', paddingInline: 14 }} onClick={() => void api.refresh()} disabled={api.busy}>
              Refresh
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <Gallery items={merged} onOpen={(id) => void api.openById(id)} />
          </div>
        </div>
      </div>
    </div>
  );
};
