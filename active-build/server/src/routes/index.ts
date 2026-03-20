import { Router } from 'express';
import entitiesRouter from './entities';
import transactionsRouter from './transactions';
import adminRouter from './admin';

const router = Router();

router.use('/entities', entitiesRouter);
router.use('/transactions', transactionsRouter);
router.use('/admin', adminRouter);

export default router;
