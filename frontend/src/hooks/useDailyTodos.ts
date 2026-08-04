import { useCallback, useEffect, useState } from 'react';
import { todoApi, type DailyTodo } from '../api/todoApi';
import { getErrorMessage } from '../utils/errorMessage';
import { useAuth } from '../context/AuthContext';
import { getDemoTasks } from '../context/demoTasks';
import { projectTaskApi } from '../api/projectTaskApi';

export const useDailyTodos = () => {
  const { isDemo } = useAuth();
  const [todos, setTodos] = useState<DailyTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (isDemo) {
      setTodos(getDemoTasks());
      setError(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [personalResult, projectResult] = await Promise.allSettled([todoApi.listMine(), projectTaskApi.assignedToMe()]);
      if (personalResult.status === 'rejected' && projectResult.status === 'rejected') throw personalResult.reason;
      const personal = personalResult.status === 'fulfilled' ? personalResult.value : [];
      const projectTasks = projectResult.status === 'fulfilled' ? projectResult.value : [];
      setTodos([
        ...projectTasks.map((task) => ({
          ...task,
          description: null,
          originalDueDate: task.dueDate,
          carryForwardCount: 0,
          daysOverdue: task.dueDate && task.status !== 'Completed' ? Math.max(0, Math.floor((Date.now() - new Date(task.dueDate).getTime()) / 86400000)) : 0,
          assignedTo: null,
          createdBy: null,
          documents: [],
          subtasks: [],
          createdAt: task.completedAt || new Date().toISOString(),
          updatedAt: task.completedAt || new Date().toISOString(),
          domainType: (task.project?.department || '').toUpperCase() === 'MARKETING' ? 'MARKETING' as const : (task.project?.department || '').toUpperCase() === 'SALES' ? 'SALES' as const : 'DEVELOPMENT' as const,
          workType: 'TASK' as const,
          recurrence: 'NONE' as const,
          scheduledStart: null,
          scheduledEnd: null,
          meetingWith: null,
          channel: null,
          source: 'PROJECT' as const,
        })),
        ...personal.map((task) => ({ ...task, source: 'PERSONAL' as const, project: null })),
      ]);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load your to-do list'));
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const addTodo = useCallback((todo: DailyTodo) => {
    setTodos((current) => [todo, ...current.filter((item) => item._id !== todo._id)]);
  }, []);

  return { todos, loading, error, refetch, addTodo };
};
