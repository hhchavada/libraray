import { Router } from 'express';
import { scanController } from '../controllers/scan.controller';
import { validate } from '../middlewares/validate';
import { scanValidation } from '../validations/scan.validation';

const router = Router();

router.get('/scan/library', validate(scanValidation.getLibraryInfo, 'query'), scanController.getLibraryInfo);
router.post(
  '/scan/register',
  validate(scanValidation.registerDemoStudent),
  scanController.registerDemoStudent
);

export default router;
