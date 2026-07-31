// `users.role` is free text at the DB level (see 0001_init.sql), but the app
// only recognizes these three. Keep this the single source of truth so the
// register/update validators, the seed script, and the frontend role pickers
// can't drift out of sync with each other.
export const ROLES = ['Team Member', 'Lead', 'Project Manager', 'Super Admin'] as const;
export type Role = (typeof ROLES)[number];

export const SUPER_ADMIN_ROLE: Role = 'Super Admin';
export const DEFAULT_ROLE: Role = 'Team Member';

export const isSuperAdmin = (role: string | undefined): boolean => role === SUPER_ADMIN_ROLE;
export const isProjectManager = (role: string | undefined): boolean => role === 'Project Manager';
export const isLead = (role: string | undefined): boolean => role === 'Lead';
export const canApproveAgentWork = (role: string | undefined): boolean => isSuperAdmin(role) || isProjectManager(role);
export const canViewAllProjects = (role: string | undefined): boolean => canApproveAgentWork(role);
export const isValidRole = (role: string): role is Role => (ROLES as readonly string[]).includes(role);
