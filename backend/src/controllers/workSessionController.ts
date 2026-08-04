import { Request, Response } from 'express';
import { workSessionService } from '../services/workSessionService';
import { asyncHandler } from '../utils/asyncHandler';
import { unauthorized } from '../utils/httpError';
import { param } from '../utils/params';

const actorOf = (req: Request) => {
  if (!req.user) throw unauthorized('Not authorized');
  return req.user;
};

export const startWorkSession = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await workSessionService.start(req.body, actorOf(req)));
});
export const getWorkSessionSummary = asyncHandler(async (req: Request, res: Response) => {
  res.json(await workSessionService.summary(String(req.query.dailyPlanId || ''), actorOf(req)));
});
export const pauseWorkSession = asyncHandler(async (req: Request, res: Response) => {
  res.json(await workSessionService.stop(param(req, 'id'), 'PAUSED', actorOf(req)));
});
export const closeWorkSession = asyncHandler(async (req: Request, res: Response) => {
  res.json(await workSessionService.stop(param(req, 'id'), 'CLOSED', actorOf(req)));
});
export const noteWorkSession = asyncHandler(async (req: Request, res: Response) => {
  res.json(await workSessionService.note(param(req, 'id'), req.body.note, actorOf(req)));
});
