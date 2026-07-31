export const DEPARTMENTS = [
  'Leadership',
  'Project Management',
  'Engineering',
  'Product & Design',
  'Quality Assurance',
  'Sales & Business Development',
  'Marketing & Growth',
  'Operations',
] as const;

export const departmentLabel = (department?: string | null) =>
  department?.trim() || 'General team';

