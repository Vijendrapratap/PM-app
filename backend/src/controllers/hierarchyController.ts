import { Request, Response } from 'express';
import { hierarchyService } from '../services/hierarchyService';
import { asyncHandler } from '../utils/asyncHandler';
import { unauthorized } from '../utils/httpError';
import { param } from '../utils/params';

const actorOf = (req: Request) => { if (!req.user) throw unauthorized('Not authorized'); return req.user; };
export const listMilestones = asyncHandler(async (req: Request, res: Response) => res.json(await hierarchyService.list(param(req, 'id'))));
export const createMilestone = asyncHandler(async (req: Request, res: Response) => res.status(201).json(await hierarchyService.createMilestone(param(req, 'id'), req.body, actorOf(req))));
export const updateMilestone = asyncHandler(async (req: Request, res: Response) => res.json(await hierarchyService.updateMilestone(param(req, 'milestoneId'), req.body, actorOf(req))));
export const deleteMilestone = asyncHandler(async (req: Request, res: Response) => res.json(await hierarchyService.archiveMilestone(param(req, 'milestoneId'), actorOf(req))));
export const createDeliverable = asyncHandler(async (req: Request, res: Response) => res.status(201).json(await hierarchyService.createDeliverable(param(req, 'milestoneId'), req.body, actorOf(req))));
export const updateDeliverable = asyncHandler(async (req: Request, res: Response) => res.json(await hierarchyService.updateDeliverable(param(req, 'deliverableId'), req.body, actorOf(req))));
export const deleteDeliverable = asyncHandler(async (req: Request, res: Response) => res.json(await hierarchyService.archiveDeliverable(param(req, 'deliverableId'), actorOf(req))));
