import mongoose, { Document, Schema, Types } from 'mongoose';
import { LibrarySubscriptionStatus, SubscriptionPaymentStatus } from '../constants/enums';

export interface ISubscription {
  userId: Types.ObjectId;
  planId: Types.ObjectId;
  razorpayOrderId: string;
  razorpayPaymentLinkId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  amount: number;
  taxableAmount?: number;
  gstAmount?: number;
  razorpayFee?: number;
  razorpayGst?: number;
  netSettlementAmount?: number;
  startDate?: Date;
  endDate?: Date;
  status: LibrarySubscriptionStatus;
  paymentStatus: SubscriptionPaymentStatus;
  /** When true, activation extends the user's current period instead of starting fresh. */
  isExtension: boolean;
  /** When true, a different active plan was replaced on activation. */
  replacedPrevious: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubscriptionDocument extends ISubscription, Document {}

const subscriptionSchema = new Schema<ISubscriptionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: true,
    },
    razorpayOrderId: {
      type: String,
      required: true,
      trim: true,
    },
    razorpayPaymentLinkId: {
      type: String,
      trim: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
    },
    razorpaySignature: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    taxableAmount: { type: Number, min: 0 },
    gstAmount: { type: Number, min: 0 },
    razorpayFee: { type: Number, min: 0 },
    razorpayGst: { type: Number, min: 0 },
    netSettlementAmount: { type: Number, min: 0 },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: Object.values(LibrarySubscriptionStatus),
      default: LibrarySubscriptionStatus.PENDING,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(SubscriptionPaymentStatus),
      default: SubscriptionPaymentStatus.PENDING,
    },
    isExtension: {
      type: Boolean,
      default: false,
    },
    replacedPrevious: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ razorpayOrderId: 1 }, { unique: true });
subscriptionSchema.index(
  { razorpayPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: { razorpayPaymentId: { $type: 'string' } },
  }
);
subscriptionSchema.index({ userId: 1, createdAt: -1 });

export const Subscription = mongoose.model<ISubscriptionDocument>(
  'Subscription',
  subscriptionSchema
);
