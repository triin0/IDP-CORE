import { z } from 'zod';

// Auth schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Generic ID schema for params
export const objectIdSchema = z.object({
    id: z.string().uuid('Invalid UUID format'),
});

// Bookmark schemas
export const createBookmarkSchema = z.object({
  url: z.string().url('Invalid URL format'),
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().optional(),
  isFavorite: z.boolean().default(false),
  tags: z.array(z.string().min(1)).optional(),
});

export const updateBookmarkSchema = createBookmarkSchema.partial();
