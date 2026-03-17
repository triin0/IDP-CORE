import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTodos, createTodo, updateTodo, deleteTodo } from '../lib/apiClient';
import { type Todo, type NewTodo, type UpdateTodoPayload } from '../types';

const TODOS_QUERY_KEY = 'todos';

/**
 * Custom hook to fetch all todos.
 * @returns The result of the useQuery hook for the todos list.
 */
export function useTodos() {
  return useQuery<Todo[], Error>({
    queryKey: [TODOS_QUERY_KEY],
    queryFn: fetchTodos,
  });
}

/**
 * Custom hook for the mutation to add a new todo.
 * It invalidates the todos query cache on success to refetch the list.
 * @returns The result of the useMutation hook for adding a todo.
 */
export function useAddTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newTodo: NewTodo) => createTodo(newTodo),
    onSuccess: () => {
      // Invalidate and refetch the todos query
      queryClient.invalidateQueries({ queryKey: [TODOS_QUERY_KEY] });
    },
  });
}

/**
 * Custom hook for the mutation to update an existing todo.
 * It optimistically updates the local cache and invalidates the query on success.
 * @returns The result of the useMutation hook for updating a todo.
 */
export function useUpdateTodo() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: UpdateTodoPayload) => updateTodo(payload.id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [TODOS_QUERY_KEY] });
        },
    });
}

/**
 * Custom hook for the mutation to delete a todo.
 * It invalidates the todos query cache on success.
 * @returns The result of the useMutation hook for deleting a todo.
 */
export function useDeleteTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTodo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TODOS_QUERY_KEY] });
    },
  });
}
