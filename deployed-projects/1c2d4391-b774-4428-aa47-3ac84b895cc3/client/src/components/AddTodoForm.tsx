import React, { useState } from 'react';
import { useAddTodo } from '../hooks/useTodos';

/**
 * A form for adding new todo items.
 * It maintains the state for the input field and uses the useAddTodo mutation
 * to create a new todo on the server when submitted.
 */
export function AddTodoForm(): React.ReactElement {
  const [text, setText] = useState('');
  const addTodoMutation = useAddTodo();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!text.trim()) return;

    addTodoMutation.mutate(
      { text },
      {
        onSuccess: () => {
          setText(''); // Reset input field on success
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="add-todo-form">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What needs to be done?"
        disabled={addTodoMutation.isPending}
      />
      <button type="submit" disabled={addTodoMutation.isPending}>
        {addTodoMutation.isPending ? 'Adding...' : 'Add Todo'}
      </button>
    </form>
  );
}
