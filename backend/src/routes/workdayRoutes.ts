import express from 'express';
import { finishWorkday, getTeamPulse, getToday, startWorkday, updateWorkdayItem } from '../controllers/workdayController';
import { protect } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { finishWorkdaySchema, startWorkdaySchema, updateWorkdayItemSchema } from '../utils/validators';

const router = express.Router();
router.use(protect);

router.get('/today', getToday);
router.post('/start', validateBody(startWorkdaySchema), startWorkday);
router.patch('/items/:itemId', validateBody(updateWorkdayItemSchema), updateWorkdayItem);
router.post('/finish', validateBody(finishWorkdaySchema), finishWorkday);
router.get('/team', getTeamPulse);

export default router;
