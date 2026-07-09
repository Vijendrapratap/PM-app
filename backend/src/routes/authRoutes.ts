import express from 'express';
import { registerUser, loginUser, getMe } from '../controllers/authController';
import { protect, optionalAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { registerSchema, loginSchema } from '../utils/validators';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Public self-registration: anyone can create an account (always lands as
// 'Team Member' - see authService.register). optionalAuth also lets a
// logged-in Super Admin hit this same endpoint to create a member directly
// with a chosen role, in one step, from the Team Members page.
router.post('/register', authRateLimiter, optionalAuth, validateBody(registerSchema), registerUser);
router.post('/login', authRateLimiter, validateBody(loginSchema), loginUser);
router.get('/me', protect, getMe);

export default router;
