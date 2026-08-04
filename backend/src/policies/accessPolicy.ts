import { isManager, isSuperAdmin } from '../utils/roles';

export interface PolicyActor {
  id: string;
  role: string;
  organizationId?: string;
  departmentId?: string | null;
}

export interface ProjectMembershipPolicy {
  userId: string;
  projectRole?: string | null;
  permissions?: Record<string, boolean> | null;
}

export interface ProjectPolicyResource {
  organizationId?: string;
  departmentId?: string | null;
  ownerUserId: string;
  members: ProjectMembershipPolicy[];
}

const isSameOrganization = (actor: PolicyActor, resource: ProjectPolicyResource) =>
  !actor.organizationId || !resource.organizationId || actor.organizationId === resource.organizationId;

const membershipFor = (actor: PolicyActor, resource: ProjectPolicyResource) =>
  resource.members.find((member) => member.userId === actor.id);

export const canInviteUsers = (actor: PolicyActor) => isSuperAdmin(actor.role);

export const canViewProject = (actor: PolicyActor, resource: ProjectPolicyResource) => {
  if (!isSameOrganization(actor, resource)) return false;
  if (isSuperAdmin(actor.role)) return true;
  return resource.ownerUserId === actor.id || Boolean(membershipFor(actor, resource));
};

export const canManageProject = (actor: PolicyActor, resource: ProjectPolicyResource) => {
  if (!isSameOrganization(actor, resource)) return false;
  if (isSuperAdmin(actor.role)) return true;
  if (!isManager(actor.role)) return false;
  if (resource.ownerUserId === actor.id) return true;
  const membership = membershipFor(actor, resource);
  return Boolean(
    membership && (
      membership.projectRole === 'MANAGER' ||
      membership.permissions?.manageProject ||
      membership.permissions?.manageTasks
    )
  );
};

export const canUpdateTask = (
  actor: PolicyActor,
  resource: ProjectPolicyResource,
  taskOwnerUserId: string | null | undefined,
) => canManageProject(actor, resource) || (canViewProject(actor, resource) && taskOwnerUserId === actor.id);

export const canApplyStructuralAgentProposal = (actor: PolicyActor, resource: ProjectPolicyResource) =>
  canManageProject(actor, resource);
