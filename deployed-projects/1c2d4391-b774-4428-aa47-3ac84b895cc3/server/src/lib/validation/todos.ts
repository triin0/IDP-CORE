import { z } from 'zod';
import { createInsertSchema } from 'drizzle-zod';
import { todos } from '../../schema/todos.js';

// Schema for request params containing a UUID
export const todoIdParamSchema = z.object({
  id: z.string().uuid({ message: "Invalid UUID" }),
});

// Schema for creating a new todo (validates request body)
export const createTodoSchema = createInsertSchema(todos, {
  text: z.string().min(1, { message: "Todo text cannot be empty" }),
}).pick({ text: true });


// Schema for updating a todo (validates request body)
export const updateTodoSchema = createInsertSchema(todos, {
    text: z.string().min(1, { message: "Todo text cannot be empty" }).optional(),
    completed: z.boolean().optional(),
}).pick({ text: true, completed: true })
  .refine(data => Object.keys(data).length > 0, { message: "At least one field (text or completed) must be provided for update" });
