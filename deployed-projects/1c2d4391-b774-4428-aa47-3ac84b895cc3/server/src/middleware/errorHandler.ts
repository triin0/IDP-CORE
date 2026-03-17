import { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { config } from '../config.js';

interface AppError extends Error {
    statusCode?: number;
}

// Global error handling middleware for the Express application.
export function globalErrorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction): void {
    // Default to 500 Internal Server Error
    const statusCode = err.statusCode || 500;
    
    // Log the full error for debugging, especially in development
    console.error(err);

    // Handle Zod validation errors specifically
    if (err instanceof z.ZodError) {
        res.status(400).json({
            message: 'Validation failed',
            errors: err.flatten().fieldErrors,
        });
        return;
    }

    // Prepare the response body
    const responseBody = {
        message: err.message || 'An unexpected error occurred',
        // Do not leak stack trace in production environment
        stack: config.NODE_ENV === 'development' ? err.stack : undefined,
    };

    res.status(statusCode).json(responseBody);
}
