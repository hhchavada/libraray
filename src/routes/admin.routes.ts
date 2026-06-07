import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { protect, authorizeRoles } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate';
import { subscriptionValidation } from '../validations/subscription.validation';
import { adminValidation } from '../validations/admin.validation';
import { uploadExcel } from '../middlewares/upload.middleware';
import { UserRole } from '../constants/enums';

const router = Router();

router.use(protect);
router.use(authorizeRoles(UserRole.SUPER_ADMIN));

// Legacy dashboard
router.get('/dashboard', adminController.getDashboard);
router.get('/libraries/:libraryId', adminController.getLibraryDetail);

// Filter options
router.get('/filters', adminController.getFilterOptions);
router.get('/filters/cities/:state', validate(adminValidation.stateParam, 'params'), adminController.getCitiesByState);

// Analytics sections
router.get('/analytics/summary', validate(adminValidation.filters, 'query'), adminController.getDashboardSummary);
router.get('/analytics/revenue', validate(adminValidation.filters, 'query'), adminController.getRevenueAnalytics);
router.get('/analytics/growth', validate(adminValidation.filters, 'query'), adminController.getGrowthAnalytics);
router.get('/analytics/library-status', validate(adminValidation.filters, 'query'), adminController.getLibraryStatus);
router.get('/analytics/resource-usage', validate(adminValidation.filters, 'query'), adminController.getResourceUsage);
router.get('/analytics/executives', validate(adminValidation.filters, 'query'), adminController.getExecutivePerformance);
router.get('/analytics/renewals', validate(adminValidation.filters, 'query'), adminController.getRenewalForecast);

// Transactions
router.get('/transactions', validate(adminValidation.filters, 'query'), adminController.getTransactions);
router.get('/transactions/export', validate(adminValidation.exportTransactions, 'query'), adminController.exportTransactions);

// Member Excel import
router.post(
  '/libraries/:libraryId/import-members',
  validate(adminValidation.libraryIdParam, 'params'),
  uploadExcel,
  adminController.importMembers
);

// Sales executives
router.get('/executives', adminController.listExecutives);
router.post('/executives', validate(adminValidation.createExecutive), adminController.createExecutive);

// Subscription plan management
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
