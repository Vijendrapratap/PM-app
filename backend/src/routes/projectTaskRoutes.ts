import express from 'express';
import {
  getProjectTasks,
  createProjectTask,
  updateProjectTask,
  deleteProjectTask,
  addProjectTaskSubtask,
  updateProjectTaskSubtask,
  deleteProjectTaskSubtask,
  addProjectTaskComment,
  addProjectTaskDocuments,
} from '../controllers/projectTaskController';
import { upload } from '../middleware/upload';
import { validateBody } from '../middleware/validate';
import {
  createProjectTaskSchema,
  updateProjectTaskSchema,
  createProjectTaskSubtaskSchema,
  updateProjectTaskSubtaskSchema,
  createTaskCommentSchema,
} from '../utils/validators';

// Mounted at /api/projects/:id/tasks - mergeParams so :id from the parent
// router is visible here. Reads are open (project visibility is transparent
// to every authenticated user); writes are gated inside the service via
// projectService.assertProjectEditAccess (Super Admin or an assigned member).
const router = express.Router({ mergeParams: true });

router.route('/')
  .get(getProjectTasks)
  .post(upload.array('documents', 5), validateBody(createProjectTaskSchema), createProjectTask);

router.route('/:taskId')
  .put(validateBody(updateProjectTaskSchema), updateProjectTask)
  .delete(deleteProjectTask);
router.post('/:taskId/comments', validateBody(createTaskCommentSchema), addProjectTaskComment);
router.post('/:taskId/documents', upload.array('documents', 5), addProjectTaskDocuments);

router.post('/:taskId/subtasks', upload.array('documents', 5), validateBody(createProjectTaskSubtaskSchema), addProjectTaskSubtask);
router.route('/:taskId/subtasks/:subId')
  .put(validateBody(updateProjectTaskSubtaskSchema), updateProjectTaskSubtask)
  .delete(deleteProjectTaskSubtask);

export default router;
