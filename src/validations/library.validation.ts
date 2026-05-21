import Joi from 'joi';

/** FE sends: seatNumber, row, column per selected seat */
const seatPlacementSchema = Joi.object({
  seatNumber: Joi.number().integer().min(1).required(),
  row: Joi.string().trim().uppercase().min(1).max(3).required(),
  column: Joi.string().trim().uppercase().min(1).max(3).required(),
});

export const libraryValidation = {
  createLibrary: Joi.object({
    libraryName: Joi.string().min(2).max(100).required(),
    address: Joi.string().min(5).required(),
    seatMapType: Joi.string().valid('default', 'custom').required(),
    totalSeats: Joi.when('seatMapType', {
      is: 'default',
      then: Joi.number().integer().min(1).max(1000).required(),
      otherwise: Joi.forbidden(),
    }),
    selectedSeats: Joi.when('seatMapType', {
      is: 'custom',
      then: Joi.array().items(seatPlacementSchema).min(1).max(1000).required(),
      otherwise: Joi.forbidden(),
    }),
  }),

  updateLibrary: Joi.object({
    libraryName: Joi.string().min(2).max(100).optional(),
    address: Joi.string().min(5).optional(),
    totalSeats: Joi.number().integer().min(1).max(1000).optional(),
    hasCustomSeatMap: Joi.boolean().optional(),
  }),
};
