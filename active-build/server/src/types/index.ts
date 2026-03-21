import { z } from 'zod';
import { selectUserSchema, selectEventSchema, selectRsvpSchema } from '../lib/validators';

// This file centralizes type definitions derived from Zod schemas.
// It ensures that our frontend and backend types are always in sync with our validation rules.

export type User = z.infer<typeof selectUserSchema>;
export type Event = z.infer<typeof selectEventSchema>;
export type Rsvp = z.infer<typeof selectRsvpSchema>;
