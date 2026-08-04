import express from 'express';
import { closeWorkSession, getWorkSessionSummary, noteWorkSession, pauseWorkSession, startWorkSession } from '../controllers/workSessionController';
import { protect } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { startWorkSessionSchema, workSessionNoteSchema } from '../utils/validators';

const router = express.Router();
router.use(protect);
router.get('/summary', getWorkSessionSummary);
router.post('/start', validateBody(startWorkSessionSchema), startWorkSession);
router.post('/:id/pause', pauseWorkSession);
router.post('/:id/close', closeWorkSession);
router.post('/:id/note', validateBody(workSessionNoteSchema), noteWorkSession);
export default router;
