import api from './index';
import type { UpsertUserPayload } from './userApi';

export interface AuthResponse {
  _id: string;
  name: string;
  email: string;
  role: string;
  token: string;
}

export const authApi = {
  register: (data: UpsertUserPayload & { password: string }) =>
    api.post<AuthResponse>('/auth/register', data).then((res) => res.data),

  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }).then((res) => res.data),

  me: () => api.get('/auth/me').then((res) => res.data),
};
