import { Router } from 'express';
import { memberController } from '../controllers/member.controller';
import { validate } from '../middlewares/validate';
import { memberValidation } from '../validations/member.validation';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.use(protect);

router.post('/', validate(memberValidation.createMember), memberController.createMember);
router.get('/', memberController.getAllMembers);
router.get('/:id', memberController.getMemberById);
router.put('/:id', validate(memberValidation.updateMember), memberController.updateMember);
router.delete('/:id', memberController.deleteMember);

export default router;
