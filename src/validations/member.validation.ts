import Joi from 'joi';
import {
  ShiftType,
  PaymentStatus,
  PaymentMode,
  MemberStatus,
  normalizeMembershipPlan,
} from '../constants/enums';
import { MESSAGES } from '../constants/messages';

const MEMBER_TYPES = ['permanent', 'demo', 'without-seat'] as const;

const membershipPlanSchema = Joi.string().custom((value, helpers) => {
  const plan = normalizeMembershipPlan(value);
  if (!plan) {
    return helpers.error('any.invalid');
  }
  return plan;
}, 'membership plan');

const normalizeShiftType = (value: string, helpers: Joi.CustomHelpers) => {
  if (value === undefined || value === null || value === '') {
    return value;
  }
  const raw = String(value).trim();
  const key = raw.toLowerCase().replace(/\s+/g, '_');
  const aliases: Record<string, ShiftType> = {
    morning: ShiftType.MORNING,
    evening: ShiftType.EVENING,
    full_day: ShiftType.FULL_DAY,
    fullday: ShiftType.FULL_DAY,
    fullDay: ShiftType.FULL_DAY,
  };
  const normalized = aliases[key] ?? aliases[raw];
  if (!normalized) {
    return helpers.error('any.invalid');
  }
  return normalized;
};

/** Optional everywhere — omit, null, or empty string are all valid. */
export const optionalRemarks = Joi.string().trim().optional().allow(null, '').empty(['', null]);

export const memberIdParam = Joi.object({
  id: Joi.string().hex().length(24).required().messages({
    'string.hex': MESSAGES.INVALID_MEMBER_ID,
    'string.length': MESSAGES.INVALID_MEMBER_ID,
    'any.required': MESSAGES.INVALID_MEMBER_ID,
  }),
});

// Base fields shared by all member types
const baseMemberFields = {
  fullName: Joi.string().required(),
  mobileNumber: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required(),
  shiftType: Joi.string()
    .valid(...Object.values(ShiftType))
    .required(),
  startDate: Joi.date().iso().required(),
  // endDate is required for permanent/without-seat; optional for demo (omit or null)
  endDate: Joi.when('type', {
    is: 'demo',
    then: Joi.date()
      .iso()
      .greater(Joi.ref('startDate'))
      .optional()
      .allow(null)
      .empty(['', null]),
    otherwise: Joi.date().iso().greater(Joi.ref('startDate')).required(),
  }),
  courseName: Joi.string().optional(),
  // email is optional for all member types
  email: Joi.string().email().optional().allow('', null),
  remarks: optionalRemarks,
};

export const memberValidation = {
  createMember: Joi.object({
    type: Joi.string()
      .valid(...MEMBER_TYPES)
      .required(),
    ...baseMemberFields,
    membershipPlan: Joi.when('type', {
      is: 'demo',
      then: Joi.forbidden(),
      otherwise: membershipPlanSchema.required(),
    }),
    feePerMonth: Joi.when('type', {
      is: 'demo',
      then: Joi.forbidden(),
      otherwise: Joi.number().positive().required(),
    }),
    discount: Joi.when('type', {
      is: 'demo',
      then: Joi.forbidden(),
      otherwise: Joi.number().min(0).max(Joi.ref('feePerMonth')).optional(),
    }),
    paymentStatus: Joi.when('type', {
      is: 'demo',
      then: Joi.forbidden(),
      otherwise: Joi.string()
        .valid(...Object.values(PaymentStatus))
        .required(),
    }),
    paymentMode: Joi.when('type', {
      is: 'demo',
      then: Joi.forbidden(),
      otherwise: Joi.string()
        .valid(...Object.values(PaymentMode))
        .required(),
    }),
    amountPaid: Joi.when('type', {
      is: 'demo',
      then: Joi.forbidden(),
      otherwise: Joi.number().min(0).required(),
    }),
    seatId: Joi.when('type', {
      is: 'permanent',
      then: Joi.string().hex().length(24).optional(),
      otherwise: Joi.forbidden(),
    }),
  }),

  updateMember: Joi.object({
    fullName: Joi.string().optional(),
    mobileNumber: Joi.string()
      .pattern(/^[0-9]{10}$/)
      .optional(),
    shiftType: Joi.string()
      .valid(...Object.values(ShiftType))
      .optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    courseName: Joi.string().optional(),
    // email is optional — allow empty string or null
    email: Joi.string().email().optional().allow('', null),
    remarks: optionalRemarks,
    membershipPlan: membershipPlanSchema.optional(),
    feePerMonth: Joi.number().positive().optional(),
    discount: Joi.number().min(0).optional(),
    paymentStatus: Joi.string()
      .valid(...Object.values(PaymentStatus))
      .optional(),
    paymentMode: Joi.string()
      .valid(...Object.values(PaymentMode))
      .optional(),
    amountPaid: Joi.number().min(0).optional(),
    seatId: Joi.string().hex().length(24).optional(),
    status: Joi.string()
      .valid(...Object.values(MemberStatus))
      .optional(),
  }),

  assignSeat: Joi.object({
    seatId: Joi.string().hex().length(24).required().messages({
      'string.hex': MESSAGES.INVALID_SEAT_ID,
      'string.length': MESSAGES.INVALID_SEAT_ID,
      'any.required': MESSAGES.INVALID_SEAT_ID,
    }),
    shiftType: Joi.string().custom(normalizeShiftType, 'shift type').optional(),
  }),

  changeSeat: Joi.object({
    seatId: Joi.string().hex().length(24).required().messages({
      'string.hex': MESSAGES.INVALID_SEAT_ID,
      'string.length': MESSAGES.INVALID_SEAT_ID,
      'any.required': MESSAGES.INVALID_SEAT_ID,
    }),
    shiftType: Joi.string().custom(normalizeShiftType, 'shift type').required().messages({
      'any.required': 'shiftType is required',
      'any.invalid': 'shiftType must be morning, evening, or full_day',
    }),
  }),

  renewMember: Joi.object({
    membershipPlan: membershipPlanSchema.optional(),
    feePerMonth: Joi.number().positive().optional(),
    discount: Joi.number().min(0).optional(),
    amountPaid: Joi.number().min(0).required(),
    paymentMode: Joi.string()
      .valid(...Object.values(PaymentMode))
      .required(),
    remarks: optionalRemarks,
  }),

  convertDemoToPermanent: Joi.object({
    membershipPlan: membershipPlanSchema.required(),
    feePerMonth: Joi.number().positive().required(),
    discount: Joi.number().min(0).max(Joi.ref('feePerMonth')).optional(),
    endDate: Joi.date().iso().required(),
    amountPaid: Joi.number().min(0).required(),
    paymentMode: Joi.string()
      .valid(...Object.values(PaymentMode))
      .required(),
    seatId: Joi.string().hex().length(24).optional().messages({
      'string.hex': MESSAGES.INVALID_SEAT_ID,
      'string.length': MESSAGES.INVALID_SEAT_ID,
    }),
    shiftType: Joi.string().custom(normalizeShiftType, 'shift type').optional(),
    startDate: Joi.date().iso().optional(),
    remarks: optionalRemarks,
  }),
};
