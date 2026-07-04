import express from 'express';
import { createProject, getProjects, getProjectById, addUpdate, getProjectUpdates, finishProject, validateCompletion, getProjectDailyReports, saveDailyReport } from '../controllers/projectController';
import { upload } from '../middleware/upload';

const router = express.Router();

router.route('/')
  .post(upload.array('documents', 5), createProject)
  .get(getProjects);

router.route('/:id')
  .get(getProjectById);

router.route('/:id/updates')
  .post(upload.array('documents', 5), addUpdate)
  .get(getProjectUpdates);

router.route('/:id/daily-reports')
  .get(getProjectDailyReports)
  .post(upload.array('documents', 5), saveDailyReport);

router.post('/:id/validate-completion', validateCompletion);

router.route('/:id/finish')
  .post(finishProject);

export default router;
