import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { protect, authorizeRoles } from '../middlewares/auth.middleware';
import { UserRole } from '../constants/enums';

const router = Router();

router.use(protect);
router.use(authorizeRoles(UserRole.SUPER_ADMIN));

router.get('/dashboard', adminController.getDashboard);
router.get('/libraries/:libraryId', adminController.getLibraryDetail);

export default router;
