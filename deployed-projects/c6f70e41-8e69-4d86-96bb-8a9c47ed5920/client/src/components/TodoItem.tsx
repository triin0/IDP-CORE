import type { Todo } from '../../../types/todo.js';

export const TodoItem = (props: {
  todo: Todo;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}): JSX.Element => {
  const { todo, onToggle, onDelete } = props;

  return (
    <div className="item">
      <div className="itemTitle">
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={(e) => onToggle(todo.id, e.target.checked)}
          aria-label={`Mark ${todo.title} as ${todo.completed ? 'incomplete' : 'complete'}`}
        />
        <div style={{ minWidth: 0 }}>
          <div className="titleText" style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
            {todo.title}
          </div>
          <div className="muted">Updated: {new Date(todo.updatedAt).toLocaleString()}</div>
        </div>
      </div>

      <div className="row">
        <button className="button danger" onClick={() => onDelete(todo.id)}>
          Delete
        </button>
      </div>
    </div>
  );
};
