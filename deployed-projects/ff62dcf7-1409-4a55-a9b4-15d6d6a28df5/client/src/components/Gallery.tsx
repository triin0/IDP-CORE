import React from 'react';
import type { GeneratedArt } from '@app/types';

export const Gallery = (props: {
  items: ReadonlyArray<GeneratedArt>;
  onOpen: (id: string) => void;
}): React.ReactElement => {
  if (props.items.length === 0) {
    return <div className="sub">No art yet. Generate your first asset.</div>;
  }

  return (
    <div className="gallery">
      {props.items.map((it) => (
        <div className="tile" key={it.id}>
          <img src={it.imageDataUrl} alt={it.prompt} loading="lazy" />
          <div className="meta">
            <div className="title">{it.prompt}</div>
            <div className="small">
              <span className="pill">{it.assetType}</span>
              <span className="pill">{it.style}</span>
              <span className="pill">{it.width}×{it.height}</span>
            </div>
            <button className="btn" style={{ padding: '8px 10px' }} onClick={() => props.onOpen(it.id)}>
              Open details
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
