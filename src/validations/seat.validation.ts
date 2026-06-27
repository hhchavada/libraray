import Joi from 'joi';
import { MESSAGES } from '../constants/messages';

export const seatIdParam = Joi.object({
  seatId: Joi.string().hex().length(24).required().messages({
    'string.hex': MESSAGES.INVALID_SEAT_ID,
    'string.length': MESSAGES.INVALID_SEAT_ID,
    'any.required': MESSAGES.INVALID_SEAT_ID,
  }),
});

export const deleteSeatsBody = Joi.object({
  seatIds: Joi.array()
    .items(
      Joi.string().hex().length(24).messages({
        'string.hex': MESSAGES.INVALID_SEAT_ID,
        'string.length': MESSAGES.INVALID_SEAT_ID,
      })
    )
    .min(1)
    .unique()
    .required()
    .messages({
      'array.min': 'At least one seat id is required',
      'any.required': 'seatIds is required',
    }),
});
