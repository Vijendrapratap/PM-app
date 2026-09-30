import express from 'express';
import { listVerticals, updateVertical } from '../controllers/verticalController';
import { protect, requireCEO } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { updateVerticalSchema } from '../utils/validators';

const router = express.Router();
router.use(protect);
router.get('/', listVerticals);
router.put('/:id', requireCEO, validateBody(updateVerticalSchema), updateVertical);
export default router;
