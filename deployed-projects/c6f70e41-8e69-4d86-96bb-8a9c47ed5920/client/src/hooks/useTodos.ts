import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ApiErrorResponse, Todo } from '../../../types/todo.js';
import { env } from '../env.js';

type TodosState = {
  loading: boolean;
  todos: Todo[];
  error: string | null;
};

const isApiErrorResponse = (v: unknown): v is ApiErrorResponse => {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.error !== 'object' || o.error === null) return false;
  const e = o.error as Record<string, unknown>;
  return typeof e.code === 'string' && typeof e.message === 'string';
};

const readErrorMessage = async (res: Response): Promise<string> => {
  try {
    const data: unknown = await res.json();
    if (isApiErrorResponse(data)) return `${data.error.message} (${data.error.code})`;
    return `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
};

export const useTodos = (): {
  state: TodosState;
  refresh: () => Promise<void>;
  createTodo: (title: string) => Promise<void>;
  toggleTodo: (id: string, completed: boolean) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
} => {
  const [state, setState] = useState<TodosState>({ loading: true, todos: [], error: null });

  const base = useMemo(() => env.apiBaseUrl.replace(/\/$/, ''), []);

  const refresh = useCallback(async (): Promise<void> => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const res = await fetch(`${base}/todos`, { credentials: 'include' });
    if (!res.ok) {
      const msg = await readErrorMessage(res);
      setState({ loading: false, todos: [], error: msg });
      return;
    }
    const data = (await res.json()) as { todos: Todo[] };
    setState({ loading: false, todos: data.todos, error: null });
  }, [base]);

  const createTodo = useCallback(
    async (title: string): Promise<void> => {
      const res = await fetch(`${base}/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title })
      });
      if (!res.ok) {
        const msg = await readErrorMessage(res);
        setState((s) => ({ ...s, error: msg }));
        return;
      }
      await refresh();
    },
    [base, refresh]
  );

  const toggleTodo = useCallback(
    async (id: string, completed: boolean): Promise<void> => {
      const res = await fetch(`${base}/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ completed })
      });
      if (!res.ok) {
        const msg = await readErrorMessage(res);
        setState((s) => ({ ...s, error: msg }));
        return;
      }
      await refresh();
    },
    [base, refresh]
  );

  const deleteTodo = useCallback(
    async (id: string): Promise<void> => {
      const res = await fetch(`${base}/todos/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok && res.status !== 204) {
        const msg = await readErrorMessage(res);
        setState((s) => ({ ...s, error: msg }));
        return;
      }
      await refresh();
    },
    [base, refresh]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { state, refresh, createTodo, toggleTodo, deleteTodo };
};
