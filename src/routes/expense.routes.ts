import { Router } from 'express';
import { expenseController } from '../controllers/expense.controller';
import { validate } from '../middlewares/validate';
import { expenseValidation } from '../validations/expense.validation';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.use(protect);

router.post('/', validate(expenseValidation.createExpense), expenseController.create);
router.get('/', expenseController.getAll);
router.get('/summary', expenseController.getSummary);
router.get('/:id', expenseController.getById);
router.put('/:id', validate(expenseValidation.updateExpense), expenseController.update);
router.delete('/:id', expenseController.delete);

export default router;
