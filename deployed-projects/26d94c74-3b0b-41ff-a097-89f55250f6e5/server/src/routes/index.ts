import { Router } from 'express';
import authRoutes from './auth.js';
import bookmarkRoutes from './bookmarks.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/bookmarks', bookmarkRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

export default router;
