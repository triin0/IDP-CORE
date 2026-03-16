import { useEffect, useMemo, useState } from 'react';
import type { HelloResponse } from '../../../types/api.js';

type State = {
  loading: boolean;
  data: HelloResponse | null;
  error: string | null;
};

export const useHello = (name?: string): State => {
  const [state, setState] = useState<State>({ loading: true, data: null, error: null });

  const url = useMemo(() => {
    const u = new URL('/api/hello', window.location.origin);
    if (name) u.searchParams.set('name', name);
    return u.toString();
  }, [name]);

  useEffect(() => {
    const ctrl = new AbortController();

    const run = async (): Promise<void> => {
      setState({ loading: true, data: null, error: null });
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: ctrl.signal
        });

        if (!res.ok) {
          const text = await res.text();
          setState({ loading: false, data: null, error: text || `Request failed: ${res.status}` });
          return;
        }

        const json = (await res.json()) as HelloResponse;
        setState({ loading: false, data: json, error: null });
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setState({ loading: false, data: null, error: 'Network error.' });
      }
    };

    void run();
    return () => ctrl.abort();
  }, [url]);

  return state;
};
