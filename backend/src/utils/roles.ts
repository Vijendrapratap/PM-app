// `users.role` is free text at the DB level (see 0001_init.sql), but the app
// only recognizes these three. Keep this the single source of truth so the
// register/update validators, the seed script, and the frontend role pickers
// can't drift out of sync with each other.
export const ROLES = ['Team Member', 'Project Manager', 'Super Admin'] as const;
export type Role = (typeof ROLES)[number];

export const SUPER_ADMIN_ROLE: Role = 'Super Admin';
export const DEFAULT_ROLE: Role = 'Team Member';

export const isSuperAdmin = (role: string | undefined): boolean => role === SUPER_ADMIN_ROLE;
export const isValidRole = (role: string): role is Role => (ROLES as readonly string[]).includes(role);
