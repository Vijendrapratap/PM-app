import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { projectTaskService } from '../services/projectTaskService';
import { param } from '../utils/params';
import { unauthorized } from '../utils/httpError';

const filesOf = (req: Request): Express.Multer.File[] => (req.files as Express.Multer.File[]) || [];

const actorOf = (req: Request) => {
  if (!req.user) throw unauthorized('Not authorized');
  return req.user;
};

export const getProjectTasks = asyncHandler(async (req: Request, res: Response) => {
  res.json(await projectTaskService.listForProject(param(req, 'id')));
});

export const getMyAssignedTasks = asyncHandler(async (req: Request, res: Response) => {
  res.json(await projectTaskService.listAssignedToUser(actorOf(req).id));
});

export const createProjectTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await projectTaskService.create(
    param(req, 'id'),
    { ...req.body, files: filesOf(req) },
    actorOf(req)
  );
  res.status(201).json(task);
});

export const updateProjectTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await projectTaskService.update(param(req, 'id'), param(req, 'taskId'), req.body, actorOf(req));
  res.json(task);
});

export const deleteProjectTask = asyncHandler(async (req: Request, res: Response) => {
  res.json(await projectTaskService.remove(param(req, 'id'), param(req, 'taskId'), actorOf(req)));
});

export const addProjectTaskSubtask = asyncHandler(async (req: Request, res: Response) => {
  const task = await projectTaskService.addSubtask(
    param(req, 'id'),
    param(req, 'taskId'),
    { ...req.body, files: filesOf(req) },
    actorOf(req)
  );
  res.status(201).json(task);
});

export const updateProjectTaskSubtask = asyncHandler(async (req: Request, res: Response) => {
  const task = await projectTaskService.updateSubtask(
    param(req, 'id'),
    param(req, 'taskId'),
    param(req, 'subId'),
    req.body,
    actorOf(req)
  );
  res.json(task);
});

export const deleteProjectTaskSubtask = asyncHandler(async (req: Request, res: Response) => {
  const task = await projectTaskService.removeSubtask(param(req, 'id'), param(req, 'taskId'), param(req, 'subId'), actorOf(req));
  res.json(task);
});

export const addProjectTaskComment = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await projectTaskService.addComment(param(req, 'id'), param(req, 'taskId'), req.body.body, actorOf(req)));
});

export const addProjectTaskDocuments = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await projectTaskService.addDocuments(param(req, 'id'), param(req, 'taskId'), filesOf(req), actorOf(req)));
});
