import express from 'express';
import 'dotenv/config';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import apiRouter from './routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet()); // Sets various HTTP headers for security

// Configure CORS to only allow requests from your frontend
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:5173', // Default for Vite dev server
  optionsSuccessStatus: 200 // For legacy browser support
};
app.use(cors(corsOptions));

// Rate limiting to prevent brute-force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use('/api', limiter); // Apply to all API routes

// Body parser middleware to handle JSON payloads
app.use(express.json());

// API routes
app.use('/api', apiRouter);

// Global error handler - must be the last middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
