import React from 'react';
import { useTodos } from '../hooks/useTodos';
import { TodoItem } from './TodoItem';

/**
 * Renders the list of todo items.
 * It fetches the todos using the useTodos hook and displays them.
 * It also handles loading and error states.
 */
export function TodoList(): React.ReactElement {
  const { data: todos, isLoading, isError, error } = useTodos();

  if (isLoading) {
    return <div>Loading todos...</div>;
  }

  if (isError) {
    return <div>Error fetching todos: {error?.message}</div>;
  }

  return (
    <ul className="todo-list">
      {todos && todos.length > 0 ? (
        todos.map((todo) => <TodoItem key={todo.id} todo={todo} />)
      ) : (
        <p>No todos yet. Add one above!</p>
      )}
    </ul>
  );
}
