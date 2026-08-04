import { Request, Response } from 'express';
import { blockerService } from '../services/blockerService';
import { asyncHandler } from '../utils/asyncHandler';
import { unauthorized } from '../utils/httpError';
import { param } from '../utils/params';
import { taskWorkflowService } from '../services/taskWorkflowService';

const actorOf = (req: Request) => {
  if (!req.user) throw unauthorized('Not authorized');
  return req.user;
};
export const reportTaskBlocker = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await blockerService.report(param(req, 'taskId'), req.body, actorOf(req)));
});
export const resolveTaskBlocker = asyncHandler(async (req: Request, res: Response) => {
  res.json(await blockerService.resolve(param(req, 'taskId'), req.body, actorOf(req)));
});
export const startTask = asyncHandler(async (req: Request, res: Response) => res.json(await taskWorkflowService.start(param(req, 'taskId'), actorOf(req))));
export const pauseTask = asyncHandler(async (req: Request, res: Response) => res.json(await taskWorkflowService.pause(param(req, 'taskId'), req.body.note, actorOf(req))));
export const addTaskWorkflowUpdate = asyncHandler(async (req: Request, res: Response) => res.status(201).json(await taskWorkflowService.addUpdate(param(req, 'taskId'), req.body, actorOf(req))));
export const requestTaskReview = asyncHandler(async (req: Request, res: Response) => res.json(await taskWorkflowService.requestReview(param(req, 'taskId'), req.body.reviewerUserId, actorOf(req))));
export const approveTaskReview = asyncHandler(async (req: Request, res: Response) => res.json(await taskWorkflowService.approve(param(req, 'taskId'), req.body.note, actorOf(req))));
export const rejectTaskReview = asyncHandler(async (req: Request, res: Response) => res.json(await taskWorkflowService.reject(param(req, 'taskId'), req.body.note, actorOf(req))));
export const completeTask = asyncHandler(async (req: Request, res: Response) => res.json(await taskWorkflowService.complete(param(req, 'taskId'), req.body, actorOf(req))));
