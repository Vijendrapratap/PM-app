import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ideaService } from '../services/ideaService';
import { param } from '../utils/params';
import { unauthorized } from '../utils/httpError';

export const getIdeas = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await ideaService.list());
});

export const createIdea = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized('Not authorized');
  res.status(201).json(await ideaService.create(req.body, req.user.id));
});

export const deleteIdea = asyncHandler(async (req: Request, res: Response) => {
  res.json(await ideaService.remove(param(req, 'id')));
});
