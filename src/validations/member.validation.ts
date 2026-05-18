import Joi from 'joi';
import {
  MemberType,
  ShiftType,
  PaymentStatus,
  PaymentMode,
  MembershipPlan,
  MemberStatus,
} from '../constants/enums';

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

const permanentFields = {
  ...baseMemberFields,
  memberType: Joi.string().valid(MemberType.PERMANENT).required(),
  membershipPlan: Joi.string()
    .valid(...Object.values(MembershipPlan))
    .required(),
  feePerMonth: Joi.number().positive().required(),
  discount: Joi.number().min(0).max(100).optional(),
  paymentStatus: Joi.string()
    .valid(...Object.values(PaymentStatus))
    .required(),
  paymentMode: Joi.string()
    .valid(...Object.values(PaymentMode))
    .required(),
  amountPaid: Joi.number().min(0).required(),
  seatId: Joi.string().hex().length(24).optional(),
};

export const memberValidation = {
  createPermanentMember: Joi.object(permanentFields),

  createDemoMember: Joi.object({
    ...baseMemberFields,
    memberType: Joi.string().valid(MemberType.DEMO).required(),
  }),

  createMemberWithoutSeat: Joi.object({
    ...permanentFields,
    memberType: Joi.string().valid(MemberType.WITHOUT_SEAT).required(),
    seatId: Joi.forbidden(),
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
