import Joi from 'joi';
import { AdminDateFilter, PlanCategory } from '../constants/enums';

const adminFiltersSchema = {
  filter: Joi.string()
    .valid(...Object.values(AdminDateFilter))
    .optional()
    .default(AdminDateFilter.THIS_MONTH),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().when('filter', {
    is: AdminDateFilter.CUSTOM_RANGE,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  state: Joi.string().trim().optional(),
  city: Joi.string().trim().optional(),
  planCategory: Joi.string()
    .valid(...Object.values(PlanCategory))
    .optional(),
  executiveId: Joi.string()
    .trim()
    .hex()
    .length(24)
    .optional()
    .allow('', null)
    .empty(['', null]),
  search: Joi.string().trim().optional(),
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
};

export const adminValidation = {
  filters: Joi.object(adminFiltersSchema),

  stateParam: Joi.object({
    state: Joi.string().trim().required(),
  }),

  exportTransactions: Joi.object({
    ...adminFiltersSchema,
    format: Joi.string().valid('csv', 'excel').optional().default('excel'),
  }),

  createExecutive: Joi.object({
    fullName: Joi.string().trim().required(),
    email: Joi.string().email().required(),
    mobileNumber: Joi.string()
      .pattern(/^[0-9]{10}$/)
      .required(),
    assignedStates: Joi.array().items(Joi.string().trim()).optional(),
    assignedCities: Joi.array().items(Joi.string().trim()).optional(),
  }),

  libraryIdParam: Joi.object({
    libraryId: Joi.string().hex().length(24).required(),
  }),
};
