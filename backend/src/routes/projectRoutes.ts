import express from 'express';
import {
  createProject,
  getProjects,
  getProjectById,
  addUpdate,
  getProjectUpdates,
  finishProject,
  validateCompletion,
  getProjectDailyReports,
  saveDailyReport,
} from '../controllers/projectController';
import { upload } from '../middleware/upload';
import { validateBody } from '../middleware/validate';
import {
  createProjectSchema,
  addUpdateSchema,
  saveDailyReportSchema,
  finishProjectSchema,
} from '../utils/validators';

const router = express.Router();

router.route('/')
  .post(upload.array('documents', 5), validateBody(createProjectSchema), createProject)
  .get(getProjects);

router.route('/:id')
  .get(getProjectById);

router.route('/:id/updates')
  .post(upload.array('documents', 5), validateBody(addUpdateSchema), addUpdate)
  .get(getProjectUpdates);

router.route('/:id/daily-reports')
  .get(getProjectDailyReports)
  .post(upload.array('documents', 5), validateBody(saveDailyReportSchema), saveDailyReport);

router.post('/:id/validate-completion', validateCompletion);

router.route('/:id/finish')
  .post(validateBody(finishProjectSchema), finishProject);

export default router;
