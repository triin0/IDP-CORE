import React from 'react';
import { type Todo } from '../types';
import { useUpdateTodo, useDeleteTodo } from '../hooks/useTodos';

interface TodoItemProps {
  todo: Todo;
}

/**
 * Renders a single todo item.
 * It displays the todo text and provides controls for marking it as complete
 * and for deleting it.
 */
export function TodoItem({ todo }: TodoItemProps): React.ReactElement {
  const updateTodoMutation = useUpdateTodo();
  const deleteTodoMutation = useDeleteTodo();

  const handleToggleCompleted = (): void => {
    updateTodoMutation.mutate({ id: todo.id, completed: !todo.completed });
  };

  const handleDelete = (): void => {
    deleteTodoMutation.mutate(todo.id);
  };

  return (
    <li className={`todo-item ${todo.completed ? 'completed' : ''}`}>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={handleToggleCompleted}
        disabled={updateTodoMutation.isPending}
      />
      <span className="todo-item-text">{todo.text}</span>
      <div className="todo-item-actions">
        <button onClick={handleDelete} disabled={deleteTodoMutation.isPending}>
          Delete
        </button>
      </div>
    </li>
  );
}
