import { Router } from 'express';
import { db } from '../db/index.js';
import { users } from '../schema/users.js';
import { eq } from 'drizzle-orm';
import { hashPassword, comparePassword, generateToken } from '../lib/auth.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { registerSchema, loginSchema } from '../lib/validators.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// POST /api/auth/register
router.post('/register', validateRequest({ body: registerSchema }), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const passwordHash = await hashPassword(password);
    const newUser = await db.insert(users).values({ email, passwordHash }).returning({ id: users.id, email: users.email });

    res.status(201).json(newUser[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', validateRequest({ body: loginSchema }), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await db.query.users.findFirst({ where: eq(users.email, email) });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken({ id: user.id });
    res.json({ token });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res, next) => {
    try {
        // The user object is attached to the request by the authMiddleware
        const user = await db.query.users.findFirst({
            where: eq(users.id, req.user!.id),
            columns: { id: true, email: true, createdAt: true }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        next(error);
    }
});

export default router;
