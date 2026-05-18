import { Router } from 'express';
import { libraryController } from '../controllers/library.controller';
import { validate } from '../middlewares/validate';
import { libraryValidation } from '../validations/library.validation';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.use(protect);

router.post('/', validate(libraryValidation.createLibrary), libraryController.create);
router.get('/', libraryController.getMyLibrary);
router.put('/', validate(libraryValidation.updateLibrary), libraryController.update);
router.get('/stats', libraryController.getStats);
router.get('/qr', libraryController.getQrCode);

export default router;
