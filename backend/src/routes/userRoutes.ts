import express from 'express';
import { getUsers, getUserById, updateUser, deactivateUser } from '../controllers/userController';
import { validateBody } from '../middleware/validate';
import { updateUserSchema } from '../utils/validators';

const router = express.Router();

router.route('/').get(getUsers);
router.route('/:id').get(getUserById).put(validateBody(updateUserSchema), updateUser);
router.post('/:id/deactivate', deactivateUser);

export default router;
