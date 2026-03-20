import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

interface AppError extends Error {
    statusCode?: number;
    isOperational?: boolean;
}

export const errorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {
    console.error('ERROR 💥', err);

    // Handle Zod validation errors
    if (err instanceof ZodError) {
        return res.status(400).json({
            status: 'fail',
            message: 'Invalid input data.',
            errors: err.flatten().fieldErrors,
        });
    }

    // Default to 500 server error
    const statusCode = err.statusCode || 500;
    const status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    // In production, send a generic message for unexpected errors to avoid leaking implementation details
    if (process.env.NODE_ENV === 'production' && !err.isOperational) {
        return res.status(500).json({
            status: 'error',
            message: 'Something went very wrong!',
        });
    }

    // In development or for operational errors, send a more detailed message
    res.status(statusCode).json({
        status,
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
};
