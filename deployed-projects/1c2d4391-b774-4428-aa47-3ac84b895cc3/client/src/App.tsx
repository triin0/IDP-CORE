import React from 'react';
import { TodoList } from './components/TodoList';
import { AddTodoForm } from './components/AddTodoForm';

/**
 * The main application component.
 * It renders the main layout, including the title, the form to add new todos,
 * and the list of existing todos.
 */
function App(): React.ReactElement {
  return (
    <div className="container">
      <header>
        <h1>Todo List</h1>
        <p>A full-stack application with React, Express, and Drizzle.</p>
      </header>
      <main>
        <AddTodoForm />
        <TodoList />
      </main>
      <footer>
        <p>Built following the "Golden Path" architecture.</p>
      </footer>
    </div>
  );
}

export default App;
