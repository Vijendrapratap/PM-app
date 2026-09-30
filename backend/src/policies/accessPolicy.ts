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
  verticalOwnerUserId?: string | null;
  members: ProjectMembershipPolicy[];
}

const isSameOrganization = (actor: PolicyActor, resource: ProjectPolicyResource) =>
  !actor.organizationId || !resource.organizationId || actor.organizationId === resource.organizationId;

const membershipFor = (actor: PolicyActor, resource: ProjectPolicyResource) =>
  resource.members.find((member) => member.userId === actor.id);

// The one place a project row becomes a policy resource. PROJECT_SELECT joins `vertical`.
export const toPolicyResource = (project: any): ProjectPolicyResource => ({
  organizationId: project.organization_id,
  departmentId: project.department_id,
  ownerUserId: project.owner_id,
  verticalOwnerUserId: project.vertical?.owner_user_id ?? null,
  members: (project.project_members || []).map((membership: any) => ({
    userId: membership.user?.id,
    projectRole: membership.project_role,
    permissions: membership.permissions_json,
  })),
});

export const canInviteUsers = (actor: PolicyActor) => isSuperAdmin(actor.role);

export const canViewProject = (actor: PolicyActor, resource: ProjectPolicyResource) => {
  if (!isSameOrganization(actor, resource)) return false;
  if (isSuperAdmin(actor.role) || isManager(actor.role)) return true;
  return resource.ownerUserId === actor.id || Boolean(membershipFor(actor, resource));
};

export const canManageProject = (actor: PolicyActor, resource: ProjectPolicyResource) => {
  if (!isSameOrganization(actor, resource)) return false;
  if (isSuperAdmin(actor.role)) return true;
  if (!isManager(actor.role)) return false;
  if (resource.ownerUserId === actor.id) return true;
  if (resource.verticalOwnerUserId && resource.verticalOwnerUserId === actor.id) return true;
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
