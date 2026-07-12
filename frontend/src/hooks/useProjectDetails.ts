import { useCallback, useEffect, useState } from 'react';
import { projectApi } from '../api/projectApi';
import type { DailyReport, Project, ProjectUpdate } from '../types';
import { getErrorMessage } from '../utils/errorMessage';

export const useProjectDetails = (id: string | undefined) => {
  const [project, setProject] = useState<Project | null>(null);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const [projectData, updatesData] = await Promise.all([projectApi.getById(id), projectApi.getUpdates(id)]);
      setProject(projectData);
      setUpdates(updatesData);

      try {
        setDailyReports(await projectApi.getDailyReports(id));
      } catch (reportError) {
        console.warn('Daily reports unavailable yet', reportError);
        setDailyReports([]);
      }
    } catch (err) {
      console.error(err);
      setProject(null);
      setError(getErrorMessage(err, 'Project not found.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { project, updates, dailyReports, loading, error, refetch };
};
