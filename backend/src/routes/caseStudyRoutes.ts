import express from 'express'; import { approveCaseStudy, getCaseStudy, updateCaseStudy } from '../controllers/caseStudyController'; import { protect } from '../middleware/auth';
const router = express.Router(); router.use(protect); router.get('/:id', getCaseStudy); router.patch('/:id', updateCaseStudy); router.post('/:id/approve', approveCaseStudy); export default router;
