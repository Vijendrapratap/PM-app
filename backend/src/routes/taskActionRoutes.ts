import express from 'express';
import { addTaskWorkflowUpdate, approveTaskReview, completeTask, pauseTask, rejectTaskReview, reportTaskBlocker, requestTaskReview, resolveTaskBlocker, startTask } from '../controllers/blockerController';
import { protect } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { completeTaskSchema, reportBlockerSchema, resolveBlockerSchema, taskPauseSchema, taskReviewDecisionSchema, taskReviewRequestSchema, taskUpdateEventSchema } from '../utils/validators';

const router = express.Router();
router.use(protect);
router.post('/:taskId/block', validateBody(reportBlockerSchema), reportTaskBlocker);
router.post('/:taskId/unblock', validateBody(resolveBlockerSchema), resolveTaskBlocker);
router.post('/:taskId/start', startTask);
router.post('/:taskId/pause', validateBody(taskPauseSchema), pauseTask);
router.post('/:taskId/update', validateBody(taskUpdateEventSchema), addTaskWorkflowUpdate);
router.post('/:taskId/request-review', validateBody(taskReviewRequestSchema), requestTaskReview);
router.post('/:taskId/approve', validateBody(taskReviewDecisionSchema), approveTaskReview);
router.post('/:taskId/reject', validateBody(taskReviewDecisionSchema.extend({ note: taskReviewDecisionSchema.shape.note.unwrap().min(1) })), rejectTaskReview);
router.post('/:taskId/complete', validateBody(completeTaskSchema), completeTask);
export default router;
