import React, { useMemo, useState } from 'react';
import { BookmarkForm } from './components/BookmarkForm.js';
import { BookmarkList } from './components/BookmarkList.js';
import { useBookmarks } from './hooks/useBookmarks.js';
import type { Bookmark, CreateBookmarkInput, UpdateBookmarkInput } from '@types/bookmark';

export const App = (): React.ReactElement => {
  const apiBaseUrl = useMemo(() => {
    const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;
    return fromEnv && fromEnv.length > 0 ? fromEnv : 'http://localhost:4000/api';
  }, []);

  const { items, loading, error, create, update, remove, refresh } = useBookmarks(apiBaseUrl);

  const [editing, setEditing] = useState<Bookmark | null>(null);

  const onCreate = async (input: CreateBookmarkInput): Promise<void> => {
    await create(input);
  };

  const onUpdate = async (id: string, input: UpdateBookmarkInput): Promise<void> => {
    await update(id, input);
    setEditing(null);
  };

  const onDelete = async (id: string): Promise<void> => {
    await remove(id);
    if (editing?.id === id) setEditing(null);
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Bookmarks</h1>
        <button className="button" onClick={() => void refresh()} disabled={loading}>
          Refresh
        </button>
      </header>

      <section className="panel">
        <h2>{editing ? 'Edit bookmark' : 'Add bookmark'}</h2>
        <BookmarkForm
          key={editing?.id ?? 'create'}
          initial={editing}
          onCancel={editing ? () => setEditing(null) : undefined}
          onSubmit={(values) =>
            editing ? onUpdate(editing.id, values as UpdateBookmarkInput) : onCreate(values as CreateBookmarkInput)
          }
          submitting={loading}
        />
      </section>

      <section className="panel">
        <h2>All bookmarks</h2>
        {error ? <div className="error">{error}</div> : null}
        <BookmarkList items={items} onEdit={setEditing} onDelete={(id) => void onDelete(id)} />
      </section>

      <footer className="footer">
        <small>API: {apiBaseUrl}</small>
      </footer>
    </div>
  );
};
