import Joi from 'joi';
import { ExpenseCategory } from '../constants/enums';

export const expenseValidation = {
  createExpense: Joi.object({
    libraryId: Joi.string().hex().length(24).required(),
    expenseDate: Joi.date().iso().max('now').required(),
    description: Joi.string().min(3).max(200).required(),
    amount: Joi.number().positive().required(),
    category: Joi.string()
      .valid(...Object.values(ExpenseCategory))
      .required(),
  }),

  updateExpense: Joi.object({
    expenseDate: Joi.date().iso().max('now').optional(),
    description: Joi.string().min(3).max(200).optional(),
    amount: Joi.number().positive().optional(),
    category: Joi.string()
      .valid(...Object.values(ExpenseCategory))
      .optional(),
  }),
};
