import { Router, type Request, type Response, type NextFunction } from 'express';
import { db } from '../db/index.js';
import { todos } from '../schema/todos.js';
import { eq } from 'drizzle-orm';
import { validateRequest } from '../middleware/validateRequest.js';
import { createTodoSchema, updateTodoSchema, todoIdParamSchema } from '../lib/validation/todos.js';

const router = Router();

// GET /api/todos - Retrieve all todo items
router.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const allTodos = await db.select().from(todos).orderBy(todos.createdAt);
        res.status(200).json(allTodos);
    } catch (error) {
        next(error);
    }
});

// POST /api/todos - Create a new todo item
router.post('/', validateRequest({ body: createTodoSchema }), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { text } = req.body;
        const [newTodo] = await db.insert(todos).values({ text }).returning();
        res.status(201).json(newTodo);
    } catch (error) {
        next(error);
    }
});

// PUT /api/todos/:id - Update an existing todo item
router.put('/:id', validateRequest({ params: todoIdParamSchema, body: updateTodoSchema }), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { text, completed } = req.body;

        const [updatedTodo] = await db.update(todos)
            .set({ 
                text: text, 
                completed: completed,
                updatedAt: new Date()
            })
            .where(eq(todos.id, id))
            .returning();
        
        if (!updatedTodo) {
            res.status(404).json({ message: 'Todo not found' });
            return;
        }

        res.status(200).json(updatedTodo);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/todos/:id - Delete a todo item
router.delete('/:id', validateRequest({ params: todoIdParamSchema }), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const [deletedTodo] = await db.delete(todos).where(eq(todos.id, id)).returning();

        if (!deletedTodo) {
            res.status(404).json({ message: 'Todo not found' });
            return;
        }

        res.status(204).send(); // No content on successful deletion
    } catch (error) {
        next(error);
    }
});


export default router;
