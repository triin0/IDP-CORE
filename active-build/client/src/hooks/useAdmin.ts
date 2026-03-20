import { useState, useEffect, useCallback } from 'react';
import { getAdminTable, createAdminRecord, updateAdminRecord, deleteAdminRecord } from '../lib/api';
import { AdminRecord } from '../types';

export function useAdmin(tableName: string) {
  const [data, setData] = useState<AdminRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!tableName) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getAdminTable(tableName);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [tableName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addRecord = async (record: Omit<AdminRecord, 'id'>) => {
    const newRecord = await createAdminRecord(tableName, record);
    setData(prev => [newRecord, ...prev]);
  };

  const updateRecord = async (id: number | string, record: Partial<AdminRecord>) => {
    const updatedRecord = await updateAdminRecord(tableName, id, record);
    setData(prev => prev.map(r => (r.id === id ? updatedRecord : r)));
  };

  const removeRecord = async (id: number | string) => {
    await deleteAdminRecord(tableName, id);
    setData(prev => prev.filter(r => r.id !== id));
  };

  return { data, isLoading, error, refetch: fetchData, addRecord, updateRecord, removeRecord };
}
