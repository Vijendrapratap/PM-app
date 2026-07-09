import bcrypt from 'bcrypt';
import { userRepository } from '../repositories/userRepository';
import { notFound, badRequest } from '../utils/httpError';
import { User } from '../types/models';
import { SUPER_ADMIN_ROLE } from '../utils/roles';

interface UserWithProjects extends User {
  project_members?: { project: { id: string; name: string; status: string } | null }[];
}

// Mirrors the old Mongoose API contract (`_id`) since the frontend reads it throughout.
const toDto = (user: UserWithProjects) => ({
  _id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
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
  async list() {
    const users = await userRepository.list();
    return users.map(toDto);
  },

  async getById(id: string) {
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
      department: string;
      phone: string;
      status: 'Active' | 'Inactive';
      availability: 'Available' | 'Busy' | 'On Leave';
      skills: string[];
    }>
  ) {
    const updated = await userRepository.update(id, patch);
    if (!updated) throw notFound('User not found');
    return { _id: updated.id, name: updated.name, role: updated.role, department: updated.department };
  },

  async deactivate(id: string) {
    await this.assertNotLastActiveSuperAdmin(id, 'deactivate');
    const updated = await userRepository.update(id, { status: 'Inactive', availability: 'On Leave' });
    if (!updated) throw notFound('User not found');
    return { message: 'User deactivated successfully' };
  },

  async activate(id: string) {
    const updated = await userRepository.update(id, { status: 'Active' });
    if (!updated) throw notFound('User not found');
    return { message: 'User activated successfully' };
  },

  async delete(id: string) {
    await this.assertNotLastActiveSuperAdmin(id, 'delete');
    const deleted = await userRepository.softDelete(id);
    if (!deleted) throw notFound('User not found');
    // Historical records (daily reports, updates, project ownership, project
    // tasks) keep referencing this row via their existing foreign keys, so
    // their author/owner/assignee names still resolve - the user just
    // disappears from active lists and pickers.
    return { message: 'Team member deleted successfully' };
  },

  async resetPassword(id: string, password: string) {
    const user = await userRepository.findById(id);
    if (!user) throw notFound('User not found');
    const passwordHash = await bcrypt.hash(password, 10);
    await userRepository.update(id, { password_hash: passwordHash });
    return { message: 'Password reset successfully' };
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
