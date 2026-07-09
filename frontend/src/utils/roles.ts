export const ROLES = ['Team Member', 'Project Manager', 'Super Admin'] as const;
export type Role = (typeof ROLES)[number];

export const SUPER_ADMIN_ROLE: Role = 'Super Admin';

export const isSuperAdmin = (role: string | undefined): boolean => role === SUPER_ADMIN_ROLE;
