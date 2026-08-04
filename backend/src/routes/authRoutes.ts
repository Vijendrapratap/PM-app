import express from 'express';
import { registerUser, loginUser, getMe } from '../controllers/authController';
import { protect, requireCEO } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { registerSchema, loginSchema } from '../utils/validators';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Organization membership is invitation/admin-created only. The initial CEO
// is bootstrapped from environment variables; only that role may add users.
router.post('/register', authRateLimiter, protect, requireCEO, validateBody(registerSchema), registerUser);
router.post('/login', authRateLimiter, validateBody(loginSchema), loginUser);
router.get('/me', protect, getMe);

export default router;
