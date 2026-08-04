import express from 'express';
import { registerUser } from '../controllers/authController';
import { completeOnboarding, getUserById, getUsers } from '../controllers/userController';
import { protect, requireCEO, requireManager } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { onboardingSchema, registerSchema } from '../utils/validators';

const router = express.Router();
router.use(protect);
router.get('/', requireManager, getUsers);
router.post('/invite', requireCEO, validateBody(registerSchema), registerUser);
router.post('/onboarding', validateBody(onboardingSchema), completeOnboarding);
router.get('/:id', requireManager, getUserById);
export default router;
