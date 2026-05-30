import { Router } from 'express';
import { memberController } from '../controllers/member.controller';
import { validate } from '../middlewares/validate';
import { memberValidation } from '../validations/member.validation';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.use(protect);

router.post('/', validate(memberValidation.createMember), memberController.createMember);
router.get('/', memberController.getAllMembers);
router.post('/:id/assign-seat', validate(memberValidation.assignSeat), memberController.assignSeat);
router.post('/:id/change-seat', validate(memberValidation.changeSeat), memberController.changeSeat);
router.get('/:id', memberController.getMemberById);
router.put('/:id', validate(memberValidation.updateMember), memberController.updateMember);
router.delete('/:id', memberController.deleteMember);

export default router;
