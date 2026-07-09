import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../utils/jwt';
import { isSuperAdmin } from '../utils/roles';

export const protect = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Not authorized, no token' });
    return;
  }

  try {
    req.user = verifyToken(header.split(' ')[1]);
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
      req.user = verifyToken(header.split(' ')[1]);
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
