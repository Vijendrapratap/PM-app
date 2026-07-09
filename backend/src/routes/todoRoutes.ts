import express from 'express';
import {
  getMyTodos,
  getTodaysTodo,
  getAssignedSubtasks,
  createTodo,
  updateTodo,
  deleteTodo,
  addSubtask,
  updateSubtask,
  deleteSubtask,
} from '../controllers/todoController';
import { upload } from '../middleware/upload';
import { protect } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  createTodoSchema,
  updateTodoSchema,
  createSubtaskSchema,
  updateSubtaskSchema,
} from '../utils/validators';

const router = express.Router();

router.use(protect);

router.get('/mine', getMyTodos);
router.get('/today', getTodaysTodo);
router.get('/assigned-subtasks', getAssignedSubtasks);

router.post('/', upload.array('documents', 5), validateBody(createTodoSchema), createTodo);
router.route('/:id')
  .put(validateBody(updateTodoSchema), updateTodo)
  .delete(deleteTodo);

router.post('/:id/subtasks', upload.array('documents', 5), validateBody(createSubtaskSchema), addSubtask);
router.route('/:id/subtasks/:subId')
  .put(validateBody(updateSubtaskSchema), updateSubtask)
  .delete(deleteSubtask);

export default router;
