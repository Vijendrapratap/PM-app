import express from 'express';
import { createDeliverable, deleteDeliverable, deleteMilestone, updateDeliverable, updateMilestone } from '../controllers/hierarchyController';
import { protect } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createDeliverableSchema, updateDeliverableSchema, updateMilestoneSchema } from '../utils/validators';

export const milestoneRouter = express.Router();
milestoneRouter.use(protect);
milestoneRouter.patch('/:milestoneId', validateBody(updateMilestoneSchema), updateMilestone);
milestoneRouter.delete('/:milestoneId', deleteMilestone);
milestoneRouter.post('/:milestoneId/deliverables', validateBody(createDeliverableSchema), createDeliverable);

export const deliverableRouter = express.Router();
deliverableRouter.use(protect);
deliverableRouter.patch('/:deliverableId', validateBody(updateDeliverableSchema), updateDeliverable);
deliverableRouter.delete('/:deliverableId', deleteDeliverable);
