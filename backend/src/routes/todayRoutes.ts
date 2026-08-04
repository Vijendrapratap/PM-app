import express from 'express';
import { getTodayDashboard } from '../controllers/todayController';
import { protect } from '../middleware/auth';

const router = express.Router();
router.get('/', protect, getTodayDashboard);
export default router;
