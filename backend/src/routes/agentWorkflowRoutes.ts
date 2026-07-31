import express from 'express';
import { getAgentReviewQueue } from '../controllers/agentWorkflowController';
import { protect } from '../middleware/auth';

const router = express.Router();
router.use(protect);
router.get('/review-queue', getAgentReviewQueue);

export default router;
