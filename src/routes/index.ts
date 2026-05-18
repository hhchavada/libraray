import { Router } from 'express';
import authRouter from './auth.routes';
import libraryRouter from './library.routes';
import seatRouter from './seat.routes';
import memberRouter from './member.routes';
import dashboardRouter from './dashboard.routes';
import revenueRouter from './revenue.routes';
import expenseRouter from './expense.routes';
import reportRouter from './report.routes';
import subscriptionRouter from './subscription.routes';
import publicRouter from './public.routes';

const router = Router();

router.use('/auth', authRouter);
router.use('/library', libraryRouter);
router.use('/seats', seatRouter);
router.use('/members', memberRouter);
router.use('/dashboard', dashboardRouter);
router.use('/revenue', revenueRouter);
router.use('/expenses', expenseRouter);
router.use('/reports', reportRouter);
router.use('/subscriptions', subscriptionRouter);
router.use('/public', publicRouter);

export default router;
