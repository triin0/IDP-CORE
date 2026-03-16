import React, { useState } from 'react';

export const TodoForm = (props: {
  onAdd: (title: string) => Promise<void>;
  disabled?: boolean;
}): React.JSX.Element => {
  const [title, setTitle] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const disabled = Boolean(props.disabled || submitting);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      await props.onAdd(trimmed);
      setTitle('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} aria-label="Add todo">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs to be done?"
        maxLength={200}
        disabled={disabled}
      />
      <button className="primary" type="submit" disabled={disabled || title.trim().length === 0}>
        Add
      </button>
    </form>
  );
};
