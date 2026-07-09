import express from 'express';
import { getRecentActivity } from '../controllers/activityLogController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.get('/', protect, getRecentActivity);

export default router;
