import { Router } from 'express';
import todosRouter from './todos.js';

const router = Router();

// Mount the todos router under the /todos path
router.use('/todos', todosRouter);

export default router;
