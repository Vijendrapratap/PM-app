import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { unauthorized } from '../utils/httpError';
import { dailyWorkService } from '../services/dailyWorkService';

const actorOf = (req: Request) => { if (!req.user) throw unauthorized('Not authorized'); return req.user; };
export const getCurrentDailyWork = asyncHandler(async (req: Request, res: Response) => res.json(await dailyWorkService.current(actorOf(req))));
export const getDailyWorkHistory = asyncHandler(async (req: Request, res: Response) => res.json(await dailyWorkService.history(String(req.query.month || ''), actorOf(req))));
export const startDailyWork = asyncHandler(async (req: Request, res: Response) => res.status(201).json(await dailyWorkService.start(actorOf(req))));
export const endDailyWork = asyncHandler(async (req: Request, res: Response) => res.json(await dailyWorkService.end(actorOf(req))));
export const addDailyWorkLog = asyncHandler(async (req: Request, res: Response) => res.status(201).json(await dailyWorkService.addLog(req.body, actorOf(req))));
export const getAdminDailyWork = asyncHandler(async (req: Request, res: Response) => res.json(await dailyWorkService.admin({ date: String(req.query.date || '') || undefined, startDate: String(req.query.startDate || '') || undefined, endDate: String(req.query.endDate || '') || undefined, userId: String(req.query.userId || '') || undefined, status: String(req.query.status || '') || undefined, projectId: String(req.query.projectId || '') || undefined }, actorOf(req))));