import bcrypt from 'bcrypt';
import { userRepository } from '../repositories/userRepository';
import { notFound, badRequest } from '../utils/httpError';
import { User } from '../types/models';
import { SUPER_ADMIN_ROLE } from '../utils/roles';
import { legacyRoleFor, toPlatformRole } from '../utils/roles';
import { activityLogRepository } from '../repositories/activityLogRepository';
import { projectRepository } from '../repositories/projectRepository';
import { forbidden } from '../utils/httpError';
import { isSuperAdmin } from '../utils/roles';

interface UserWithProjects extends User {
  project_members?: { project: { id: string; name: string; status: string } | null }[];
}

// Mirrors the old Mongoose API contract (`_id`) since the frontend reads it throughout.
const toDto = (user: UserWithProjects) => ({
  _id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  platformRole: user.platform_role || toPlatformRole(user.role),
  designation: user.designation,
  departmentId: user.department_id,
  managerUserId: user.manager_user_id,
  timezone: user.timezone,
  dailyCapacityMinutes: user.daily_capacity_minutes,
  onboardingCompletedAt: user.onboarding_completed_at,
  department: user.department,
  phone: user.phone,
  skills: user.skills,
  status: user.status,
  availability: user.availability,
  photo: user.photo,
  assignedProjects: (user.project_members || [])
    .map((pm) => pm.project)
    .filter((project): project is { id: string; name: string; status: string } => Boolean(project)),
  lastLoginAt: user.last_login_at,
  createdAt: user.created_at,
  updatedAt: user.updated_at,
});

export const userService = {
  async list(actor: { id: string; role: string; organizationId?: string; departmentId?: string | null }) {
    const users = await userRepository.list(actor.organizationId);
    if (isSuperAdmin(actor.role)) return users.map(toDto);
    const projects = await projectRepository.findForUser(actor.id);
    const scopedIds = new Set<string>([actor.id]);
    projects.forEach((project: any) => {
      const manages = project.owner_id === actor.id || (project.project_members || []).some((membership: any) => membership.user?.id === actor.id && (membership.project_role === 'MANAGER' || membership.permissions_json?.manageProject));
      if (manages) (project.project_members || []).forEach((membership: any) => membership.user?.id && scopedIds.add(membership.user.id));
    });
    return users.filter((user: any) => scopedIds.has(user.id) || (actor.departmentId && user.department_id === actor.departmentId)).map(toDto);
  },

  async getById(id: string, actor: { id: string; role: string; organizationId?: string; departmentId?: string | null }) {
    const allowed = await this.list(actor);
    if (!allowed.some((user: any) => user._id === id)) throw forbidden('This team member is outside your managed scope');
    const user = await userRepository.findByIdWithProjects(id);
    if (!user) throw notFound('User not found');
    return toDto(user);
  },

  async update(
    id: string,
    patch: Partial<{
      name: string;
      email: string;
      role: string;
      designation: string;
      department: string;
      phone: string;
      status: 'Active' | 'Inactive';
      availability: 'Available' | 'Busy' | 'On Leave';
      skills: string[];
    }>,
    actorId?: string,
  ) {
    const normalized = {
      ...patch,
      ...(patch.role !== undefined && {
        role: legacyRoleFor(toPlatformRole(patch.role), patch.designation || patch.role),
        platform_role: toPlatformRole(patch.role),
      }),
    };
    const updated = await userRepository.update(id, normalized);
    if (!updated) throw notFound('User not found');
    if (actorId) await activityLogRepository.create({
      action: 'User Updated', user_id: actorId, details: `${updated.name}'s profile was updated.`,
      event: { eventType: 'USER_UPDATED', entityType: 'USER', entityId: id, payload: { changedFields: Object.keys(patch) } },
    });
    return { _id: updated.id, name: updated.name, role: updated.role, platformRole: updated.platform_role, designation: updated.designation, department: updated.department };
  },

  async deactivate(id: string, actorId?: string) {
    await this.assertNotLastActiveSuperAdmin(id, 'deactivate');
    const updated = await userRepository.update(id, { status: 'Inactive', availability: 'On Leave' });
    if (!updated) throw notFound('User not found');
    if (actorId) await activityLogRepository.create({ action: 'User Deactivated', user_id: actorId, details: `${updated.name} was deactivated.`, event: { eventType: 'USER_DEACTIVATED', entityType: 'USER', entityId: id } });
    return { message: 'User deactivated successfully' };
  },

  async activate(id: string, actorId?: string) {
    const updated = await userRepository.update(id, { status: 'Active' });
    if (!updated) throw notFound('User not found');
    if (actorId) await activityLogRepository.create({ action: 'User Activated', user_id: actorId, details: `${updated.name} was activated.`, event: { eventType: 'USER_ACTIVATED', entityType: 'USER', entityId: id } });
    return { message: 'User activated successfully' };
  },

  async delete(id: string, actorId?: string) {
    await this.assertNotLastActiveSuperAdmin(id, 'delete');
    const deleted = await userRepository.softDelete(id);
    if (!deleted) throw notFound('User not found');
    if (actorId) await activityLogRepository.create({ action: 'User Archived', user_id: actorId, details: `${deleted.name} was archived.`, event: { eventType: 'USER_ARCHIVED', entityType: 'USER', entityId: id } });
    // Historical records (daily reports, updates, project ownership, project
    // tasks) keep referencing this row via their existing foreign keys, so
    // their author/owner/assignee names still resolve - the user just
    // disappears from active lists and pickers.
    return { message: 'Team member deleted successfully' };
  },

  async resetPassword(id: string, password: string, actorId?: string) {
    const user = await userRepository.findById(id);
    if (!user) throw notFound('User not found');
    const passwordHash = await bcrypt.hash(password, 10);
    await userRepository.update(id, { password_hash: passwordHash });
    if (actorId) await activityLogRepository.create({ action: 'User Password Reset', user_id: actorId, details: `${user.name}'s password was reset by the CEO.`, event: { eventType: 'USER_PASSWORD_RESET', entityType: 'USER', entityId: id } });
    return { message: 'Password reset successfully' };
  },

  async completeOnboarding(input: { timezone: string; typicalWorkStart?: string; typicalWorkEnd?: string; notificationPreference?: 'IMMEDIATE_AND_DIGEST' | 'DIGEST_ONLY' }, actorId: string) {
    const updated = await userRepository.update(actorId, {
      timezone: input.timezone,
      typical_work_start: input.typicalWorkStart || null,
      typical_work_end: input.typicalWorkEnd || null,
      notification_preferences_json: {
        digest: true,
        immediateCritical: input.notificationPreference !== 'DIGEST_ONLY',
      },
      onboarding_completed_at: new Date().toISOString(),
      account_status: 'ACTIVE',
    });
    if (!updated) throw notFound('User not found');
    await activityLogRepository.create({ action: 'User Activated', user_id: actorId, details: `${updated.name} completed onboarding.`, event: { eventType: 'USER_ACTIVATED', entityType: 'USER', entityId: actorId, payload: { onboarding: true } } });
    return toDto(updated);
  },

  async assertNotLastActiveSuperAdmin(id: string, action: 'deactivate' | 'delete') {
    const target = await userRepository.findById(id);
    if (target && target.role === SUPER_ADMIN_ROLE && target.status === 'Active') {
      const others = await userRepository.countOtherActiveSuperAdmins(id);
      if (others === 0) {
        throw badRequest(`Cannot ${action} the only active Super Admin.`);
      }
    }
  },
};
