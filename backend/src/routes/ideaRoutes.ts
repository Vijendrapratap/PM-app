import express from 'express';
import { getIdeas, createIdea, updateIdea, deleteIdea } from '../controllers/ideaController';
import { protect, requireSuperAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createIdeaSchema, updateIdeaSchema } from '../utils/validators';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getIdeas)
  .post(validateBody(createIdeaSchema), createIdea);

router.patch('/:id', requireSuperAdmin, validateBody(updateIdeaSchema), updateIdea);
router.delete('/:id', requireSuperAdmin, deleteIdea);

export default router;
