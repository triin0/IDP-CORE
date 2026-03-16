import React, { useMemo, useState } from 'react';
import { TodoForm } from './components/TodoForm.js';
import { TodoList } from './components/TodoList.js';
import { useTodos } from './hooks/useTodos.js';

export const App = (): React.JSX.Element => {
  const { todos, loading, error, addTodo, toggleTodo, deleteTodo, refresh } = useTodos();
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const filtered = useMemo(() => {
    if (filter === 'active') return todos.filter((t) => !t.completed);
    if (filter === 'completed') return todos.filter((t) => t.completed);
    return todos;
  }, [todos, filter]);

  return (
    <div className="page">
      <div className="card">
        <header className="header">
          <h1>Todos</h1>
          <button className="secondary" onClick={refresh} disabled={loading} type="button">
            Refresh
          </button>
        </header>

        <TodoForm onAdd={addTodo} disabled={loading} />

        <div className="toolbar">
          <div className="segmented">
            <button
              type="button"
              className={filter === 'all' ? 'active' : ''}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={filter === 'active' ? 'active' : ''}
              onClick={() => setFilter('active')}
            >
              Active
            </button>
            <button
              type="button"
              className={filter === 'completed' ? 'active' : ''}
              onClick={() => setFilter('completed')}
            >
              Completed
            </button>
          </div>

          <div className="meta">
            <span>{todos.filter((t) => !t.completed).length} remaining</span>
          </div>
        </div>

        {error ? (
          <div className="error" role="alert">
            {error}
          </div>
        ) : null}

        <TodoList
          todos={filtered}
          onToggle={(id, completed) => toggleTodo(id, completed)}
          onDelete={(id) => deleteTodo(id)}
          disabled={loading}
        />

        {loading ? <div className="loading">Loading…</div> : null}
      </div>

      <footer className="footer">
        <small>
          API: <code>{import.meta.env.VITE_API_BASE_URL}</code>
        </small>
      </footer>
    </div>
  );
};
