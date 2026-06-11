import Joi from 'joi';
import { GRID_INDEX_MAX, GRID_INDEX_MIN } from '../utils/seatGrid.util';

/** FE sends: seatNumber, row (0–25), column (0–25) */
const seatPlacementSchema = Joi.object({
  seatNumber: Joi.number().integer().min(1).required(),
  row: Joi.number().integer().min(GRID_INDEX_MIN).max(GRID_INDEX_MAX).required(),
  column: Joi.number().integer().min(GRID_INDEX_MIN).max(GRID_INDEX_MAX).required(),
});

export const libraryValidation = {
  createLibrary: Joi.object({
    libraryName: Joi.string().min(2).max(100).required(),
    address: Joi.string().min(5).required(),
    state: Joi.string().trim().max(100).optional().allow('', null),
    city: Joi.string().trim().max(100).optional().allow('', null),
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
    state: Joi.string().trim().max(100).optional().allow('', null),
    city: Joi.string().trim().max(100).optional().allow('', null),
    totalSeats: Joi.number().integer().min(1).max(1000).optional(),
    hasCustomSeatMap: Joi.boolean().optional(),
  }),
};
