import { TodoComposer } from './components/TodoComposer.js';
import { TodoList } from './components/TodoList.js';
import { useTodos } from './hooks/useTodos.js';

export const App = (): JSX.Element => {
  const { state, refresh, createTodo, toggleTodo, deleteTodo } = useTodos();

  return (
    <div className="container">
      <div className="header">
        <h1 style={{ margin: 0, letterSpacing: '-0.02em' }}>Todos</h1>
        <button className="button secondary" onClick={() => void refresh()} disabled={state.loading}>
          Refresh
        </button>
      </div>

      <div className="card">
        <TodoComposer onCreate={createTodo} />

        <div style={{ height: 14 }} />

        {state.loading ? (
          <div className="muted">Loading...</div>
        ) : (
          <TodoList todos={state.todos} onToggle={toggleTodo} onDelete={deleteTodo} />
        )}

        {state.error ? <div className="error">{state.error}</div> : null}
      </div>

      <div className="muted" style={{ marginTop: 14 }}>
        API: <code>{import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api'}</code>
      </div>
    </div>
  );
};
