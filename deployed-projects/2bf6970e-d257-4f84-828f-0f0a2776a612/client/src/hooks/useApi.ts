import { z } from 'zod';

const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional()
  })
});

export class ApiError extends Error {
  public readonly code: string;
  public readonly details?: unknown;
  public readonly status: number;

  public constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiClient {
  get<T>(path: string, schema: z.ZodType<T>): Promise<T>;
  post<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T>;
  put<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T>;
  del(path: string): Promise<void>;
}

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000/api';

const request = async <T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body: unknown | undefined,
  schema: z.ZodType<T> | null
): Promise<T> => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }

    const parsed = ApiErrorSchema.safeParse(payload);
    if (parsed.success) {
      throw new ApiError(res.status, parsed.data.error.code, parsed.data.error.message, parsed.data.error.details);
    }

    throw new ApiError(res.status, 'HTTP_ERROR', `Request failed with status ${res.status}`);
  }

  if (schema === null) {
    return undefined as unknown as T;
  }

  const data: unknown = await res.json();
  return schema.parse(data);
};

export const useApi = (): ApiClient => {
  return {
    get: async <T,>(path: string, schema: z.ZodType<T>): Promise<T> => request('GET', path, undefined, schema),
    post: async <T,>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> => request('POST', path, body, schema),
    put: async <T,>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> => request('PUT', path, body, schema),
    del: async (path: string): Promise<void> => {
      await request('DELETE', path, undefined, null);
    }
  };
};
