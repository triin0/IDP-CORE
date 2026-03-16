import React from 'react';
import type { Bookmark } from '@types/bookmark';

type Props = {
  items: Bookmark[];
  onEdit: (b: Bookmark) => void;
  onDelete: (id: string) => void;
};

export const BookmarkList = ({ items, onEdit, onDelete }: Props): React.ReactElement => {
  if (items.length === 0) {
    return <div className="empty">No bookmarks yet.</div>;
  }

  return (
    <div className="list">
      {items.map((b) => (
        <div className="card" key={b.id}>
          <div className="cardHeader">
            <div>
              <div className="title">{b.title}</div>
              <a className="link" href={b.url} target="_blank" rel="noreferrer">
                {b.url}
              </a>
            </div>
            <div className="cardActions">
              <button className="button" onClick={() => onEdit(b)}>
                Edit
              </button>
              <button className="button danger" onClick={() => onDelete(b.id)}>
                Delete
              </button>
            </div>
          </div>

          {b.description ? <div className="description">{b.description}</div> : null}

          <div className="meta">
            <span>Tags: {b.tags.length ? b.tags.join(', ') : '—'}</span>
            <span>Updated: {new Date(b.updatedAt).toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
