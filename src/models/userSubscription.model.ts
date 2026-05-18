import mongoose, { Document, Schema, Types } from 'mongoose';
import { SubscriptionStatus } from '../constants/enums';

export interface IUserSubscription {
  user: Types.ObjectId;
  plan: Types.ObjectId;
  razorpaySubscriptionId: string;
  status: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelledAt?: Date;
  razorpayCustomerId?: string;
  shortUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserSubscriptionDocument extends IUserSubscription, Document {}

const userSubscriptionSchema = new Schema<IUserSubscriptionDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    plan: {
      type: Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: true,
    },
    razorpaySubscriptionId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      default: SubscriptionStatus.CREATED,
    },
    currentPeriodStart: {
      type: Date,
    },
    currentPeriodEnd: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    razorpayCustomerId: {
      type: String,
    },
    shortUrl: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

userSubscriptionSchema.index({ user: 1, status: 1 });

export const UserSubscription = mongoose.model<IUserSubscriptionDocument>(
  'UserSubscription',
  userSubscriptionSchema
);
