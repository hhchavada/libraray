import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { protect, authorizeRoles } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate';
import { subscriptionValidation } from '../validations/subscription.validation';
import { UserRole } from '../constants/enums';

const router = Router();

router.use(protect);
router.use(authorizeRoles(UserRole.SUPER_ADMIN));

router.get('/dashboard', adminController.getDashboard);
router.get('/libraries/:libraryId', adminController.getLibraryDetail);

router.post(
  '/subscription/plans',
  validate(subscriptionValidation.adminCreatePlan),
  adminController.createSubscriptionPlan
);
router.put(
  '/subscription/plans/:planId',
  validate(subscriptionValidation.adminUpdatePlan),
  adminController.updateSubscriptionPlan
);
router.patch('/subscription/plans/:planId/disable', adminController.disableSubscriptionPlan);
router.get(
  '/subscriptions',
  validate(subscriptionValidation.adminListSubscriptions, 'query'),
  adminController.getAllSubscriptions
);

export default router;
