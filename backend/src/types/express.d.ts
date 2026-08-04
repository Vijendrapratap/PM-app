import 'express';

export interface AuthenticatedUser {
  id: string;
  role: string;
  platformRole: 'CEO' | 'MANAGER' | 'TEAM_MEMBER';
  organizationId?: string;
  departmentId?: string | null;
  timezone?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
