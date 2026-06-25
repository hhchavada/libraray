import Joi from 'joi';
import {
  LibrarySubscriptionStatus,
  PlanCategory,
  PlanDurationType,
  PromoDiscountType,
  SubscriptionPaymentStatus,
} from '../constants/enums';

export const subscriptionValidation = {
  createOrder: Joi.object({
    planId: Joi.string().hex().length(24).required(),
    confirmReplace: Joi.boolean().optional().default(false),
    promoCode: Joi.string().trim().min(2).max(40).optional(),
  }),

  validatePromo: Joi.object({
    planId: Joi.string().hex().length(24).required(),
    promoCode: Joi.string().trim().min(2).max(40).required(),
  }),

  verifyPayment: Joi.object({
    razorpay_subscription_id: Joi.string().required(),
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
    baseAmount: Joi.number().positive().required(),
    amount: Joi.number().positive().required(),
    savingPercent: Joi.number().min(0).max(100).required(),
    perMonthAmount: Joi.number().positive().required(),
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
    baseAmount: Joi.number().positive().optional(),
    amount: Joi.number().positive().optional(),
    savingPercent: Joi.number().min(0).max(100).optional(),
    perMonthAmount: Joi.number().positive().optional(),
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

  adminCreatePromo: Joi.object({
    code: Joi.string().trim().min(2).max(40).required(),
    discountType: Joi.string()
      .valid(...Object.values(PromoDiscountType))
      .required(),
    discountValue: Joi.number().positive().required(),
    discountLabel: Joi.string().trim().max(120).optional(),
    billingCycles: Joi.number().integer().min(1).optional(),
    applicablePlanIds: Joi.array().items(Joi.string().hex().length(24)).optional().default([]),
    maxUses: Joi.number().integer().min(1).optional(),
    validFrom: Joi.date().iso().optional(),
    validUntil: Joi.date().iso().optional(),
    isActive: Joi.boolean().optional().default(true),
  }),

  adminUpdatePromo: Joi.object({
    code: Joi.string().trim().min(2).max(40).optional(),
    discountType: Joi.string()
      .valid(...Object.values(PromoDiscountType))
      .optional(),
    discountValue: Joi.number().positive().optional(),
    discountLabel: Joi.string().trim().max(120).optional().allow(''),
    billingCycles: Joi.number().integer().min(1).optional().allow(null),
    applicablePlanIds: Joi.array().items(Joi.string().hex().length(24)).optional(),
    maxUses: Joi.number().integer().min(1).optional().allow(null),
    validFrom: Joi.date().iso().optional().allow(null),
    validUntil: Joi.date().iso().optional().allow(null),
    isActive: Joi.boolean().optional(),
  }).min(1),
};
