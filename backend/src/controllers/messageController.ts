import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { messageService } from '../services/messageService';
import { param } from '../utils/params';
import { unauthorized } from '../utils/httpError';

export const getMessages = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await messageService.list());
});

export const getActiveMessages = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await messageService.listActive());
});

export const createMessage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized('Not authorized');
  res.status(201).json(await messageService.create(req.body, req.user.id));
});

export const updateMessage = asyncHandler(async (req: Request, res: Response) => {
  res.json(await messageService.update(param(req, 'id'), req.body));
});

export const deleteMessage = asyncHandler(async (req: Request, res: Response) => {
  res.json(await messageService.remove(param(req, 'id')));
});
