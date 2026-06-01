import Joi from 'joi';
import {
  LibrarySubscriptionStatus,
  PlanCategory,
  PlanDurationType,
  SubscriptionPaymentStatus,
} from '../constants/enums';

export const subscriptionValidation = {
  createOrder: Joi.object({
    planId: Joi.string().hex().length(24).required(),
    confirmReplace: Joi.boolean().optional().default(false),
  }),

  verifyPayment: Joi.object({
    razorpay_order_id: Joi.string().required(),
    razorpay_payment_id: Joi.string().required(),
    razorpay_signature: Joi.string().required(),
  }),

  adminCreatePlan: Joi.object({
    name: Joi.string().min(3).max(120).required(),
    category: Joi.string()
      .valid(...Object.values(PlanCategory))
      .required(),
    seatsMin: Joi.number().integer().min(0).required(),
    seatsMax: Joi.number().integer().min(1).required(),
    durationType: Joi.string()
      .valid(...Object.values(PlanDurationType))
      .required(),
    durationMonths: Joi.number().integer().min(1).max(24).required(),
    amount: Joi.number().positive().required(),
    currency: Joi.string().length(3).uppercase().optional().default('INR'),
    isActive: Joi.boolean().optional().default(true),
  }),

  adminUpdatePlan: Joi.object({
    name: Joi.string().min(3).max(120).optional(),
    category: Joi.string()
      .valid(...Object.values(PlanCategory))
      .optional(),
    seatsMin: Joi.number().integer().min(0).optional(),
    seatsMax: Joi.number().integer().min(1).optional(),
    durationType: Joi.string()
      .valid(...Object.values(PlanDurationType))
      .optional(),
    durationMonths: Joi.number().integer().min(1).max(24).optional(),
    amount: Joi.number().positive().optional(),
    currency: Joi.string().length(3).uppercase().optional(),
    isActive: Joi.boolean().optional(),
  }).min(1),

  adminListSubscriptions: Joi.object({
    status: Joi.string()
      .valid(...Object.values(LibrarySubscriptionStatus))
      .optional(),
    paymentStatus: Joi.string()
      .valid(...Object.values(SubscriptionPaymentStatus))
      .optional(),
  }),
};
