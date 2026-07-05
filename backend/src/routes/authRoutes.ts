import express from 'express';
import { registerUser, loginUser, getMe } from '../controllers/authController';
import { protect } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { registerSchema, loginSchema } from '../utils/validators';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = express.Router();

router.post('/register', authRateLimiter, validateBody(registerSchema), registerUser);
router.post('/login', authRateLimiter, validateBody(loginSchema), loginUser);
router.get('/me', protect, getMe);

export default router;
