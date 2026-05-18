import mongoose, { Document, Schema } from 'mongoose';
import { SubscriptionPlanType } from '../constants/enums';

export interface ISubscriptionPlan {
  name: string;
  planType: SubscriptionPlanType;
  razorpayPlanId: string;
  price: number;
  interval: number;
  intervalType: string;
  maxLibraries: number;
  features: string[];
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
    planType: {
      type: String,
      enum: Object.values(SubscriptionPlanType),
      required: true,
      unique: true,
    },
    razorpayPlanId: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    interval: {
      type: Number,
      required: true,
      default: 1,
    },
    intervalType: {
      type: String,
      default: 'monthly',
    },
    maxLibraries: {
      type: Number,
      default: 1,
    },
    features: {
      type: [String],
      default: [],
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

export const SubscriptionPlan = mongoose.model<ISubscriptionPlanDocument>(
  'SubscriptionPlan',
  subscriptionPlanSchema
);
