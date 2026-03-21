import { z } from 'zod';
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { db } from '../db';
import { users, events } from '../schema';
import { validateRequest } from '../middleware/validateRequest';
import { createEventSchema, idParamSchema } from '../lib/validators';
import { eq } from 'drizzle-orm';

const router = Router();

// All routes in this file require admin access
router.use(requireAuth, requireAdmin);

// Admin: Get all users
router.get('/users', async (req, res, next) => {
    try {
        const allUsers = await db.query.users.findMany({
            columns: {
                passwordHash: false, // Ensure password hashes are not sent to the client
            }
        });
        res.status(200).json(allUsers);
    } catch (error: any) {
        next(error);
    }
});

// Admin: Create a new event
router.post('/events', validateRequest(z.object({ body: createEventSchema })), async (req, res, next) => {
    try {
        const newEvent = await db.insert(events).values({
            ...req.body,
            createdBy: req.user!.id, // req.user is guaranteed to exist by requireAuth
        }).returning();
        res.status(201).json(newEvent[0]);
    } catch (error: any) {
        next(error);
    }
});

// Admin: Update an event
router.put('/events/:id', validateRequest(z.object({ params: idParamSchema, body: createEventSchema.partial() })), async (req, res, next) => {
    try {
        const id = req.params.id as string;
        const updatedEvent = await db.update(events)
            .set({ ...req.body, updatedAt: new Date() })
            .where(eq(events.id, id))
            .returning();

        if (updatedEvent.length === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.status(200).json(updatedEvent[0]);
    } catch (error: any) {
        next(error);
    }
});

// Admin: Delete an event
router.delete('/events/:id', validateRequest(z.object({ params: idParamSchema })), async (req, res, next) => {
    try {
        const id = req.params.id as string;
        const deletedEvent = await db.delete(events)
            .where(eq(events.id, id))
            .returning();

        if (deletedEvent.length === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.status(204).send();
    } catch (error: any) {
        next(error);
    }
});

export default router;
