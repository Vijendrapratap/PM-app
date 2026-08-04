import { Request, Response } from 'express';
import { departmentService } from '../services/departmentService';
import { asyncHandler } from '../utils/asyncHandler';
import { unauthorized } from '../utils/httpError';
import { param } from '../utils/params';

const actorOf = (req: Request) => {
  if (!req.user) throw unauthorized('Not authorized');
  return req.user;
};

export const listDepartments = asyncHandler(async (req: Request, res: Response) => {
  res.json(await departmentService.list(actorOf(req), req.query.includeInactive === 'true'));
});

export const createDepartment = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await departmentService.create(req.body, actorOf(req)));
});

export const updateDepartment = asyncHandler(async (req: Request, res: Response) => {
  res.json(await departmentService.update(param(req, 'id'), req.body, actorOf(req)));
});

export const deactivateDepartment = asyncHandler(async (req: Request, res: Response) => {
  res.json(await departmentService.deactivate(param(req, 'id'), actorOf(req)));
});
