import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLIENT_URL: z.string().min(1),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1).default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(100),

  // Not used (in-memory store), but present to align with platform standards.
  DATABASE_URL: z.string().optional()
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
