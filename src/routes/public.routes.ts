import { Router } from 'express';
import { scanController } from '../controllers/scan.controller';
import { locationController } from '../controllers/location.controller';
import { validate } from '../middlewares/validate';
import { scanValidation } from '../validations/scan.validation';

const router = Router();

router.get('/scan/library', validate(scanValidation.getLibraryInfo, 'query'), scanController.getLibraryInfo);
router.get('/scan/qr-image', validate(scanValidation.getLibraryInfo, 'query'), scanController.getQrImage);
router.post(
  '/scan/register',
  validate(scanValidation.registerDemoStudent),
  scanController.registerDemoStudent
);

// Location APIs
router.get('/locations', locationController.getLocations);

export default router;
