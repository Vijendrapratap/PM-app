import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { notificationService } from '../services/notificationService';
import { param } from '../utils/params';
import { unauthorized } from '../utils/httpError';

const actorOf = (req: Request) => {
  if (!req.user) throw unauthorized('Not authorized');
  return req.user;
};

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  res.json(await notificationService.list(actorOf(req).id));
});

export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  res.json(await notificationService.unreadCount(actorOf(req).id));
});

export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  res.json(await notificationService.markRead(param(req, 'id'), actorOf(req).id));
});

export const markAllNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  res.json(await notificationService.markAllRead(actorOf(req).id));
});
