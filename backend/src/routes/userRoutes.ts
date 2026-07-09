import express from 'express';
import {
  getUsers,
  getUserById,
  updateUser,
  deactivateUser,
  activateUser,
  deleteUser,
  resetPassword,
} from '../controllers/userController';
import { protect, requireSuperAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { updateUserSchema, resetPasswordSchema } from '../utils/validators';

const router = express.Router();

router.use(protect);

router.route('/').get(getUsers);
router.route('/:id').get(getUserById).put(requireSuperAdmin, validateBody(updateUserSchema), updateUser);
router.delete('/:id', requireSuperAdmin, deleteUser);
router.post('/:id/deactivate', requireSuperAdmin, deactivateUser);
router.post('/:id/activate', requireSuperAdmin, activateUser);
router.post('/:id/reset-password', requireSuperAdmin, validateBody(resetPasswordSchema), resetPassword);

export default router;
