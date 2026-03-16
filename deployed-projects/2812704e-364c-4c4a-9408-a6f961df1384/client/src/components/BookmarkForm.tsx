import React, { useMemo, useState } from 'react';
import type { Bookmark, CreateBookmarkInput, UpdateBookmarkInput } from '@types/bookmark';

type Props = {
  initial: Bookmark | null;
  onSubmit: (values: CreateBookmarkInput | UpdateBookmarkInput) => Promise<void>;
  onCancel?: () => void;
  submitting: boolean;
};

const parseTags = (raw: string): string[] => {
  const tags = raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return Array.from(new Set(tags));
};

export const BookmarkForm = ({ initial, onSubmit, onCancel, submitting }: Props): React.ReactElement => {
  const [title, setTitle] = useState<string>(initial?.title ?? '');
  const [url, setUrl] = useState<string>(initial?.url ?? '');
  const [description, setDescription] = useState<string>(initial?.description ?? '');
  const [tagsRaw, setTagsRaw] = useState<string>((initial?.tags ?? []).join(', '));
  const [error, setError] = useState<string | null>(null);

  const isEdit = useMemo(() => Boolean(initial), [initial]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (!isEdit) {
      // Create requires title + url.
      if (title.trim().length === 0) {
        setError('Title is required');
        return;
      }
      if (url.trim().length === 0) {
        setError('URL is required');
        return;
      }
    }

    const tags = parseTags(tagsRaw);

    const payload = isEdit
      ? ({
          title: title.trim() ? title.trim() : undefined,
          url: url.trim() ? url.trim() : undefined,
          description: description.trim().length > 0 ? description : null,
          tags
        } satisfies UpdateBookmarkInput)
      : ({
          title: title.trim(),
          url: url.trim(),
          description: description.trim().length > 0 ? description : null,
          tags
        } satisfies CreateBookmarkInput);

    try {
      await onSubmit(payload);
      if (!isEdit) {
        setTitle('');
        setUrl('');
        setDescription('');
        setTagsRaw('');
      }
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Failed to submit');
    }
  };

  return (
    <form className="form" onSubmit={(e) => void handleSubmit(e)}>
      {error ? <div className="error">{error}</div> : null}

      <label className="label">
        Title
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Example" />
      </label>

      <label className="label">
        URL
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
      </label>

      <label className="label">
        Description
        <textarea
          className="textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional"
          rows={3}
        />
      </label>

      <label className="label">
        Tags (comma-separated)
        <input className="input" value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="work, reading" />
      </label>

      <div className="actions">
        <button className="button primary" type="submit" disabled={submitting}>
          {isEdit ? 'Save' : 'Create'}
        </button>
        {onCancel ? (
          <button className="button" type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        ) : null}
      </div>

      <p className="hint">
        Note: When editing, leaving Title/URL empty will keep them unchanged.
      </p>
    </form>
  );
};
