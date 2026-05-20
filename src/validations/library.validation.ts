import Joi from 'joi';

const seatPlacementSchema = Joi.object({
  seatNumber: Joi.number().integer().min(1).required(),
  column: Joi.string().trim().uppercase().min(1).max(3).required(),
  row: Joi.string().trim().uppercase().min(1).max(3).required(),
});

export const libraryValidation = {
  createLibrary: Joi.object({
    libraryName: Joi.string().min(2).max(100).required(),
    address: Joi.string().min(5).required(),
    totalSeats: Joi.number().integer().min(1).max(1000).when('selectedSeats', {
      is: Joi.array().min(1),
      then: Joi.optional(),
      otherwise: Joi.required(),
    }),
    selectedSeats: Joi.array().items(seatPlacementSchema).min(1).max(1000).optional(),
    hasCustomSeatMap: Joi.boolean().optional(),
  }),

  updateLibrary: Joi.object({
    libraryName: Joi.string().min(2).max(100).optional(),
    address: Joi.string().min(5).optional(),
    totalSeats: Joi.number().integer().min(1).max(1000).optional(),
    hasCustomSeatMap: Joi.boolean().optional(),
  }),
};
