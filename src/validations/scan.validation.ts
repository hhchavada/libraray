import Joi from 'joi';
import { ShiftType } from '../constants/enums';
import { optionalRemarks } from './member.validation';

export const scanValidation = {
  getLibraryInfo: Joi.object({
    libraryId: Joi.string().hex().length(24).required(),
    qrCodeId: Joi.string().required(),
  }),

  registerDemoStudent: Joi.object({
    libraryId: Joi.string().hex().length(24).required(),
    qrCodeId: Joi.string().required(),
    fullName: Joi.string().min(2).required(),
    mobileNumber: Joi.string()
      .pattern(/^[0-9]{10}$/)
      .required(),
    shiftType: Joi.string()
      .valid(...Object.values(ShiftType))
      .required(),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date()
      .iso()
      .greater(Joi.ref('startDate'))
      .optional()
      .allow(null)
      .empty(['', null]),
    courseName: Joi.string().optional().allow(''),
    email: Joi.string().email().optional().allow(''),
    remarks: optionalRemarks,
  }),
};
