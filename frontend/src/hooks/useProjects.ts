import { useCallback, useEffect, useState } from 'react';
import { projectApi } from '../api/projectApi';
import type { Project } from '../types';
import { getErrorMessage } from '../utils/errorMessage';

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setProjects(await projectApi.list());
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load projects'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { projects, loading, error, refetch };
};
