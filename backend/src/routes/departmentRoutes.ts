import express from 'express';
import { createDepartment, deactivateDepartment, listDepartments, updateDepartment } from '../controllers/departmentController';
import { protect, requireCEO } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createDepartmentSchema, updateDepartmentSchema } from '../utils/validators';

const router = express.Router();

router.use(protect);
router.get('/', listDepartments);
router.post('/', requireCEO, validateBody(createDepartmentSchema), createDepartment);
router.patch('/:id', requireCEO, validateBody(updateDepartmentSchema), updateDepartment);
router.delete('/:id', requireCEO, deactivateDepartment);

export default router;
