import { Request, Response } from 'express';
import { documentsLinksService } from '../services/documentsLinksService';
import { asyncHandler } from '../utils/asyncHandler';
import { param } from '../utils/params';
import { unauthorized } from '../utils/httpError';

const actorOf = (req: Request) => {
  if (!req.user) throw unauthorized('Not authorized');
  return req.user;
};

const filesOf = (req: Request): Express.Multer.File[] => Array.isArray(req.files) ? req.files : [];

export const listDocumentsLinksProjects = asyncHandler(async (req: Request, res: Response) =>
  res.json(await documentsLinksService.list(actorOf(req))));
export const createDocumentsLinksProject = asyncHandler(async (req: Request, res: Response) =>
  res.status(201).json(await documentsLinksService.create(req.body, filesOf(req), actorOf(req))));
export const updateDocumentsLinksProject = asyncHandler(async (req: Request, res: Response) =>
  res.json(await documentsLinksService.update(param(req, 'id'), req.body, actorOf(req))));
export const addDocumentsLinksDocuments = asyncHandler(async (req: Request, res: Response) =>
  res.json(await documentsLinksService.addDocuments(param(req, 'id'), filesOf(req), actorOf(req))));
export const deleteDocumentsLinksDocument = asyncHandler(async (req: Request, res: Response) => {
  await documentsLinksService.deleteDocument(param(req, 'id'), param(req, 'documentId'), actorOf(req));
  res.status(204).send();
});
export const deleteDocumentsLinksProject = asyncHandler(async (req: Request, res: Response) => {
  await documentsLinksService.delete(param(req, 'id'), actorOf(req));
  res.status(204).send();
});
