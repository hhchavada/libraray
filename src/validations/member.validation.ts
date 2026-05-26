import Joi from 'joi';
import {
  ShiftType,
  PaymentStatus,
  PaymentMode,
  MembershipPlan,
  MemberStatus,
} from '../constants/enums';

const MEMBER_TYPES = ['permanent', 'demo', 'without-seat'] as const;

const baseMemberFields = {
  fullName: Joi.string().required(),
  mobileNumber: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required(),
  shiftType: Joi.string()
    .valid(...Object.values(ShiftType))
    .required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
  courseName: Joi.string().optional(),
  email: Joi.string().email().optional(),
  remarks: Joi.string().optional(),
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
      otherwise: Joi.string()
        .valid(...Object.values(MembershipPlan))
        .required(),
    }),
    feePerMonth: Joi.when('type', {
      is: 'demo',
      then: Joi.forbidden(),
      otherwise: Joi.number().positive().required(),
    }),
    discount: Joi.when('type', {
      is: 'demo',
      then: Joi.forbidden(),
      otherwise: Joi.number().min(0).max(100).optional(),
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
    email: Joi.string().email().optional(),
    remarks: Joi.string().optional(),
    membershipPlan: Joi.string()
      .valid(...Object.values(MembershipPlan))
      .optional(),
    feePerMonth: Joi.number().positive().optional(),
    discount: Joi.number().min(0).max(100).optional(),
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
};
