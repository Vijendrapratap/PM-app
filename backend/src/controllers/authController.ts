import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authService } from '../services/authService';
import { unauthorized } from '../utils/httpError';

export const registerUser = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body, req.user?.role);
  res.status(201).json(result);
});

export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  res.json(result);
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized('Not authorized');
  const user = await authService.getMe(req.user.id);
  res.json(user);
});
