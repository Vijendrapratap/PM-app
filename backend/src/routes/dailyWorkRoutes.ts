import express from 'express';
import { addDailyWorkLog, endDailyWork, getAdminDailyWork, getCurrentDailyWork, startDailyWork } from '../controllers/dailyWorkController';
import { protect } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { dailyWorkLogSchema } from '../utils/validators';

const router = express.Router();
router.use(protect);
router.get('/current', getCurrentDailyWork);
router.post('/start', startDailyWork);
router.post('/end', endDailyWork);
router.post('/logs', validateBody(dailyWorkLogSchema), addDailyWorkLog);
router.get('/admin', getAdminDailyWork);
export default router;