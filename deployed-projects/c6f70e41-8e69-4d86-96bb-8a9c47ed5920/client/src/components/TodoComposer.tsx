import { useMemo, useState } from 'react';

export const TodoComposer = (props: { onCreate: (title: string) => Promise<void> }): JSX.Element => {
  const { onCreate } = props;
  const [title, setTitle] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const canSubmit = useMemo(() => title.trim().length > 0 && !submitting, [title, submitting]);

  const submit = async (): Promise<void> => {
    const t = title.trim();
    if (!t) return;

    setSubmitting(true);
    try {
      await onCreate(t);
      setTitle('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="row">
      <input
        className="input"
        value={title}
        placeholder="Add a todo..."
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
        }}
        aria-label="Todo title"
      />
      <button className="button" disabled={!canSubmit} onClick={() => void submit()}>
        {submitting ? 'Adding...' : 'Add'}
      </button>
    </div>
  );
};
