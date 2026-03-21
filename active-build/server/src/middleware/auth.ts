import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET environment variable is not set.');
    process.exit(1);
}

// Extend Express's Request interface to include the user payload
declare global {
    namespace Express {
        export interface Request {
            user?: {
                id: number;
                role: string;
            };
        }
    }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ message: 'Authentication required. No token provided.' });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET) as any
        req.user = payload;
        next();
    } catch (error: any) {
        // Clear invalid cookie
        res.clearCookie('token');
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Admin access required.' });
    }
    next();
};
