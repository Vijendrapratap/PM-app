import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../utils/jwt';
import { canApproveAgentWork, isSuperAdmin, toPlatformRole } from '../utils/roles';
import { projectRepository } from '../repositories/projectRepository';
import { userRepository } from '../repositories/userRepository';
import { param } from '../utils/params';
import { canViewProject } from '../policies/accessPolicy';

// Re-checks the user's current status on every request (not just at login) so
// that deactivating/deleting a user revokes access immediately instead of
// only once their existing 30-day token happens to expire.
export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Not authorized, no token' });
    return;
  }

  try {
    const decoded = verifyToken(header.split(' ')[1]);
    const user = await userRepository.findById(decoded.id);
    if (!user || user.deleted_at || user.status === 'Inactive' || ['INACTIVE', 'SUSPENDED'].includes(user.account_status || '')) {
      res.status(401).json({ message: 'Not authorized, account is inactive' });
      return;
    }
    // Use the database role rather than the role embedded in a potentially
    // month-old token. Role changes must take effect on the next request.
    req.user = {
      id: user.id,
      role: user.role,
      platformRole: toPlatformRole(user.platform_role || user.role),
      organizationId: user.organization_id,
      departmentId: user.department_id,
      timezone: user.timezone || 'Asia/Dubai',
    };
    next();
  } catch {
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

// Populates req.user when a valid token is present, but never rejects the
// request - used on /auth/register, which must work both for the public
// (unauthenticated) self-registration flow and for a logged-in Super Admin
// creating a member directly with a chosen role in one step.
export const optionalAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const decoded = verifyToken(header.split(' ')[1]);
      req.user = { ...decoded, platformRole: toPlatformRole(decoded.role) };
    } catch {
      // Invalid/expired token on an optional route: proceed unauthenticated
      // rather than failing the request.
    }
  }
  next();
};

// Must run after `protect` so req.user is populated.
export const requireRole = (...roles: string[]) => (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403).json({ message: 'You do not have permission to perform this action' });
    return;
  }
  next();
};

export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || !isSuperAdmin(req.user.role)) {
    res.status(403).json({ message: 'Only a Super Admin can perform this action' });
    return;
  }
  next();
};

export const requireManager = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || !canApproveAgentWork(req.user.role)) {
    res.status(403).json({ message: 'Only a Project Manager or Super Admin can perform this action' });
    return;
  }
  next();
};

export const requireProjectAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Not authorized' });
    return;
  }
  if (isSuperAdmin(req.user.platformRole)) {
    next();
    return;
  }
  try {
    const project = await projectRepository.findById(param(req, 'id'));
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    const resource = {
      organizationId: project.organization_id,
      departmentId: project.department_id,
      ownerUserId: project.owner_id,
      members: (project.project_members || []).map((membership: any) => ({
        userId: membership.user?.id,
        projectRole: membership.project_role,
        permissions: membership.permissions_json,
      })),
    };
    if (canViewProject(req.user, resource)) {
      next();
      return;
    }
    res.status(403).json({ message: 'This project is not assigned to you' });
  } catch (error) {
    next(error);
  }
};

export const requireCEO = requireSuperAdmin;
