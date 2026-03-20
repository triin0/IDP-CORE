import { useState, useEffect, useCallback } from 'react';
import { getTransactions, createTransaction } from '../lib/api';
import { Transaction, NewTransaction } from '../types';

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTransactions();
      setTransactions(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const addTransaction = useCallback(async (transaction: NewTransaction) => {
    try {
      const newTransaction = await createTransaction(transaction);
      // Refetch to get populated entity names
      fetchTransactions();
    } catch (err) {
      console.error("Failed to add transaction:", err);
    }
  }, [fetchTransactions]);

  return { transactions, isLoading, error, refetch: fetchTransactions, addTransaction };
}
