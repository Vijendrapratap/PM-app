import { useCallback, useEffect, useState } from 'react';
import { todoApi, type DailyTodo } from '../api/todoApi';
import { getErrorMessage } from '../utils/errorMessage';

export const useDailyTodos = () => {
  const [todos, setTodos] = useState<DailyTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setTodos(await todoApi.listMine());
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load your to-do list'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { todos, loading, error, refetch };
};
