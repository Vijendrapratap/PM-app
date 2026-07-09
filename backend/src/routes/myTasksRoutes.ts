import express from 'express';
import { getMyAssignedTasks } from '../controllers/projectTaskController';
import { protect } from '../middleware/auth';

// Cross-project "assigned to me" view for the dashboard - separate from
// /api/projects/:id/tasks (which is scoped to one project).
const router = express.Router();

router.get('/', protect, getMyAssignedTasks);

export default router;
