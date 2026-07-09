import api from './index';
import type { UpsertUserPayload } from './userApi';

export interface AuthResponse {
  _id: string;
  name: string;
  email: string;
  role: string;
  token: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  department?: string;
  skills?: string[];
}

export const authApi = {
  // Public self-registration always lands as 'Team Member' (enforced
  // server-side). Super Admin's "Add Member" flow reuses this same endpoint
  // but sends a `role`, which is only honored when the caller is already an
  // authenticated Super Admin - see backend authService.register.
  register: (data: RegisterPayload | (UpsertUserPayload & { password: string })) =>
    api.post<AuthResponse>('/auth/register', data).then((res) => res.data),

  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }).then((res) => res.data),

  me: () => api.get('/auth/me').then((res) => res.data),
};
