import { Router } from 'express';
import { subscriptionController } from '../controllers/subscription.controller';
import { protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate';
import { subscriptionValidation } from '../validations/subscription.validation';

const router = Router();

router.get('/plans', subscriptionController.getPlans);
router.get('/payment-callback', subscriptionController.paymentCallback);
router.get('/redirect-pay/:razorpaySubscriptionId', subscriptionController.redirectPay);
router.post('/webhook', subscriptionController.webhook);

router.post(
  '/create-order',
  protect,
  validate(subscriptionValidation.createOrder),
  subscriptionController.createOrder
);

router.post(
  '/validate-promo',
  protect,
  validate(subscriptionValidation.validatePromo),
  subscriptionController.validatePromo
);

router.post(
  '/verify-payment',
  protect,
  validate(subscriptionValidation.verifyPayment),
  subscriptionController.verifyPayment
);

router.get('/current', protect, subscriptionController.getCurrent);
router.get('/recurring-status', protect, subscriptionController.getRecurringStatus);
router.get('/history', protect, subscriptionController.getHistory);

export default router;
