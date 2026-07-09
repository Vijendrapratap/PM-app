import express from 'express';
import { getIdeas, createIdea, deleteIdea } from '../controllers/ideaController';
import { protect, requireSuperAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createIdeaSchema } from '../utils/validators';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getIdeas)
  .post(validateBody(createIdeaSchema), createIdea);

router.delete('/:id', requireSuperAdmin, deleteIdea);

export default router;
