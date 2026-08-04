import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { forbidden, notFound, unauthorized } from '../utils/httpError';
import { param } from '../utils/params';
import { workdayService } from '../services/workdayService';
import { workSessionService } from '../services/workSessionService';

const actorOf = (req: Request) => {
  if (!req.user) throw unauthorized('Not authorized');
  return req.user;
};

export const getToday = asyncHandler(async (req: Request, res: Response) => {
  res.json(await workdayService.getToday(actorOf(req)));
});

export const getCarryover = asyncHandler(async (req: Request, res: Response) => {
  res.json(await workdayService.getCarryover(actorOf(req)));
});

export const getDailyPlan = asyncHandler(async (req: Request, res: Response) => {
  res.json(await workdayService.getById(param(req, 'id'), actorOf(req)));
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

export const closeDailyPlan = asyncHandler(async (req: Request, res: Response) => {
  const actor = actorOf(req);
  await workdayService.getById(param(req, 'id'), actor);
  const today = await workdayService.getToday(actor);
  if (!today || today._id !== param(req, 'id')) throw forbidden('Only the active daily plan can be closed');
  res.json(await workdayService.finish(req.body, actor));
});

export const startDailyPlan = asyncHandler(async (req: Request, res: Response) => {
  const actor = actorOf(req);
  const plan = await workdayService.getById(param(req, 'id'), actor);
  if (!plan) throw notFound('Daily plan not found');
  await workSessionService.start({ dailyPlanId: plan._id }, actor);
  res.json(plan);
});

export const reopenDailyPlan = asyncHandler(async (req: Request, res: Response) => {
  res.json(await workdayService.reopen(param(req, 'id'), actorOf(req)));
});

export const getTeamPulse = asyncHandler(async (req: Request, res: Response) => {
  res.json(await workdayService.getTeam(String(req.query.date || ''), actorOf(req)));
});
