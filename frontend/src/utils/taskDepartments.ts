import type { DailyTodo } from '../api/todoApi';

export type TaskDepartment = 'DEVELOPMENT' | 'MARKETING' | 'SALES' | 'OPERATIONS' | 'FINANCE' | 'PERSONAL';

export const TASK_DEPARTMENTS: Array<{ key: TaskDepartment; label: string }> = [
  { key: 'SALES', label: 'Sales' },
  { key: 'MARKETING', label: 'Marketing' },
  { key: 'OPERATIONS', label: 'Operations' },
  { key: 'FINANCE', label: 'Finance' },
  { key: 'DEVELOPMENT', label: 'Development' },
  { key: 'PERSONAL', label: 'Personal' },
];

export const taskDepartment = (todo: DailyTodo): TaskDepartment => {
  const department = todo.project?.department?.trim().toLowerCase() || '';
  if (department.includes('finance') || department.includes('account')) return 'FINANCE';
  if (department.includes('sales') || department.includes('business development')) return 'SALES';
  if (department.includes('marketing') || department.includes('growth') || department.includes('content')) return 'MARKETING';
  if (department.includes('operation') || department.includes('leadership') || department.includes('admin') || department.includes('people')) return 'OPERATIONS';
  if (department.includes('development') || department.includes('engineering') || department.includes('product') || department.includes('design') || department.includes('quality')) return 'DEVELOPMENT';
  if (todo.source !== 'PROJECT' && todo.domainType === 'PERSONAL') return 'PERSONAL';
  return todo.domainType === 'SALES' || todo.domainType === 'MARKETING' || todo.domainType === 'OPERATIONS'
    ? todo.domainType
    : 'DEVELOPMENT';
};

export const taskDepartmentLabel = (todo: DailyTodo) =>
  TASK_DEPARTMENTS.find((item) => item.key === taskDepartment(todo))?.label || 'Development';
