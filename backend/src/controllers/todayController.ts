import { Request, Response } from 'express';
import { todayService } from '../services/todayService';
import { asyncHandler } from '../utils/asyncHandler';
import { unauthorized } from '../utils/httpError';

export const getTodayDashboard = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized('Not authorized');
  res.json(await todayService.get(req.user));
});
