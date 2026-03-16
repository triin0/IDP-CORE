import { z } from 'zod';

const tagsSchema = z.array(z.string().min(1)).max(50);

export const bookmarkIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const createBookmarkSchema = z.object({
  title: z.string().min(1).max(200),
  url: z.string().url().max(2000),
  description: z.string().max(2000).nullable().optional(),
  tags: tagsSchema.optional()
});

export const updateBookmarkSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    url: z.string().url().max(2000).optional(),
    description: z.string().max(2000).nullable().optional(),
    tags: tagsSchema.optional()
  })
  .refine((val) => Object.keys(val).length > 0, { message: 'At least one field must be provided' });
