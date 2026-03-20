import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { transactions, insertTransactionSchema } from '../schema/transactions';
import { eq } from 'drizzle-orm';
import { validateRequest } from '../middleware/validateRequest';
import { isAuthenticated } from '../middleware/auth'; // Placeholder auth middleware

const router = Router();

// Schema for validating URL parameters that contain an ID
const idParamSchema = z.object({
    params: z.object({
        id: z.coerce.number().int().positive(),
    }),
});

// Schema for creating a transaction. We omit id, createdAt, updatedAt
const createTransactionSchema = z.object({
    body: insertTransactionSchema.omit({ id: true, createdAt: true, updatedAt: true }),
});

// Schema for updating a transaction. All fields are optional.
const updateTransactionSchema = z.object({
    body: insertTransactionSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
});

// All routes in this file require authentication
router.use(isAuthenticated);

// GET /api/transactions
router.get('/', async (req, res, next) => {
    try {
        const allTransactions = await db.query.transactions.findMany({
            with: {
                sourceEntity: true,
                destinationEntity: true,
            },
        });
        res.json(allTransactions);
    } catch (error) {
        next(error);
    }
});

// POST /api/transactions
router.post('/', validateRequest(createTransactionSchema), async (req, res, next) => {
    try {
        const [newTransaction] = await db.insert(transactions).values(req.body).returning();
        res.status(201).json(newTransaction);
    } catch (error) {
        next(error);
    }
});

// GET /api/transactions/:id
router.get('/:id', validateRequest(idParamSchema), async (req, res, next) => {
    try {
        const id = req.params.id as string;
        const transaction = await db.query.transactions.findFirst({
            where: eq(transactions.id, Number(id)),
            with: {
                sourceEntity: true,
                destinationEntity: true,
            },
        });

        if (!transaction) {
            return res.status(404).json({ message: `Transaction ${id} not found` });
        }
        res.json(transaction);
    } catch (error) {
        next(error);
    }
});

// PUT /api/transactions/:id
router.put('/:id', validateRequest(idParamSchema.merge(updateTransactionSchema)), async (req, res, next) => {
    try {
        const id = req.params.id as string;
        const [updatedTransaction] = await db.update(transactions)
            .set(req.body)
            .where(eq(transactions.id, Number(id)))
            .returning();

        if (!updatedTransaction) {
            return res.status(404).json({ message: `Transaction ${id} not found` });
        }
        res.json(updatedTransaction);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/transactions/:id
router.delete('/:id', validateRequest(idParamSchema), async (req, res, next) => {
    try {
        const id = req.params.id as string;
        const [deletedTransaction] = await db.delete(transactions)
            .where(eq(transactions.id, Number(id)))
            .returning();
        
        if (!deletedTransaction) {
            return res.status(404).json({ message: `Transaction ${id} not found` });
        }
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
