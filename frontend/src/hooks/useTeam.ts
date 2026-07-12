import { useCallback, useEffect, useState } from 'react';
import { userApi } from '../api/userApi';
import type { User } from '../types';
import { useAuth } from '../context/AuthContext';

export const useTeam = () => {
  const { isDemo } = useAuth();
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    // Demo mode has no real backend session (see AuthContext.startDemo) -
    // fetching here would 401 and force-logout the demo user.
    if (isDemo) {
      setMembers([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setMembers(await userApi.list());
    } catch (error) {
      console.error('Failed to fetch team', error);
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { members, loading, refetch };
};
