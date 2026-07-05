import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { userService } from '../services/userService';
import { param } from '../utils/params';

export const getUsers = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await userService.list());
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  res.json(await userService.getById(param(req, 'id')));
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  res.json(await userService.update(param(req, 'id'), req.body));
});

export const deactivateUser = asyncHandler(async (req: Request, res: Response) => {
  res.json(await userService.deactivate(param(req, 'id')));
});
