import express from 'express';
import { getAgentDefinitions, getAgentReviewQueue, updateAgentDefinition } from '../controllers/agentWorkflowController';
import { protect } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { updateAgentDefinitionSchema } from '../utils/validators';

const router = express.Router();
router.use(protect);
router.get('/review-queue', getAgentReviewQueue);
router.get('/definitions', getAgentDefinitions);
router.put('/definitions/:definitionId', validateBody(updateAgentDefinitionSchema), updateAgentDefinition);

export default router;
