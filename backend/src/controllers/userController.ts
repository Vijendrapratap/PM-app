import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { userService } from '../services/userService';
import { param } from '../utils/params';
import { unauthorized } from '../utils/httpError';

const actorOf = (req: Request) => { if (!req.user) throw unauthorized('Not authorized'); return req.user; };

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  res.json(await userService.list(actorOf(req)));
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  res.json(await userService.getById(param(req, 'id'), actorOf(req)));
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  res.json(await userService.update(param(req, 'id'), req.body, req.user?.id));
});

export const deactivateUser = asyncHandler(async (req: Request, res: Response) => {
  res.json(await userService.deactivate(param(req, 'id'), req.user?.id));
});

export const activateUser = asyncHandler(async (req: Request, res: Response) => {
  res.json(await userService.activate(param(req, 'id'), req.user?.id));
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  res.json(await userService.delete(param(req, 'id'), req.user?.id));
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  res.json(await userService.resetPassword(param(req, 'id'), req.body.password, req.user?.id));
});
export const completeOnboarding = asyncHandler(async (req: Request, res: Response) => {
  res.json(await userService.completeOnboarding(req.body, actorOf(req).id));
});
