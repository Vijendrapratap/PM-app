import express from 'express';
import { approveKnowledgeDocument, getKnowledgeDocument, submitKnowledgeDocument, updateKnowledgeDocument } from '../controllers/agentWorkflowController';
import { protect } from '../middleware/auth';
const router = express.Router(); router.use(protect);
router.get('/:documentId', getKnowledgeDocument); router.patch('/:documentId', updateKnowledgeDocument); router.post('/:documentId/submit-review', submitKnowledgeDocument); router.post('/:documentId/approve', approveKnowledgeDocument);
export default router;
