import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { unauthorized } from '../utils/httpError';
import { param } from '../utils/params';
import { workdayService } from '../services/workdayService';

const actorOf = (req: Request) => {
  if (!req.user) throw unauthorized('Not authorized');
  return req.user;
};

export const getToday = asyncHandler(async (req: Request, res: Response) => {
  res.json(await workdayService.getToday(actorOf(req)));
});

export const startWorkday = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await workdayService.start(req.body, actorOf(req)));
});

export const updateWorkdayItem = asyncHandler(async (req: Request, res: Response) => {
  res.json(await workdayService.updateItem(param(req, 'itemId'), req.body, actorOf(req)));
});

export const finishWorkday = asyncHandler(async (req: Request, res: Response) => {
  res.json(await workdayService.finish(req.body, actorOf(req)));
});

export const getTeamPulse = asyncHandler(async (req: Request, res: Response) => {
  res.json(await workdayService.getTeam(String(req.query.date || ''), actorOf(req)));
});
