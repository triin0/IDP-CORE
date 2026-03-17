import axios from 'axios';
import { type Todo, type NewTodo, type UpdateTodoPayload } from '../types';

// Create an Axios instance with a base URL for all API requests.
const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Fetches all todo items from the server.
 * @returns A promise that resolves to an array of Todo objects.
 */
export const fetchTodos = async (): Promise<Todo[]> => {
  const response = await apiClient.get('/todos');
  return response.data;
};

/**
 * Creates a new todo item on the server.
 * @param newTodo - The data for the new todo.
 * @returns A promise that resolves to the newly created Todo object.
 */
export const createTodo = async (newTodo: NewTodo): Promise<Todo> => {
  const response = await apiClient.post('/todos', newTodo);
  return response.data;
};

/**
 * Updates an existing todo item on the server.
 * @param id - The ID of the todo to update.
 * @param updates - The fields to update.
 * @returns A promise that resolves to the updated Todo object.
 */
export const updateTodo = async (id: string, updates: Omit<UpdateTodoPayload, 'id'>): Promise<Todo> => {
  const response = await apiClient.put(`/todos/${id}`, updates);
  return response.data;
};

/**
 * Deletes a todo item from the server.
 * @param id - The ID of the todo to delete.
 * @returns A promise that resolves when the deletion is complete.
 */
export const deleteTodo = async (id: string): Promise<void> => {
  await apiClient.delete(`/todos/${id}`);
};
