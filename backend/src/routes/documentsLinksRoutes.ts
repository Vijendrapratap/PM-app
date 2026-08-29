import express, { NextFunction, Request, Response } from 'express';
import {
  addDocumentsLinksDocuments,
  createDocumentsLinksProject,
  deleteDocumentsLinksDocument,
  deleteDocumentsLinksProject,
  listDocumentsLinksProjects,
  updateDocumentsLinksProject,
} from '../controllers/documentsLinksController';
import { protect } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { canManageDocumentsLinks } from '../policies/documentsLinksPolicy';

const router = express.Router();
router.use(protect);

const requireEditor = (req: Request, res: Response, next: NextFunction) => {
  if (!canManageDocumentsLinks(req.user)) {
    res.status(403).json({ message: 'Only a CEO, Founder, or Super Admin can modify Documents & Links' });
    return;
  }
  next();
};

router.route('/')
  .get(listDocumentsLinksProjects)
  .post(requireEditor, upload.array('documents'), createDocumentsLinksProject);
router.route('/:id')
  .put(requireEditor, updateDocumentsLinksProject)
  .delete(requireEditor, deleteDocumentsLinksProject);
router.post('/:id/documents', requireEditor, upload.array('documents'), addDocumentsLinksDocuments);
router.delete('/:id/documents/:documentId', requireEditor, deleteDocumentsLinksDocument);

export default router;
