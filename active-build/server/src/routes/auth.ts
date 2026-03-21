import { z } from 'zod';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users } from '../schema/users';
import { eq } from 'drizzle-orm';
import { validateRequest } from '../middleware/validateRequest';
import { registerSchema, loginSchema } from '../lib/validators';
import { requireAuth } from '../middleware/auth';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET environment variable is not set.');
    process.exit(1);
}

// Register a new user
router.post('/register', validateRequest(z.object({ body: registerSchema })), async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        const existingUser = await db.query.users.findFirst({
            where: eq(users.email, email),
        });

        if (existingUser) {
            return res.status(409).json({ message: 'User with this email already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await db.insert(users).values({
            name,
            email,
            passwordHash,
            role: 'user', // Explicitly set role to 'user' to prevent privilege escalation
        }).returning({ id: users.id, name: users.name, email: users.email, role: users.role });

        res.status(201).json(result[0]);
    } catch (error: any) {
        next(error);
    }
});

// Login a user
router.post('/login', validateRequest(z.object({ body: loginSchema })), async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const user = await db.query.users.findFirst({
            where: eq(users.email, email),
        });

        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000, // 1 day
        });

        res.status(200).json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        });
    } catch (error: any) {
        next(error);
    }
});

// Logout a user
router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });
    res.status(200).json({ message: 'Logged out successfully' });
});

// Get current user session
router.get('/me', requireAuth, async (req, res, next) => {
    try {
        const user = await db.query.users.findFirst({
            where: eq(users.id, req.user!.id),
            columns: { passwordHash: false },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json(user);
    } catch (error: any) {
        next(error);
    }
});


export default router;
