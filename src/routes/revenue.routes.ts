import { Router } from 'express';
import { revenueController } from '../controllers/revenue.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.use(protect);

router.get('/summary/:libraryId', revenueController.getSummary);
router.get('/by-mode/:libraryId', revenueController.getByPaymentMode);
router.get('/trend/:libraryId', revenueController.getTrend);

export default router;
