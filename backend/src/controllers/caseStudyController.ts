import { Request, Response } from 'express'; import { asyncHandler } from '../utils/asyncHandler'; import { caseStudyService } from '../services/caseStudyService'; import { unauthorized } from '../utils/httpError'; import { param } from '../utils/params';
const actorOf = (req: Request) => { if (!req.user) throw unauthorized('Not authorized'); return req.user; };
export const runCaseStudyAgent = asyncHandler(async (req: Request, res: Response) => res.status(202).json(await caseStudyService.run(req.body.projectId, actorOf(req))));
export const getProjectCaseStudy = asyncHandler(async (req: Request, res: Response) => res.json(await caseStudyService.getByProject(param(req, 'id'), actorOf(req))));
export const getCaseStudy = asyncHandler(async (req: Request, res: Response) => res.json(await caseStudyService.get(param(req, 'id'), actorOf(req))));
export const updateCaseStudy = asyncHandler(async (req: Request, res: Response) => res.json(await caseStudyService.update(param(req, 'id'), req.body, actorOf(req))));
export const approveCaseStudy = asyncHandler(async (req: Request, res: Response) => res.json(await caseStudyService.approve(param(req, 'id'), actorOf(req))));
