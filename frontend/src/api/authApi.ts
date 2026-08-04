import api from './index';
import type { UpsertUserPayload } from './userApi';

export interface AuthResponse {
  _id: string;
  name: string;
  email: string;
  role: string;
  platformRole?: 'CEO' | 'MANAGER' | 'TEAM_MEMBER';
  designation?: string | null;
  department?: string | null;
  photo?: string | null;
  onboardingRequired?: boolean;
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
  // CEO-only account creation. The API rejects unauthenticated and non-CEO
  // requests even if a caller manipulates the client.
  register: (data: RegisterPayload | (UpsertUserPayload & { password: string })) =>
    api.post<AuthResponse>('/auth/register', data).then((res) => res.data),

  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }).then((res) => res.data),

  me: () => api.get('/auth/me').then((res) => res.data),

  completeOnboarding: (data: { timezone: string; typicalWorkStart?: string; typicalWorkEnd?: string; notificationPreference?: 'IMMEDIATE_AND_DIGEST' | 'DIGEST_ONLY' }) =>
    api.post('/team/onboarding', data).then((res) => res.data),
};
