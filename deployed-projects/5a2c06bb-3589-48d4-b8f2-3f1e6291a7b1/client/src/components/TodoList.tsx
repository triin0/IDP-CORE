import React from 'react';
import type { Todo } from '../../../types/todo.js';

export const TodoList = (props: {
  todos: Todo[];
  onToggle: (id: string, completed: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  disabled?: boolean;
}): React.JSX.Element => {
  if (props.todos.length === 0) {
    return <div className="loading">No todos yet.</div>;
  }

  return (
    <ul className="list" aria-label="Todo list">
      {props.todos.map((t) => (
        <li key={t.id} className="item">
          <label>
            <input
              type="checkbox"
              checked={t.completed}
              onChange={(e) => props.onToggle(t.id, e.target.checked)}
              disabled={props.disabled}
              aria-label={t.completed ? 'Mark as incomplete' : 'Mark as complete'}
            />
            <span className={t.completed ? 'title completed' : 'title'}>{t.title}</span>
          </label>
          <button
            className="danger"
            type="button"
            onClick={() => props.onDelete(t.id)}
            disabled={props.disabled}
            aria-label="Delete todo"
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
};
