import express, { Request, Response, NextFunction } from 'express';
import 'dotenv/config';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import apiRouter from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
}));

// Rate Limiting
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use('/api/', limiter);


app.use(express.json());
app.use(cookieParser());


// API Routes
app.use('/api', apiRouter);

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  // Avoid leaking stack traces to the client in production
  if (process.env.NODE_ENV === 'production') {
      res.status(500).json({ message: 'An unexpected error occurred.' });
  } else {
      res.status(500).json({ message: err.message, stack: err.stack });
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
