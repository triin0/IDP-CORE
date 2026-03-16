import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ApiErrorResponse, ApiSuccessResponse, Todo } from '../../../types/todo.js';

const asErrorMessage = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  return 'Unknown error';
};

const getApiBaseUrl = (): string => {
  const v = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return v && v.length > 0 ? v : 'http://localhost:4000/api';
};

const parseErrorResponse = async (res: Response): Promise<string> => {
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return `${res.status} ${res.statusText}`;
  }
  const json = (await res.json()) as Partial<ApiErrorResponse>;
  return json.error?.message ?? `${res.status} ${res.statusText}`;
};

export const useTodos = (): {
  todos: Todo[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addTodo: (title: string) => Promise<void>;
  toggleTodo: (id: string, completed: boolean) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
} => {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/todos`, { method: 'GET' });
      if (!res.ok) throw new Error(await parseErrorResponse(res));
      const json = (await res.json()) as ApiSuccessResponse<Todo[]>;
      setTodos(json.data);
    } catch (e) {
      setError(asErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  const addTodo = useCallback(
    async (title: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/todos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title })
        });
        if (!res.ok) throw new Error(await parseErrorResponse(res));
        const json = (await res.json()) as ApiSuccessResponse<Todo>;
        setTodos((prev) => [...prev, json.data]);
      } catch (e) {
        setError(asErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl]
  );

  const toggleTodo = useCallback(
    async (id: string, completed: boolean): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/todos/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed })
        });
        if (!res.ok) throw new Error(await parseErrorResponse(res));
        const json = (await res.json()) as ApiSuccessResponse<Todo>;
        setTodos((prev) => prev.map((t) => (t.id === id ? json.data : t)));
      } catch (e) {
        setError(asErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl]
  );

  const deleteTodo = useCallback(
    async (id: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/todos/${encodeURIComponent(id)}`, {
          method: 'DELETE'
        });
        if (!res.ok && res.status !== 204) throw new Error(await parseErrorResponse(res));
        setTodos((prev) => prev.filter((t) => t.id !== id));
      } catch (e) {
        setError(asErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { todos, loading, error, refresh, addTodo, toggleTodo, deleteTodo };
};
