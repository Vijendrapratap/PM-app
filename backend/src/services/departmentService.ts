import { departmentRepository, type DepartmentInput } from '../repositories/departmentRepository';
import { activityLogRepository } from '../repositories/activityLogRepository';
import { badRequest, forbidden, notFound } from '../utils/httpError';
import { isSuperAdmin } from '../utils/roles';

interface Actor {
  id: string;
  role: string;
  organizationId?: string;
}

const requireOrganization = (actor: Actor) => {
  if (!actor.organizationId) throw badRequest('Your account is not assigned to an organization');
  return actor.organizationId;
};

const requireCEO = (actor: Actor) => {
  if (!isSuperAdmin(actor.role)) throw forbidden('Only the CEO can manage departments');
};

const codeFor = (value: string) => value
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const toDto = (row: any) => ({
  _id: row.id,
  name: row.name,
  code: row.code,
  type: row.type,
  active: row.active,
  lead: row.lead ? { _id: row.lead.id, name: row.lead.name, email: row.lead.email, role: row.lead.role, designation: row.lead.designation } : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const departmentService = {
  async list(actor: Actor, includeInactive = false) {
    return (await departmentRepository.list(requireOrganization(actor), includeInactive && isSuperAdmin(actor.role))).map(toDto);
  },

  async create(input: Omit<DepartmentInput, 'code'> & { code?: string }, actor: Actor) {
    requireCEO(actor);
    const organizationId = requireOrganization(actor);
    const code = codeFor(input.code || input.name);
    if (!code) throw badRequest('Department code is required');
    if (await departmentRepository.findByCode(organizationId, code)) throw badRequest('Department code already exists');
    const department = await departmentRepository.create(organizationId, { ...input, code });
    await activityLogRepository.create({
      action: 'Department Created',
      user_id: actor.id,
      details: `Department ${department.name} was created.`,
      event: { eventType: 'DEPARTMENT_CREATED', entityType: 'DEPARTMENT', entityId: department.id, departmentId: department.id },
    });
    return toDto(department);
  },

  async update(id: string, patch: Partial<DepartmentInput>, actor: Actor) {
    requireCEO(actor);
    const existing = await departmentRepository.findById(id);
    if (!existing || existing.organization_id !== requireOrganization(actor)) throw notFound('Department not found');
    const normalized = { ...patch, ...(patch.code && { code: codeFor(patch.code) }) };
    const updated = await departmentRepository.update(id, normalized);
    if (!updated) throw notFound('Department not found');
    await activityLogRepository.create({
      action: 'Department Updated',
      user_id: actor.id,
      details: `Department ${updated.name} was updated.`,
      event: { eventType: 'DEPARTMENT_UPDATED', entityType: 'DEPARTMENT', entityId: id, departmentId: id, payload: normalized },
    });
    return toDto(updated);
  },

  async deactivate(id: string, actor: Actor) {
    return this.update(id, { active: false }, actor);
  },
};
