import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db.js';
import { todos } from '../schema/todos.js';
import { validate } from '../middleware/validate.js';
import type { Todo } from '../../../types/todo.js';

const todoRowToTodo = (row: {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Todo => ({
  id: row.id,
  title: row.title,
  completed: row.completed,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

const idParam = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.unknown().optional(),
  query: z.unknown().optional()
});

const createTodoSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(200)
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough()
});

const updateTodoSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z
    .object({
      title: z.string().trim().min(1).max(200).optional(),
      completed: z.boolean().optional()
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' }),
  query: z.object({}).passthrough()
});

export const todosRouter = Router();

// List todos
todosRouter.get('/todos', async (_req, res, next) => {
  try {
    const rows = await db().select().from(todos).orderBy(desc(todos.createdAt));
    res.json({ todos: rows.map(todoRowToTodo) });
  } catch (err) {
    next(err);
  }
});

// Create todo
todosRouter.post('/todos', validate(createTodoSchema), async (req, res, next) => {
  try {
    const { title } = req.body as { title: string };
    const now = new Date();

    const inserted = await db()
      .insert(todos)
      .values({ title, completed: false, createdAt: now, updatedAt: now })
      .returning();

    const created = inserted[0];
    res.status(201).json({ todo: todoRowToTodo(created) });
  } catch (err) {
    next(err);
  }
});

// Update todo
todosRouter.patch('/todos/:id', validate(updateTodoSchema), async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const body = req.body as { title?: string; completed?: boolean };

    const updated = await db()
      .update(todos)
      .set({
        ...(typeof body.title === 'string' ? { title: body.title } : {}),
        ...(typeof body.completed === 'boolean' ? { completed: body.completed } : {}),
        updatedAt: new Date()
      })
      .where(eq(todos.id, id))
      .returning();

    if (updated.length === 0) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Todo not found', requestId: res.locals.requestId as string }
      });
      return;
    }

    res.json({ todo: todoRowToTodo(updated[0]) });
  } catch (err) {
    next(err);
  }
});

// Delete todo
todosRouter.delete('/todos/:id', validate(idParam), async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const deleted = await db().delete(todos).where(eq(todos.id, id)).returning();

    if (deleted.length === 0) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Todo not found', requestId: res.locals.requestId as string }
      });
      return;
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
