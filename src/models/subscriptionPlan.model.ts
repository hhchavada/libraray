import mongoose, { Document, Schema } from 'mongoose';
import { PlanCategory, PlanDurationType } from '../constants/enums';

export interface ISubscriptionPlan {
  name: string;
  category: PlanCategory;
  seatsMin: number;
  seatsMax: number;
  durationType: PlanDurationType;
  durationMonths: number;
  /** Original list price before discount */
  baseAmount: number;
  /** Discounted price charged to the library owner */
  amount: number;
  /** Percentage saved vs base plan (e.g. 60.12) */
  savingPercent: number;
  /** Effective monthly cost under the discounted plan */
  perMonthAmount: number;
  currency: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubscriptionPlanDocument extends ISubscriptionPlan, Document {}

const subscriptionPlanSchema = new Schema<ISubscriptionPlanDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: Object.values(PlanCategory),
      required: true,
    },
    seatsMin: {
      type: Number,
      required: true,
      min: 0,
    },
    seatsMax: {
      type: Number,
      required: true,
      min: 1,
    },
    durationType: {
      type: String,
      enum: Object.values(PlanDurationType),
      required: true,
    },
    durationMonths: {
      type: Number,
      required: true,
      min: 1,
    },
    baseAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    savingPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    perMonthAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

subscriptionPlanSchema.index({ category: 1, durationType: 1 }, { unique: true });
subscriptionPlanSchema.index({ isActive: 1 });

export const SubscriptionPlan = mongoose.model<ISubscriptionPlanDocument>(
  'SubscriptionPlan',
  subscriptionPlanSchema
);
