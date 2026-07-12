import express from 'express';
import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  archiveProject,
  restoreProject,
  addUpdate,
  getProjectUpdates,
  finishProject,
  validateCompletion,
  getProjectDailyReports,
  saveDailyReport,
  addProjectMember,
  removeProjectMember,
  addProjectDocuments,
} from '../controllers/projectController';
import { upload } from '../middleware/upload';
import { protect, requireSuperAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  createProjectSchema,
  updateProjectSchema,
  addUpdateSchema,
  saveDailyReportSchema,
  finishProjectSchema,
  addProjectMemberSchema,
} from '../utils/validators';
import projectTaskRoutes from './projectTaskRoutes';

const router = express.Router();

router.use(protect);

// Every authenticated user can view every project (transparent portal);
// only a Super Admin can create/edit/delete/archive one at the project level.
router.route('/')
  .post(requireSuperAdmin, upload.array('documents', 5), validateBody(createProjectSchema), createProject)
  .get(getProjects);

router.route('/:id')
  .get(getProjectById)
  .put(requireSuperAdmin, validateBody(updateProjectSchema), updateProject)
  .delete(requireSuperAdmin, deleteProject);

router.post('/:id/archive', requireSuperAdmin, archiveProject);
router.post('/:id/restore', requireSuperAdmin, restoreProject);

// Updates/daily-reports/finish are gated per-request inside the controller
// via projectService.assertProjectEditAccess (Super Admin or an assigned
// member) - viewing stays open to everyone above.
router.route('/:id/updates')
  .post(upload.array('documents', 5), validateBody(addUpdateSchema), addUpdate)
  .get(getProjectUpdates);

router.post('/:id/documents', upload.array('documents', 5), addProjectDocuments);

router.route('/:id/daily-reports')
  .get(getProjectDailyReports)
  .post(upload.array('documents', 5), validateBody(saveDailyReportSchema), saveDailyReport);

router.post('/:id/validate-completion', validateCompletion);

router.route('/:id/finish')
  .post(validateBody(finishProjectSchema), finishProject);

// Assigning/removing members on an *existing* project (as opposed to at
// creation time via CreateProjectModal) is part of Super Admin team management.
router.post('/:id/members', requireSuperAdmin, validateBody(addProjectMemberSchema), addProjectMember);
router.delete('/:id/members/:userId', requireSuperAdmin, removeProjectMember);

router.use('/:id/tasks', projectTaskRoutes);

export default router;
