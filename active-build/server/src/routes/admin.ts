import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { isAuthenticated, isAdmin } from '../middleware/auth'; // Placeholder auth middleware

const router = Router();

// All admin routes require authentication AND admin privileges
router.use(isAuthenticated, isAdmin);

// Example admin route: Get system statistics
router.get('/stats', async (req, res, next) => {
    try {
        const [{ count: entityCount }] = await db.execute(sql`SELECT count(*) FROM "entities"`);
        const [{ count: transactionCount }] = await db.execute(sql`SELECT count(*) FROM "transactions"`);

        res.json({
            entityCount: Number(entityCount),
            transactionCount: Number(transactionCount),
        });
    } catch (error) {
        next(error);
    }
});

// Example admin route: Trigger a maintenance task
// This route should have its own validation if it accepts input
router.post('/maintenance/reindex', async (req, res, next) => {
    try {
        // In a real app, this would trigger a background job
        console.log('Admin triggered re-indexing task.');
        res.status(202).json({ message: 'Re-indexing task started.' });
    } catch (error) {
        next(error);
    }
});

export default router;
