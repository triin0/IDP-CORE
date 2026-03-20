import { useState, useEffect, useCallback } from 'react';
import { getEntities, createEntity } from '../lib/api';
import { Entity, NewEntity } from '../types';

export function useEntities() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEntities = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getEntities();
      setEntities(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  const addEntity = useCallback(async (entity: NewEntity) => {
    try {
      const newEntity = await createEntity(entity);
      setEntities(prev => [newEntity, ...prev]);
    } catch (err) {
      console.error("Failed to add entity:", err);
      // Optionally re-throw or handle UI feedback
    }
  }, []);

  return { entities, isLoading, error, refetch: fetchEntities, addEntity };
}
