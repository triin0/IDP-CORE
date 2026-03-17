import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import apiRoutes from './routes/index.js';
import { globalErrorHandler } from './middleware/errorHandler.js';

// Initialize Express app
const app = express();

// --- Core Middleware ---

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: config.CLIENT_URL,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use('/api', limiter);

// JSON body parser
app.use(express.json());

// --- Routing ---

// Health check endpoint
app.get('/health', (_req: Request, res: Response): void => {
    res.status(200).json({ status: 'ok', message: 'Server is healthy' });
});

// API routes
app.use('/api', apiRoutes);

// --- Error Handling ---

// 404 handler for unmatched routes
app.use((_req: Request, res: Response): void => {
    res.status(404).json({ message: 'Resource not found' });
});

// Global error handler
app.use(globalErrorHandler);

// --- Server Startup ---
const server = app.listen(config.PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${config.PORT}`);
});

// --- Graceful Shutdown ---
const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

signals.forEach((signal) => {
    process.on(signal, () => {
        console.log(`\nReceived ${signal}, shutting down gracefully...`);
        server.close(() => {
            console.log('HTTP server closed.');
            // Here you would also close database connections, etc.
            process.exit(0);
        });
    });
});
