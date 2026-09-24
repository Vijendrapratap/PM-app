import express from 'express';
import { addDailyWorkLog, endDailyWork, getAdminDailyWork, getCurrentDailyWork, getDailyWorkHistory, startDailyWork } from '../controllers/dailyWorkController';
import { protect } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { dailyWorkEndSchema, dailyWorkLogSchema, dailyWorkStartSchema } from '../utils/validators';

const router = express.Router();
router.use(protect);
router.get('/current', getCurrentDailyWork);
router.get('/history', getDailyWorkHistory);
router.post('/start', validateBody(dailyWorkStartSchema), startDailyWork);
router.post('/end', validateBody(dailyWorkEndSchema), endDailyWork);
router.post('/logs', validateBody(dailyWorkLogSchema), addDailyWorkLog);
router.get('/admin', getAdminDailyWork);
export default router;