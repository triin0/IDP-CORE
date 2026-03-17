// This file contains the shared TypeScript types for the application.
// Ideally, these would be generated from a shared schema (like Zod)
// to ensure consistency between the client and server.

/**
 * Represents a single todo item.
 */
export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string | null; // Date comes as a string from JSON
  updatedAt: string | null; // Date comes as a string from JSON
}

/**
 * The shape of the data needed to create a new todo.
 */
export type NewTodo = Pick<Todo, 'text'>;

/**
 * The shape of the data for updating a todo.
 * Includes the ID and any optional fields to update.
 */
export interface UpdateTodoPayload {
    id: string;
    text?: string;
    completed?: boolean;
}
