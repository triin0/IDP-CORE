import { Router } from 'express';
import authRoutes from './auth';
import eventRoutes from './events';
import adminRoutes from './admin';

const router = Router();

router.get('/health', (_req, res) => res.send('OK'));
router.use('/auth', authRoutes);
router.use('/events', eventRoutes);
router.use('/admin', adminRoutes);

export default router;
