import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Bookmark, CreateBookmarkInput, UpdateBookmarkInput } from '@types/bookmark';

type ApiListResponse = { data: Bookmark[] };
type ApiItemResponse = { data: Bookmark };

type State = {
  items: Bookmark[];
  loading: boolean;
  error: string | null;
};

const parseErrorMessage = async (res: Response): Promise<string> => {
  try {
    const data: unknown = await res.json();
    if (
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof (data as { error: unknown }).error === 'object' &&
      (data as { error: { message?: unknown } }).error !== null
    ) {
      const msg = (data as { error: { message?: unknown } }).error.message;
      if (typeof msg === 'string') return msg;
    }
  } catch {
    // ignore
  }
  return `Request failed with status ${res.status}`;
};

export const useBookmarks = (apiBaseUrl: string): {
  items: Bookmark[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: CreateBookmarkInput) => Promise<void>;
  update: (id: string, input: UpdateBookmarkInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
} => {
  const [state, setState] = useState<State>({ items: [], loading: false, error: null });

  const endpoints = useMemo(
    () => ({
      list: `${apiBaseUrl}/bookmarks`,
      item: (id: string) => `${apiBaseUrl}/bookmarks/${encodeURIComponent(id)}`
    }),
    [apiBaseUrl]
  );

  const refresh = useCallback(async (): Promise<void> => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(endpoints.list, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res));
      }
      const json: ApiListResponse = (await res.json()) as ApiListResponse;
      setState({ items: json.data, loading: false, error: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setState((s) => ({ ...s, loading: false, error: message }));
    }
  }, [endpoints.list]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: CreateBookmarkInput): Promise<void> => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetch(endpoints.list, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(input)
        });
        if (!res.ok) throw new Error(await parseErrorMessage(res));
        const json: ApiItemResponse = (await res.json()) as ApiItemResponse;
        setState((s) => ({ items: [json.data, ...s.items], loading: false, error: null }));
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        setState((s) => ({ ...s, loading: false, error: message }));
      }
    },
    [endpoints.list]
  );

  const update = useCallback(
    async (id: string, input: UpdateBookmarkInput): Promise<void> => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetch(endpoints.item(id), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(input)
        });
        if (!res.ok) throw new Error(await parseErrorMessage(res));
        const json: ApiItemResponse = (await res.json()) as ApiItemResponse;
        setState((s) => ({
          items: s.items.map((b) => (b.id === id ? json.data : b)),
          loading: false,
          error: null
        }));
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        setState((s) => ({ ...s, loading: false, error: message }));
      }
    },
    [endpoints]
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetch(endpoints.item(id), { method: 'DELETE' });
        if (!res.ok) throw new Error(await parseErrorMessage(res));
        setState((s) => ({ items: s.items.filter((b) => b.id !== id), loading: false, error: null }));
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        setState((s) => ({ ...s, loading: false, error: message }));
      }
    },
    [endpoints]
  );

  return {
    items: state.items,
    loading: state.loading,
    error: state.error,
    refresh,
    create,
    update,
    remove
  };
};
