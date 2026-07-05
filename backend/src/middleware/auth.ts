import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../utils/jwt';

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
