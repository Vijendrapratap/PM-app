import bcrypt from 'bcrypt';
import { userRepository } from '../repositories/userRepository';
import { generateToken } from '../utils/jwt';
import { badRequest, unauthorized } from '../utils/httpError';
import { DEFAULT_ROLE, isSuperAdmin, isValidRole } from '../utils/roles';

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role?: string;
  department?: string;
  phone?: string;
  skills?: string[];
}

const toAuthResponse = (user: { id: string; name: string; email: string; role: string }) => ({
  _id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  token: generateToken({ id: user.id, role: user.role }),
});

export const authService = {
  // `actorRole` is the role of whoever is calling this (undefined for a public,
  // unauthenticated self-registration). Only a Super Admin caller may choose a
  // role for the new account - everyone else always gets 'Team Member',
  // regardless of what the request body asks for. This is enforced here, not
  // just hidden in the UI, since the endpoint is public.
  async register(input: RegisterInput, actorRole?: string) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw badRequest('User already exists');
    }

    let role = DEFAULT_ROLE;
    if (isSuperAdmin(actorRole) && input.role) {
      if (!isValidRole(input.role)) throw badRequest('Invalid role');
      role = input.role;
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      password_hash: passwordHash,
      role,
      department: input.department,
      phone: input.phone,
      skills: input.skills,
    });

    return toAuthResponse(user);
  },

  async login(email: string, password: string) {
    const user = await userRepository.findByEmail(email);
    if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
      throw unauthorized('Invalid email or password');
    }
    if (user.deleted_at) throw unauthorized('Invalid email or password');
    await userRepository.update(user.id, { last_login_at: new Date().toISOString() });
    return toAuthResponse(user);
  },

  async getMe(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw unauthorized('User not found');
    return { _id: user.id, name: user.name, email: user.email, role: user.role, department: user.department };
  },
};
