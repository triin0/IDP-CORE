import { z } from 'zod';

// Matches server-side validators
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type RegisterData = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});
export type LoginData = z.infer<typeof loginSchema>;

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface Bookmark {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  isFavorite: boolean;
  createdAt: string;
  tags: string[];
}

export interface BookmarkData {
  url: string;
  title: string;
  description: string;
  isFavorite: boolean;
  tags: string[];
}
