import { z } from 'zod';
import { users, events, rsvps, userRoleEnum, rsvpStatusEnum } from '../schema';
import { createSelectSchema, createInsertSchema } from 'drizzle-zod';

// Re-exporting select schemas for type inference
export const selectUserSchema = createSelectSchema(users).omit({ passwordHash: true });
export const selectEventSchema = createSelectSchema(events);
export const selectRsvpSchema = createSelectSchema(rsvps);

// Auth Schemas
export const registerSchema = createInsertSchema(users, {
    name: z.string().min(2,
    "Name must be at least 2 characters long"),
    email: z.string().email("Invalid email address"),
    passwordHash: z.string().min(8,
    "Password must be at least 8 characters long")
}).omit({ id: true, role: true, createdAt: true, updatedAt: true, passwordHash: true }); // Explicitly omit role and other server-set fields

export const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string(),
});

// Generic ID param schema for route validation
export const idParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});

// Event Schemas
export const createEventSchema = createInsertSchema(events, {
    title: z.string().min(3, "Title must be at least 3 characters long"),
    description: z.string().min(10, "Description must be at least 10 characters long"),
    date: z.coerce.date(),
    location: z.string().min(3, "Location must be at least 3 characters long"),
    capacity: z.coerce.number().int().positive("Capacity must be a positive number"),
}).omit({ id: true, createdBy: true, createdAt: true, updatedAt: true });

// RSVP Schema
export const rsvpSchema = z.object({
    status: z.enum(rsvpStatusEnum.enumValues),
});
