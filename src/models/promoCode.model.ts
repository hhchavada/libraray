import mongoose, { Document, Schema, Types } from 'mongoose';
import { PromoDiscountType } from '../constants/enums';

export interface IPromoCode {
  /** User-facing code, stored uppercase (e.g. BRIDGR50). */
  code: string;
  discountType: PromoDiscountType;
  /** Percentage (0–100) or flat amount in rupees. */
  discountValue: number;
  /** Shown in app checkout preview (e.g. "50% off first month"). */
  discountLabel?: string;
  /**
   * How many billing cycles the discounted price applies.
   * Omit = discount applies on every recurring charge (forever).
   * 1 = first cycle only, then full plan price from next cycle.
   */
  billingCycles?: number;
  /** Empty = all active plans. */
  applicablePlanIds: Types.ObjectId[];
  maxUses?: number;
  /** Max times a single library (owner) can redeem this code. Omit = unlimited. */
  maxUsesPerLibrary?: number;
  usedCount: number;
  validFrom?: Date;
  validUntil?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPromoCodeDocument extends IPromoCode, Document {}

const promoCodeSchema = new Schema<IPromoCodeDocument>(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
    },
    discountType: {
      type: String,
      enum: Object.values(PromoDiscountType),
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    discountLabel: {
      type: String,
      trim: true,
    },
    billingCycles: {
      type: Number,
      min: 1,
    },
    applicablePlanIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'SubscriptionPlan' }],
      default: [],
    },
    maxUses: {
      type: Number,
      min: 1,
    },
    maxUsesPerLibrary: {
      type: Number,
      min: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    validFrom: {
      type: Date,
    },
    validUntil: {
      type: Date,
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

promoCodeSchema.index({ isActive: 1, code: 1 });

export const PromoCode = mongoose.model<IPromoCodeDocument>('PromoCode', promoCodeSchema);
