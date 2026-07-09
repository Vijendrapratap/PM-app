import express from 'express';
import {
  getMessages,
  getActiveMessages,
  createMessage,
  updateMessage,
  deleteMessage,
} from '../controllers/messageController';
import { protect, requireSuperAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createMessageSchema, updateMessageSchema } from '../utils/validators';

const router = express.Router();

router.use(protect);

router.get('/active', getActiveMessages);

router.route('/')
  .get(requireSuperAdmin, getMessages)
  .post(requireSuperAdmin, validateBody(createMessageSchema), createMessage);

router.route('/:id')
  .put(requireSuperAdmin, validateBody(updateMessageSchema), updateMessage)
  .delete(requireSuperAdmin, deleteMessage);

export default router;
