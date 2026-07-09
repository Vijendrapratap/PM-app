import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { todoService } from '../services/todoService';
import { param } from '../utils/params';
import { unauthorized } from '../utils/httpError';

const filesOf = (req: Request): Express.Multer.File[] => (req.files as Express.Multer.File[]) || [];

const actorOf = (req: Request) => {
  if (!req.user) throw unauthorized('Not authorized');
  return req.user;
};

export const getMyTodos = asyncHandler(async (req: Request, res: Response) => {
  res.json(await todoService.listMine(actorOf(req).id));
});

export const getTodaysTodo = asyncHandler(async (req: Request, res: Response) => {
  res.json(await todoService.getToday(actorOf(req).id));
});

export const getAssignedSubtasks = asyncHandler(async (req: Request, res: Response) => {
  res.json(await todoService.getAssignedSubtasks(actorOf(req).id));
});

export const createTodo = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await todoService.create({ ...req.body, files: filesOf(req) }, actorOf(req)));
});

export const updateTodo = asyncHandler(async (req: Request, res: Response) => {
  res.json(await todoService.update(param(req, 'id'), req.body, actorOf(req)));
});

export const deleteTodo = asyncHandler(async (req: Request, res: Response) => {
  res.json(await todoService.remove(param(req, 'id'), actorOf(req)));
});

export const addSubtask = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await todoService.addSubtask(param(req, 'id'), { ...req.body, files: filesOf(req) }, actorOf(req)));
});

export const updateSubtask = asyncHandler(async (req: Request, res: Response) => {
  res.json(await todoService.updateSubtask(param(req, 'id'), param(req, 'subId'), req.body, actorOf(req)));
});

export const deleteSubtask = asyncHandler(async (req: Request, res: Response) => {
  res.json(await todoService.removeSubtask(param(req, 'id'), param(req, 'subId'), actorOf(req)));
});
