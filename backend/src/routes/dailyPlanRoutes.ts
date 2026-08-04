import express from 'express';
import { closeDailyPlan, getDailyPlan, reopenDailyPlan, startDailyPlan, startWorkday, updateWorkdayItem } from '../controllers/workdayController';
import { protect } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { finishWorkdaySchema, startWorkdaySchema, updateWorkdayItemSchema } from '../utils/validators';

const router = express.Router();
router.use(protect);
router.post('/', validateBody(startWorkdaySchema), startWorkday);
router.get('/:id', getDailyPlan);
router.post('/:id/start', startDailyPlan);
router.post('/:id/close', validateBody(finishWorkdaySchema), closeDailyPlan);
router.post('/:id/reopen', reopenDailyPlan);
router.patch('/:id/items/:itemId', validateBody(updateWorkdayItemSchema), updateWorkdayItem);
export default router;
