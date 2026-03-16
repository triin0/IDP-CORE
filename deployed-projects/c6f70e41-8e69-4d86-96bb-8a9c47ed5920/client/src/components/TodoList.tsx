import type { Todo } from '../../../types/todo.js';
import { TodoItem } from './TodoItem.js';

export const TodoList = (props: {
  todos: Todo[];
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}): JSX.Element => {
  const { todos, onToggle, onDelete } = props;

  if (todos.length === 0) {
    return <div className="muted">No todos yet. Add one above.</div>;
  }

  return (
    <div className="list">
      {todos.map((t) => (
        <TodoItem key={t.id} todo={t} onToggle={onToggle} onDelete={onDelete} />
      ))}
    </div>
  );
};
