import { userRepository } from '../repositories/userRepository';
import { notFound } from '../utils/httpError';
import { User } from '../types/models';

// Mirrors the old Mongoose API contract (`_id`) since the frontend reads it throughout.
const toDto = (user: User) => ({
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
  createdAt: user.created_at,
  updatedAt: user.updated_at,
});

export const userService = {
  async list() {
    const users = await userRepository.list();
    return users.map(toDto);
  },

  async getById(id: string) {
    const user = await userRepository.findById(id);
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
    const updated = await userRepository.update(id, { status: 'Inactive', availability: 'On Leave' });
    if (!updated) throw notFound('User not found');
    return { message: 'User deactivated successfully' };
  },
};
