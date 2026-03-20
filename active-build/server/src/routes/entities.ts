import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { entities, insertEntitySchema } from '../schema/entities';
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

// Schema for validating the request body when creating an entity
const createEntitySchema = z.object({
    body: insertEntitySchema.pick({ name: true, type: true }),
});

// Schema for validating the request body when updating an entity
const updateEntitySchema = z.object({
    body: insertEntitySchema.pick({ name: true, type: true }).partial(),
});

// All routes in this file require authentication
router.use(isAuthenticated);

// GET /api/entities
router.get('/', async (req, res, next) => {
    try {
        const allEntities = await db.query.entities.findMany();
        res.json(allEntities);
    } catch (error) {
        next(error);
    } 
});

// POST /api/entities
router.post('/', validateRequest(createEntitySchema), async (req, res, next) => {
    try {
        const [newEntity] = await db.insert(entities).values(req.body).returning();
        res.status(201).json(newEntity);
    } catch (error) {
        next(error);
    }
});

// GET /api/entities/:id
router.get('/:id', validateRequest(idParamSchema), async (req, res, next) => {
    try {
        const id = req.params.id as string;
        const entity = await db.query.entities.findFirst({
            where: eq(entities.id, Number(id)),
        });

        if (!entity) {
            return res.status(404).json({ message: `Entity ${id} not found` });
        }
        res.json(entity);
    } catch (error) {
        next(error);
    }
});

// PUT /api/entities/:id
router.put('/:id', validateRequest(idParamSchema.merge(updateEntitySchema)), async (req, res, next) => {
    try {
        const id = req.params.id as string;
        const [updatedEntity] = await db.update(entities)
            .set(req.body)
            .where(eq(entities.id, Number(id)))
            .returning();

        if (!updatedEntity) {
            return res.status(404).json({ message: `Entity ${id} not found` });
        }
        res.json(updatedEntity);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/entities/:id
router.delete('/:id', validateRequest(idParamSchema), async (req, res, next) => {
    try {
        const id = req.params.id as string;
        const [deletedEntity] = await db.delete(entities)
            .where(eq(entities.id, Number(id)))
            .returning();

        if (!deletedEntity) {
            return res.status(404).json({ message: `Entity ${id} not found` });
        }
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
