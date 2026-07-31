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
import { protect, requireManager, requireProjectAccess, requireSuperAdmin } from '../middleware/auth';
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
import {
  approveKnowledgeDocumentVersion,
  approvePlanDraft,
  getAgentWorkspace,
  runBusinessAnalystAgent,
  runProjectManagerAgent,
  updateKnowledgeDocumentVersion,
  updatePlanDraft,
} from '../controllers/agentWorkflowController';
import { runAgentSchema, updateKnowledgeDocumentSchema, updatePlanDraftSchema } from '../utils/validators';

const router = express.Router();

router.use(protect);

// Every authenticated user can view every project (transparent portal);
// only a Super Admin can create/edit/delete/archive one at the project level.
router.route('/')
  .post(requireManager, upload.array('documents', 5), validateBody(createProjectSchema), createProject)
  .get(getProjects);

// Every project-specific route below this point is scoped. Managers can see
// all projects; Leads and Team Members must be assigned to the project.
router.use('/:id', requireProjectAccess);

router.route('/:id')
  .get(getProjectById)
  .put(requireManager, validateBody(updateProjectSchema), updateProject)
  .delete(requireSuperAdmin, deleteProject);

router.post('/:id/archive', requireManager, archiveProject);
router.post('/:id/restore', requireManager, restoreProject);

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
router.post('/:id/members', requireManager, validateBody(addProjectMemberSchema), addProjectMember);
router.delete('/:id/members/:userId', requireManager, removeProjectMember);

router.get('/:id/agent-workflow', getAgentWorkspace);
router.post('/:id/agents/project-manager/run', validateBody(runAgentSchema), runProjectManagerAgent);
router.post('/:id/plans/:planId/agents/business-analyst/run', validateBody(runAgentSchema), runBusinessAnalystAgent);
router.put('/:id/plans/:planId', validateBody(updatePlanDraftSchema), updatePlanDraft);
router.post('/:id/plans/:planId/approve', approvePlanDraft);
router.put('/:id/document-versions/:versionId', validateBody(updateKnowledgeDocumentSchema), updateKnowledgeDocumentVersion);
router.post('/:id/document-versions/:versionId/approve', approveKnowledgeDocumentVersion);

router.use('/:id/tasks', projectTaskRoutes);

export default router;
