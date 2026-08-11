import { useCallback, useEffect, useState } from 'react';
import { todoApi, type DailyTodo } from '../api/todoApi';
import { getErrorMessage } from '../utils/errorMessage';
import { useAuth } from '../context/AuthContext';
import { getDemoTasks } from '../context/demoTasks';
import { projectTaskApi } from '../api/projectTaskApi';
import type { AssignedProjectTask, ProjectTask } from '../api/projectTaskApi';
import { projectApi } from '../api/projectApi';

export type DailyTodoScope = 'mine' | 'team';

const projectTaskToTodo = (
  task: AssignedProjectTask | ProjectTask,
  project: { _id: string; name: string; department?: string | null } | null,
  fallbackAssignee?: { _id: string; name: string } | null,
): DailyTodo => ({
  _id: task._id,
  title: task.title,
  description: 'description' in task ? task.description : null,
  dueDate: task.dueDate,
  originalDueDate: task.dueDate,
  carryForwardCount: 0,
  daysOverdue: task.dueDate && task.status !== 'Completed'
    ? Math.max(0, Math.floor((Date.now() - new Date(`${task.dueDate}T00:00:00`).getTime()) / 86400000))
    : 0,
  priority: task.priority,
  status: task.status,
  assignedTo: 'assignedTo' in task ? task.assignedTo : fallbackAssignee || null,
  createdBy: 'createdBy' in task ? task.createdBy : null,
  completedAt: task.completedAt,
  documents: 'documents' in task ? task.documents : [],
  subtasks: [],
  createdAt: 'createdAt' in task ? task.createdAt : task.completedAt || new Date().toISOString(),
  updatedAt: 'updatedAt' in task ? task.updatedAt : task.completedAt || new Date().toISOString(),
  domainType: 'DEVELOPMENT',
  workType: 'TASK',
  recurrence: 'NONE',
  scheduledStart: null,
  scheduledEnd: null,
  meetingWith: null,
  channel: null,
  expectedMinutes: task.estimateMinutes || 60,
  source: 'PROJECT',
  project,
});

export const useDailyTodos = (scope: DailyTodoScope = 'mine') => {
  const { isDemo, user } = useAuth();
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
      const [personalResult, projectResult] = await Promise.allSettled([
        todoApi.listMine(),
        scope === 'team'
          ? projectApi.list().then(async (projects) => (await Promise.all(projects
            .filter((project) => !project.archived && project.status !== 'Completed')
            .map(async (project) => ({ project, tasks: await projectTaskApi.list(project._id) }))))
            .flatMap(({ project, tasks }) => tasks.map((task) => projectTaskToTodo(task, {
              _id: project._id,
              name: project.name,
              department: project.department,
            }))))
          : projectTaskApi.assignedToMe().then((tasks) => tasks.map((task) => projectTaskToTodo(
            task,
            task.project,
            user ? { _id: user._id, name: user.name } : null,
          ))),
      ]);
      if (personalResult.status === 'rejected' && projectResult.status === 'rejected') throw personalResult.reason;
      const personal = personalResult.status === 'fulfilled' ? personalResult.value : [];
      const projectTasks = projectResult.status === 'fulfilled' ? projectResult.value : [];
      setTodos([
        ...projectTasks,
        ...personal.map((task) => ({ ...task, source: 'PERSONAL' as const, project: null })),
      ]);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load your to-do list'));
    } finally {
      setLoading(false);
    }
  }, [isDemo, scope, user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const addTodo = useCallback((todo: DailyTodo) => {
    setTodos((current) => [todo, ...current.filter((item) => item._id !== todo._id)]);
  }, []);

  return { todos, loading, error, refetch, addTodo };
};
