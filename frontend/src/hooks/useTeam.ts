import { useCallback, useEffect, useState } from 'react';
import { userApi } from '../api/userApi';
import type { User } from '../types';

export const useTeam = () => {
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setMembers(await userApi.list());
    } catch (error) {
      console.error('Failed to fetch team', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { members, loading, refetch };
};
