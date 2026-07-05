import { useCallback, useEffect, useState } from 'react';
import { projectApi } from '../api/projectApi';
import type { DailyReport, Project, ProjectUpdate } from '../types';

export const useProjectDetails = (id: string | undefined) => {
  const [project, setProject] = useState<Project | null>(null);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!id) return;
    try {
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
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { project, updates, dailyReports, loading, refetch };
};
