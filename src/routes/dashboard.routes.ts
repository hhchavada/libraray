import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.get('/stats/:libraryId', protect, dashboardController.getStats);

export default router;
