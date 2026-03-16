import { Router } from 'express';
import { z } from 'zod';
import type { Todo } from '../../../types/todo.js';
import { createHttpError } from '../middleware/errorHandler.js';

// In-memory store (process memory). Resets on server restart.
const todos = new Map<string, Todo>();

const isoNow = (): string => new Date().toISOString();

const createId = (): string => {
  // Use crypto if available (Node 18+). Fallback to time-based id.
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const listTodos = (): Todo[] => {
  return Array.from(todos.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

export const todosRouter = Router();

const todoIdParamsSchema = z.object({
  id: z.string().min(1)
});

const createTodoBodySchema = z.object({
  title: z.string().min(1).max(200)
});

const updateTodoBodySchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    completed: z.boolean().optional()
  })
  .refine((v) => v.title !== undefined || v.completed !== undefined, {
    message: 'At least one field must be provided.'
  });

// GET /api/todos
todosRouter.get('/', (_req, res) => {
  res.json({ data: listTodos() });
});

// POST /api/todos
todosRouter.post('/', (req, res, next) => {
  try {
    const body = createTodoBodySchema.parse(req.body);

    const now = isoNow();
    const todo: Todo = {
      id: createId(),
      title: body.title.trim(),
      completed: false,
      createdAt: now,
      updatedAt: now
    };

    todos.set(todo.id, todo);

    res.status(201).json({ data: todo });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/todos/:id
todosRouter.patch('/:id', (req, res, next) => {
  try {
    const params = todoIdParamsSchema.parse(req.params);
    const body = updateTodoBodySchema.parse(req.body);

    const existing = todos.get(params.id);
    if (!existing) {
      throw createHttpError({
        status: 404,
        code: 'TODO_NOT_FOUND',
        message: 'Todo not found.'
      });
    }

    const updated: Todo = {
      ...existing,
      title: body.title !== undefined ? body.title.trim() : existing.title,
      completed: body.completed !== undefined ? body.completed : existing.completed,
      updatedAt: isoNow()
    };

    todos.set(updated.id, updated);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/todos/:id
todosRouter.delete('/:id', (req, res, next) => {
  try {
    const params = todoIdParamsSchema.parse(req.params);

    const existing = todos.get(params.id);
    if (!existing) {
      throw createHttpError({
        status: 404,
        code: 'TODO_NOT_FOUND',
        message: 'Todo not found.'
      });
    }

    todos.delete(params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
