// `users.role` is the legacy display value used by the existing client.
// `users.platform_role` is the normalized authorization value introduced in
// migration 0010. Accepting both here makes the rollout backward compatible
// while keeping authorization decisions on exactly three platform roles.
export const ROLES = ['Team Member', 'Lead', 'Project Manager', 'Super Admin'] as const;
export type Role = (typeof ROLES)[number];

export const PLATFORM_ROLES = ['CEO', 'MANAGER', 'TEAM_MEMBER'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const SUPER_ADMIN_ROLE: Role = 'Super Admin';
export const DEFAULT_ROLE: Role = 'Team Member';

export const toPlatformRole = (role: string | null | undefined): PlatformRole => {
  if (role === 'CEO' || role === SUPER_ADMIN_ROLE) return 'CEO';
  if (role === 'MANAGER' || role === 'Project Manager' || role === 'Lead') return 'MANAGER';
  return 'TEAM_MEMBER';
};

export const legacyRoleFor = (role: PlatformRole, designation?: string | null): Role => {
  if (role === 'CEO') return SUPER_ADMIN_ROLE;
  if (role === 'MANAGER') return designation?.toLowerCase().includes('lead') ? 'Lead' : 'Project Manager';
  return DEFAULT_ROLE;
};

export const isSuperAdmin = (role: string | undefined): boolean => toPlatformRole(role) === 'CEO';
export const isProjectManager = (role: string | undefined): boolean =>
  toPlatformRole(role) === 'MANAGER' && role !== 'Lead';
export const isLead = (role: string | undefined): boolean => role === 'Lead';
export const isManager = (role: string | undefined): boolean => toPlatformRole(role) === 'MANAGER';
export const canApproveAgentWork = (role: string | undefined): boolean =>
  ['CEO', 'MANAGER'].includes(toPlatformRole(role));
// Kept for existing call sites. New project reads use scoped policy checks;
// this helper only represents authority level, not access to every project.
export const canViewAllProjects = (role: string | undefined): boolean => isSuperAdmin(role);
export const isValidRole = (role: string): role is Role => (ROLES as readonly string[]).includes(role);
export const isValidPlatformRole = (role: string): role is PlatformRole =>
  (PLATFORM_ROLES as readonly string[]).includes(role);
