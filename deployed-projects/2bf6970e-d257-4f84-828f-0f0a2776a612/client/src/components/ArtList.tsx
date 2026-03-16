import React from 'react';
import type { Art } from '../../../types/art.js';

export interface ArtListProps {
  items: Art[];
  selectedId: string | null;
  onSelect: (art: Art) => void;
  onDelete: (id: string) => Promise<void>;
  deletingId: string | null;
}

export const ArtList = ({ items, selectedId, onSelect, onDelete, deletingId }: ArtListProps): JSX.Element => {
  return (
    <div className="card">
      <h2>Gallery</h2>
      <div className="muted">{items.length} saved artworks</div>
      <hr />

      <div className="list">
        {items.map((a) => (
          <div key={a.id} className="item" style={{ borderColor: a.id === selectedId ? '#0ea5e9' : '#e2e8f0' }}>
            <div className="itemTop">
              <div>
                <div style={{ fontWeight: 700 }}>{a.title}</div>
                <div className="muted">Updated {new Date(a.updatedAt).toLocaleString()}</div>
              </div>
              <span className="badge">{a.status}</span>
            </div>

            {a.description ? <div className="muted">{a.description}</div> : null}

            <div className="row">
              <button type="button" className="secondary" onClick={() => onSelect(a)}>
                {a.id === selectedId ? 'Selected' : 'Edit'}
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => void onDelete(a.id)}
                disabled={deletingId === a.id}
              >
                {deletingId === a.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        ))}

        {items.length === 0 ? <div className="muted">No artworks yet. Create one to get started.</div> : null}
      </div>
    </div>
  );
};
