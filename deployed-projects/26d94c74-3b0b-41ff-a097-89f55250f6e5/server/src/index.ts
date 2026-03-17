import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import http from 'http';

import apiRoutes from './routes/index.js';
import { db } from './db/index.js';

const PORT = process.env.PORT || 3001;

const app = express();
const server = http.createServer(app);

// Basic security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.CLIENT_URL,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', apiRoutes);

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction): void => {
  console.error(err);
  
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.status(500).json({
    message: 'An internal server error occurred',
    ...( !isProduction && { stack: err.stack })
  });
});

// 404 handler for unmatched routes
app.use((req: Request, res: Response) => {
    res.status(404).json({ message: 'Not Found' });
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('Received shutdown signal, closing server gracefully.');
  server.close(() => {
    console.log('HTTP server closed.');
    db.end().then(() => {
      console.log('Database connection pool closed.');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
