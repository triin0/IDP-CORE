import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../lib/api';

export function useAdminTable<T extends { id: number }>(tableName: string) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!tableName) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await adminApi.list<T>(tableName);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to fetch ${tableName}`);
    } finally {
      setIsLoading(false);
    }
  }, [tableName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createItem = async (item: Omit<T, 'id' | 'createdAt'>) => {
    await adminApi.create(tableName, item);
    await fetchData();
  };

  const updateItem = async (id: number, item: Partial<T>) => {
    await adminApi.update(tableName, id, item);
    await fetchData();
  };

  const deleteItem = async (id: number) => {
    await adminApi.delete(tableName, id);
    setData(prevData => prevData.filter(item => item.id !== id));
  };

  return { data, isLoading, error, createItem, updateItem, deleteItem, refetch: fetchData };
}
