import { isSuperAdmin } from '../utils/roles';

export const canCreateTodoFor = (actor: { id: string; role: string }, assignedTo: string) =>
  isSuperAdmin(actor.role) || assignedTo === actor.id;
