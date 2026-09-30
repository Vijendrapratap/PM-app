import { useCallback, useEffect, useState } from 'react';
import { userApi } from '../api/userApi';
import type { User } from '../types';
import { useAuth } from '../context/AuthContext';

export const useTeam = () => {
  const { isDemo, user } = useAuth();
  // GET /team requires CEO or MANAGER (requireManager on the backend); a
  // team member always gets a 403 here, so skip the call instead of
  // logging a console error on every page that lists assignable members.
  const canListTeam = user?.platformRole === 'CEO' || user?.platformRole === 'MANAGER';
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    // Demo mode has no real backend session (see AuthContext.startDemo) -
    // fetching here would 401 and force-logout the demo user.
    if (isDemo || !canListTeam) {
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
  }, [isDemo, canListTeam]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { members, loading, refetch };
};
