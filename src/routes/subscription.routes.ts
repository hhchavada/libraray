import { Router } from 'express';
import { subscriptionController } from '../controllers/subscription.controller';
import { protect } from '../middlewares/auth.middleware';

/**
 * Webhook route is registered separately in app.ts BEFORE express.json()
 * to preserve the raw request body for Razorpay signature verification.
 */

const router = Router();

router.get('/plans', subscriptionController.getAllPlans);
router.post('/create', protect, subscriptionController.createSubscription);
router.get('/my', protect, subscriptionController.getMySubscription);
router.post('/cancel', protect, subscriptionController.cancelSubscription);

export default router;
