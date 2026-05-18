import Joi from 'joi';

export const libraryValidation = {
  createLibrary: Joi.object({
    libraryName: Joi.string().min(2).max(100).required(),
    address: Joi.string().min(5).required(),
    totalSeats: Joi.number().integer().min(1).max(1000).required(),
    hasCustomSeatMap: Joi.boolean().optional(),
  }),

  updateLibrary: Joi.object({
    libraryName: Joi.string().min(2).max(100).optional(),
    address: Joi.string().min(5).optional(),
    totalSeats: Joi.number().integer().min(1).max(1000).optional(),
    hasCustomSeatMap: Joi.boolean().optional(),
  }),
};
