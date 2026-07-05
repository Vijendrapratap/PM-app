import bcrypt from 'bcrypt';
import { userRepository } from '../repositories/userRepository';
import { generateToken } from '../utils/jwt';
import { badRequest, unauthorized } from '../utils/httpError';

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: string;
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
  async register(input: RegisterInput) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw badRequest('User already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      password_hash: passwordHash,
      role: input.role,
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
    return toAuthResponse(user);
  },

  async getMe(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw unauthorized('User not found');
    return { _id: user.id, name: user.name, email: user.email, role: user.role, department: user.department };
  },
};
