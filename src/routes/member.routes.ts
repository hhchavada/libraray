import { Router } from 'express';
import { memberController } from '../controllers/member.controller';
import { validate } from '../middlewares/validate';
import { memberValidation, memberIdParam } from '../validations/member.validation';
import { protect } from '../middlewares/auth.middleware';
import { uploadDocument } from '../middlewares/upload.middleware';

const router = Router();

router.use(protect);

router.post('/', validate(memberValidation.createMember), memberController.createMember);
router.get('/', memberController.getAllMembers);
router.get('/expiring-soon', memberController.getExpiringSoon);
router.post(
  '/:id/assign-seat',
  validate(memberIdParam, 'params'),
  validate(memberValidation.assignSeat),
  memberController.assignSeat
);
const changeSeatHandlers = [
  validate(memberIdParam, 'params'),
  validate(memberValidation.changeSeat),
  memberController.changeSeat,
];
router.patch('/:id/change-seat', ...changeSeatHandlers);
router.post('/:id/change-seat', ...changeSeatHandlers);
router.post(
  '/:id/convert-to-permanent',
  validate(memberIdParam, 'params'),
  validate(memberValidation.convertDemoToPermanent),
  memberController.convertDemoToPermanent
);
router.post(
  '/:id/renew',
  validate(memberIdParam, 'params'),
  validate(memberValidation.renewMember),
  memberController.renewMember
);
router.post(
  '/:id/mark-as-paid',
  validate(memberIdParam, 'params'),
  validate(memberValidation.markAsPaid),
  memberController.markAsPaid
);
router.post(
  '/:id/document',
  validate(memberIdParam, 'params'),
  uploadDocument,
  memberController.uploadDocument
);
router.get('/:id', memberController.getMemberById);
router.put('/:id', validate(memberValidation.updateMember), memberController.updateMember);
router.delete('/:id', memberController.deleteMember);

export default router;
