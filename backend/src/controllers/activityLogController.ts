import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { activityLogRepository } from '../repositories/activityLogRepository';

const mapEntry = (row: any) => ({
  _id: row.id,
  action: row.action,
  details: row.details,
  actor: row.actor ? { _id: row.actor.id, name: row.actor.name, photo: row.actor.photo } : null,
  project: row.project ? { _id: row.project.id, name: row.project.name } : null,
  createdAt: row.created_at,
});

export const getRecentActivity = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 15, 50);
  const rows = await activityLogRepository.findRecent(limit);
  res.json(rows.map(mapEntry));
});
