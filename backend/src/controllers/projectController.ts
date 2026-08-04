import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { projectService } from '../services/projectService';
import { param } from '../utils/params';
import { unauthorized } from '../utils/httpError';
import { activityLogRepository } from '../repositories/activityLogRepository';

const filesOf = (req: Request): Express.Multer.File[] => (req.files as Express.Multer.File[]) || [];

const actorOf = (req: Request) => {
  if (!req.user) throw unauthorized('Not authorized');
  return req.user;
};

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.createProject({
    ...req.body,
    actorId: req.user?.id,
    actorRole: req.user?.role,
    organizationId: req.user?.organizationId,
    files: filesOf(req),
  });
  res.status(201).json(project);
});

export const getProjects = asyncHandler(async (req: Request, res: Response) => {
  res.json(await projectService.getProjects(req.query.includeArchived === 'true', actorOf(req)));
});

export const getProjectById = asyncHandler(async (req: Request, res: Response) => {
  res.json(await projectService.getProjectById(param(req, 'id')));
});
export const getProjectOverview = asyncHandler(async (req: Request, res: Response) => {
  res.json(await projectService.getOverview(param(req, 'id')));
});
export const setProjectHealth = asyncHandler(async (req: Request, res: Response) => {
  res.json(await projectService.setHealth(param(req, 'id'), req.body.health, req.body.note, actorOf(req)));
});
export const getProjectActivity = asyncHandler(async (req: Request, res: Response) => {
  const rows = await activityLogRepository.findProjectEvents(param(req, 'id'), Math.min(Number(req.query.limit) || 100, 200));
  res.json(rows.map((row: any) => ({ _id: row.id, eventType: row.event_type, entityType: row.entity_type, entityId: row.entity_id, actorType: row.actor_type, actor: row.actor ? { _id: row.actor.id, name: row.actor.name, photo: row.actor.photo } : null, payload: row.payload_json, correlationId: row.correlation_id, createdAt: row.created_at })));
});

export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  res.json(await projectService.updateProject(param(req, 'id'), req.body, req.user?.id));
});

export const deleteProject = asyncHandler(async (req: Request, res: Response) => {
  res.json(await projectService.deleteProject(param(req, 'id'), req.user?.id));
});

export const archiveProject = asyncHandler(async (req: Request, res: Response) => {
  res.json(await projectService.archiveProject(param(req, 'id'), req.user?.id));
});

export const restoreProject = asyncHandler(async (req: Request, res: Response) => {
  res.json(await projectService.restoreProject(param(req, 'id'), req.user?.id));
});

export const getProjectDailyReports = asyncHandler(async (req: Request, res: Response) => {
  res.json(await projectService.getProjectDailyReports(param(req, 'id')));
});

export const saveDailyReport = asyncHandler(async (req: Request, res: Response) => {
  const actor = actorOf(req);
  const projectId = param(req, 'id');
  await projectService.assertProjectContributionAccess(projectId, actor);

  const { reportDate, memberId, description } = req.body;
  const report = await projectService.saveDailyReport({
    projectId,
    reportDate,
    memberId,
    description,
    files: filesOf(req),
    actorId: actor.id,
    actorRole: actor.role,
  });
  res.status(201).json(report);
});

export const addUpdate = asyncHandler(async (req: Request, res: Response) => {
  const actor = actorOf(req);
  const projectId = param(req, 'id');
  await projectService.assertProjectContributionAccess(projectId, actor);

  const update = await projectService.addUpdate({
    projectId,
    ...req.body,
    files: filesOf(req),
    actorId: actor.id,
  });
  res.status(201).json(update);
});

export const getProjectUpdates = asyncHandler(async (req: Request, res: Response) => {
  res.json(await projectService.getProjectUpdates(param(req, 'id')));
});

export const finishProject = asyncHandler(async (req: Request, res: Response) => {
  const actor = actorOf(req);
  const projectId = param(req, 'id');
  await projectService.assertProjectEditAccess(projectId, actor);

  const project = await projectService.finishProject(projectId, { ...req.body, actorId: actor.id });
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

export const addProjectMember = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.addMember(param(req, 'id'), req.body.userId, req.user?.id);
  res.status(201).json(project);
});

export const removeProjectMember = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.removeMember(param(req, 'id'), param(req, 'userId'), req.user?.id);
  res.json(project);
});

export const addProjectDocuments = asyncHandler(async (req: Request, res: Response) => {
  const actor = actorOf(req);
  const projectId = param(req, 'id');
  await projectService.assertProjectEditAccess(projectId, actor);
  res.status(201).json(await projectService.addProjectDocuments(projectId, filesOf(req), actor.id));
});
