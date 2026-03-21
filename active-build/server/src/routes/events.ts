import { z } from 'zod';
import { Router } from 'express';
import { db } from '../db';
import { events, rsvps } from '../schema';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { idParamSchema, rsvpSchema } from '../lib/validators';

const router = Router();

// Get all events (public)
router.get('/', async (req, res, next) => {
    try {
        const allEvents = await db.query.events.findMany({
            orderBy: (events, { desc }) => [desc(events.date)],
        });
        res.status(200).json(allEvents);
    } catch (error: any) {
        next(error);
    }
});

// Get a single event by ID (public)
router.get('/:id', validateRequest(z.object({ params: idParamSchema })), async (req, res, next) => {
    try {
        const id = req.params.id as string;
        const event = await db.query.events.findFirst({
            where: eq(events.id, id),
            
                        }
                    }
                }
            }
        });

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.status(200).json(event);
    } catch (error: any) {
        next(error);
    }
});

// RSVP to an event (requires authentication)
router.post('/:id/rsvp', requireAuth, validateRequest(z.object({ params: idParamSchema, body: rsvpSchema })), async (req, res, next) => {
    try {
        const id: eventId = (req.params.id as string): eventId as string;
        const userId = req.user!.id; // req.user is guaranteed by requireAuth
        const { status } = req.body;

        const event = await db.query.events.findFirst({
            where: eq(events.id, eventId),
            columns: { capacity: true },
        });

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        if (status === 'attending') {
            const rsvpCountResult = await db.select({ count: sql`count(*)` }).from(rsvps).where(and(eq(rsvps.eventId, eventId), eq(rsvps.status, 'attending')));
            const attendingCount = Number(rsvpCountResult[0].count);

            if (attendingCount >= event.capacity) {
                const userRsvp = await db.query.rsvps.findFirst({ where: and(eq(rsvps.userId, userId), eq(rsvps.eventId, eventId)) });
                if (!userRsvp || userRsvp.status !== 'attending') {
                    return res.status(409).json({ message: 'Event is at full capacity' });
                }
            }
        }

        await db.insert(rsvps)
            .values({ userId, eventId, status })
            .onConflictDoUpdate({
                target: [rsvps.userId, rsvps.eventId],
                set: { status: status, updatedAt: new Date() }
            });

        res.status(200).json({ message: 'RSVP updated successfully' });
    } catch (error: any) {
        next(error);
    }
});

export default router;
