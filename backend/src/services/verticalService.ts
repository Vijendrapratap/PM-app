import { verticalRepository } from '../repositories/verticalRepository';
import { userRepository } from '../repositories/userRepository';
import { activityLogRepository } from '../repositories/activityLogRepository';
import { badRequest, forbidden, notFound } from '../utils/httpError';
import { isSuperAdmin, toPlatformRole } from '../utils/roles';

interface Actor { id: string; role: string; organizationId?: string }

const orgOf = (actor: Actor) => {
  if (!actor.organizationId) throw badRequest('Your account is not assigned to an organization');
  return actor.organizationId;
};

const toDto = (row: any) => ({
  _id: row.id, name: row.name, code: row.code, kind: row.kind, active: row.active,
  head: row.head ? { _id: row.head.id, name: row.head.name, email: row.head.email, active: row.head.account_status === 'ACTIVE' } : null,
});

export const verticalService = {
  async list(actor: Actor) {
    return (await verticalRepository.list(orgOf(actor))).map(toDto);
  },

  async update(id: string, patch: { name?: string; ownerUserId?: string | null; active?: boolean }, actor: Actor) {
    if (!isSuperAdmin(actor.role)) throw forbidden('Only the CEO can manage verticals');
    const existing = await verticalRepository.findById(id);
    if (!existing || existing.organization_id !== orgOf(actor)) throw notFound('Vertical not found');
    if (patch.ownerUserId) {
      const head = await userRepository.findById(patch.ownerUserId);
      const platformRole = toPlatformRole(head?.platform_role || head?.role);
      const isEligible = head
        && head.organization_id === orgOf(actor)
        && head.account_status === 'ACTIVE'
        && (platformRole === 'CEO' || platformRole === 'MANAGER');
      if (!isEligible) throw badRequest('A vertical head must be an active manager in your organization');
    }
    const updated = await verticalRepository.update(id, {
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.ownerUserId !== undefined && { owner_user_id: patch.ownerUserId }),
      ...(patch.active !== undefined && { active: patch.active }),
    });
    await activityLogRepository.create({
      action: 'Vertical Updated', user_id: actor.id, details: `Vertical ${updated.name} was updated.`,
      event: { eventType: 'VERTICAL_UPDATED', entityType: 'VERTICAL', entityId: id, payload: patch },
    });
    return toDto(updated);
  },

  // Moving a project into (or out of) a vertical needs authority over the target.
  async assertCanAssign(verticalId: string | null, actor: Actor) {
    if (verticalId === null) {
      if (!isSuperAdmin(actor.role)) throw forbidden('Only the CEO can remove a project from its vertical');
      return;
    }
    const vertical = await verticalRepository.findById(verticalId);
    if (!vertical || vertical.organization_id !== orgOf(actor)) throw badRequest('Unknown vertical');
    if (!isSuperAdmin(actor.role) && vertical.owner_user_id !== actor.id) throw forbidden('Only the CEO or the vertical head can move a project into this vertical');
  },
};
