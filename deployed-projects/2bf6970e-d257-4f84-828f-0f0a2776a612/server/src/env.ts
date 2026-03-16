import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLIENT_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(120)
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = (() => {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Fail fast on misconfiguration; do not leak env values.
    // eslint-disable-next-line no-console
    console.error('Invalid environment configuration', parsed.error.flatten());
    throw new Error('Invalid environment configuration');
  }
  return parsed.data;
})();
