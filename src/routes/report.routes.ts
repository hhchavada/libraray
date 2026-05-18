import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.use(protect);

router.get('/members/:libraryId', reportController.getMemberReport);

export default router;
