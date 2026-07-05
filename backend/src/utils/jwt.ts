import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthenticatedUser } from '../types/express';

export const generateToken = (user: AuthenticatedUser): string =>
  jwt.sign(user, env.jwtSecret, { expiresIn: '30d' });

export const verifyToken = (token: string): AuthenticatedUser =>
  jwt.verify(token, env.jwtSecret) as AuthenticatedUser;
