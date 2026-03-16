import { z } from 'zod';

export const ArtStatusSchema = z.enum(['draft', 'published']);

export const CreateArtSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(0).max(2000),
  content: z.string().min(2).max(200_000),
  status: ArtStatusSchema.optional()
});

export const UpdateArtSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    description: z.string().min(0).max(2000).optional(),
    content: z.string().min(2).max(200_000).optional(),
    status: ArtStatusSchema.optional()
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided.' });

export const IdParamSchema = z.object({
  id: z.string().uuid()
});
