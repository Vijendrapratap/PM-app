export const ROLES = ['Team Member', 'Lead', 'Project Manager', 'Super Admin'] as const;
export type Role = (typeof ROLES)[number];

export const SUPER_ADMIN_ROLE: Role = 'Super Admin';

export const isSuperAdmin = (role: string | undefined): boolean => role === SUPER_ADMIN_ROLE;
export const isProjectManager = (role: string | undefined): boolean => role === 'Project Manager';
export const isLead = (role: string | undefined): boolean => role === 'Lead';
export const canApproveAgentWork = (role: string | undefined): boolean => isSuperAdmin(role) || isProjectManager(role);
