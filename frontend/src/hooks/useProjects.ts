import { useCallback, useEffect, useState } from 'react';
import { projectApi } from '../api/projectApi';
import type { Project } from '../types';
import { getErrorMessage } from '../utils/errorMessage';
import { useAuth } from '../context/AuthContext';

export const useProjects = (includeArchived = false) => {
  const { isDemo } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    // Demo mode has no real backend session (see AuthContext.startDemo) -
    // fetching here would 401 and force-logout the demo user.
    if (isDemo) {
      setProjects([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setProjects(await projectApi.list(includeArchived));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load projects'));
    } finally {
      setLoading(false);
    }
  }, [includeArchived, isDemo]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { projects, loading, error, refetch };
};
