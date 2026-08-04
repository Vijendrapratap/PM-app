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
  getProjectOverview,
  setProjectHealth,
  getProjectActivity,
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
  setProjectHealthSchema,
} from '../utils/validators';
import projectTaskRoutes from './projectTaskRoutes';
import {
  approveKnowledgeDocumentVersion,
  approvePlanDraft,
  getAgentWorkspace,
  runBusinessAnalystAgent,
  runProjectManagerAgent,
  updateKnowledgeDocumentVersion,
  listKnowledgeDocuments,
  createKnowledgeDocument,
  updatePlanDraft,
} from '../controllers/agentWorkflowController';
import { runAgentSchema, updateKnowledgeDocumentSchema, updatePlanDraftSchema } from '../utils/validators';
import { createMilestone, listMilestones } from '../controllers/hierarchyController';
import { createMilestoneSchema } from '../utils/validators';
import { getProjectCaseStudy } from '../controllers/caseStudyController';

const router = express.Router();

router.use(protect);

// Project listing is scoped in the service to CEO-wide access or projects
// owned by / assigned to the current user. Managers may create projects.
router.route('/')
  .post(requireManager, upload.array('documents', 5), validateBody(createProjectSchema), createProject)
  .get(getProjects);

// Every project-specific route below this point revalidates ownership or
// membership. Hidden client controls are never the authorization boundary.
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

router.get('/:id/documents', listKnowledgeDocuments);
router.post('/:id/documents', (req, res, next) => req.is('application/json') ? createKnowledgeDocument(req, res, next) : upload.array('documents', 5)(req, res, (error) => error ? next(error) : addProjectDocuments(req, res, next)));

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
router.get('/:id/milestones', listMilestones);
router.post('/:id/milestones', validateBody(createMilestoneSchema), createMilestone);
router.get('/:id/overview', getProjectOverview);
router.post('/:id/health', validateBody(setProjectHealthSchema), setProjectHealth);
router.get('/:id/activity', getProjectActivity);
router.get('/:id/case-study', getProjectCaseStudy);

router.get('/:id/agent-workflow', getAgentWorkspace);
router.post('/:id/agents/project-manager/run', validateBody(runAgentSchema), runProjectManagerAgent);
router.post('/:id/plans/:planId/agents/business-analyst/run', validateBody(runAgentSchema), runBusinessAnalystAgent);
router.put('/:id/plans/:planId', validateBody(updatePlanDraftSchema), updatePlanDraft);
router.post('/:id/plans/:planId/approve', approvePlanDraft);
router.put('/:id/document-versions/:versionId', validateBody(updateKnowledgeDocumentSchema), updateKnowledgeDocumentVersion);
router.post('/:id/document-versions/:versionId/approve', approveKnowledgeDocumentVersion);

router.use('/:id/tasks', projectTaskRoutes);

export default router;
