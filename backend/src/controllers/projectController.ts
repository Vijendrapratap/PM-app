import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { projectService } from '../services/projectService';
import { param } from '../utils/params';

const filesOf = (req: Request): Express.Multer.File[] => (req.files as Express.Multer.File[]) || [];

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.createProject({
    ...req.body,
    actorId: req.user?.id,
    files: filesOf(req),
  });
  res.status(201).json(project);
});

export const getProjects = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await projectService.getProjects());
});

export const getProjectById = asyncHandler(async (req: Request, res: Response) => {
  res.json(await projectService.getProjectById(param(req, 'id')));
});

export const getProjectDailyReports = asyncHandler(async (req: Request, res: Response) => {
  res.json(await projectService.getProjectDailyReports(param(req, 'id')));
});

export const saveDailyReport = asyncHandler(async (req: Request, res: Response) => {
  const { reportDate, memberId, description } = req.body;
  const report = await projectService.saveDailyReport({
    projectId: param(req, 'id'),
    reportDate,
    memberId,
    description,
    files: filesOf(req),
    actorId: req.user?.id,
  });
  res.status(201).json(report);
});

export const addUpdate = asyncHandler(async (req: Request, res: Response) => {
  const update = await projectService.addUpdate({
    projectId: param(req, 'id'),
    ...req.body,
    files: filesOf(req),
    actorId: req.user?.id,
  });
  res.status(201).json(update);
});

export const getProjectUpdates = asyncHandler(async (req: Request, res: Response) => {
  res.json(await projectService.getProjectUpdates(param(req, 'id')));
});

export const finishProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.finishProject(param(req, 'id'), { ...req.body, actorId: req.user?.id });
  res.json(project);
});

export const validateCompletion = asyncHandler(async (req: Request, res: Response) => {
  const result = await projectService.validateCompletion(param(req, 'id'));
  if (!result.valid) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});
