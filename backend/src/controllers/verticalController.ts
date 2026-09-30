import { Request, Response } from 'express';
import { verticalService } from '../services/verticalService';
import { asyncHandler } from '../utils/asyncHandler';
import { unauthorized } from '../utils/httpError';
import { param } from '../utils/params';

const actorOf = (req: Request) => {
  if (!req.user) throw unauthorized('Not authorized');
  return req.user;
};

export const listVerticals = asyncHandler(async (req: Request, res: Response) => res.json(await verticalService.list(actorOf(req))));
export const updateVertical = asyncHandler(async (req: Request, res: Response) => res.json(await verticalService.update(param(req, 'id'), req.body, actorOf(req))));
