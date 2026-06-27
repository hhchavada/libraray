import mongoose from 'mongoose';
import { PromoCode, IPromoCodeDocument } from '../models/promoCode.model';
import { Subscription } from '../models/subscription.model';
import { ISubscriptionPlanDocument } from '../models/subscriptionPlan.model';
import {
  LibrarySubscriptionStatus,
  PromoDiscountType,
  SubscriptionPaymentStatus,
} from '../constants/enums';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';

const MIN_DISCOUNTED_AMOUNT_RUPEES = 1;

export interface PromoPricingPreview {
  promoCode: string;
  valid: true;
  originalAmount: number;
  discountedAmount: number;
  /** Auto-debit amount after the promo period (same as original when billingCycles is 1). */
  recurringAmount: number;
  discountLabel: string;
  currency: string;
  /** null = discounted price on every cycle; 1 = first cycle only, etc. */
  billingCycles: number | null;
}

export const promoService = {
  normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  },

  buildDiscountLabel(promo: IPromoCodeDocument): string {
    if (promo.discountLabel?.trim()) {
      return promo.discountLabel.trim();
    }
    const base =
      promo.discountType === PromoDiscountType.PERCENTAGE
        ? `${promo.discountValue}% off`
        : `₹${promo.discountValue} off`;
    if (promo.billingCycles === 1) {
      return `${base} first month`;
    }
    if (promo.billingCycles != null && promo.billingCycles > 1) {
      return `${base} for ${promo.billingCycles} months`;
    }
    return `${base} every month`;
  },

  calculateDiscountedAmount(planAmountRupees: number, promo: IPromoCodeDocument): number {
    let result: number;
    if (promo.discountType === PromoDiscountType.PERCENTAGE) {
      if (promo.discountValue > 100) {
        throw new ApiError(400, MESSAGES.PROMO_INVALID_CONFIGURATION);
      }
      result = planAmountRupees * (1 - promo.discountValue / 100);
    } else {
      result = planAmountRupees - promo.discountValue;
    }
    // Whole rupees only — plan prices and mobile clients expect integer amounts (no 64.9).
    const rounded = Math.round(result);
    if (rounded < MIN_DISCOUNTED_AMOUNT_RUPEES) {
      throw new ApiError(400, MESSAGES.PROMO_DISCOUNT_TOO_HIGH);
    }
    return rounded;
  },

  buildPricingPreview(
    promo: IPromoCodeDocument,
    plan: ISubscriptionPlanDocument
  ): PromoPricingPreview {
    const originalAmount = plan.amount;
    const discountedAmount = this.calculateDiscountedAmount(originalAmount, promo);
    const recurringAmount =
      promo.billingCycles == null ? discountedAmount : originalAmount;
    return {
      promoCode: promo.code,
      valid: true,
      originalAmount,
      discountedAmount,
      recurringAmount,
      discountLabel: this.buildDiscountLabel(promo),
      currency: plan.currency ?? 'INR',
      billingCycles: promo.billingCycles ?? null,
    };
  },

  async getLibraryPromoUsageCount(
    promoCodeId: mongoose.Types.ObjectId | string,
    userId: mongoose.Types.ObjectId | string
  ): Promise<number> {
    return Subscription.countDocuments({
      promoCodeId,
      userId,
      paymentStatus: {
        $in: [SubscriptionPaymentStatus.PAID, SubscriptionPaymentStatus.PENDING],
      },
      status: { $ne: LibrarySubscriptionStatus.CANCELLED },
    });
  },

  async assertPromoApplicable(
    promo: IPromoCodeDocument,
    planId: string,
    userId?: string
  ): Promise<void> {
    if (!promo.isActive) {
      throw new ApiError(400, MESSAGES.PROMO_INVALID);
    }

    const now = new Date();
    if (promo.validFrom && now < promo.validFrom) {
      throw new ApiError(400, MESSAGES.PROMO_NOT_STARTED);
    }
    if (promo.validUntil && now > promo.validUntil) {
      throw new ApiError(400, MESSAGES.PROMO_EXPIRED);
    }

    if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
      throw new ApiError(400, MESSAGES.PROMO_USAGE_LIMIT_REACHED);
    }

    if (userId && promo.maxUsesPerLibrary != null) {
      const libraryUses = await this.getLibraryPromoUsageCount(promo._id, userId);
      if (libraryUses >= promo.maxUsesPerLibrary) {
        throw new ApiError(400, MESSAGES.PROMO_LIBRARY_USAGE_LIMIT_REACHED);
      }
    }

    if (promo.applicablePlanIds.length > 0) {
      const allowed = promo.applicablePlanIds.some((id) => String(id) === planId);
      if (!allowed) {
        throw new ApiError(400, MESSAGES.PROMO_NOT_APPLICABLE_TO_PLAN);
      }
    }
  },

  async findValidPromoForPlan(
    rawCode: string,
    plan: ISubscriptionPlanDocument,
    userId?: string
  ): Promise<IPromoCodeDocument> {
    const code = this.normalizeCode(rawCode);
    if (!code) {
      throw new ApiError(400, MESSAGES.PROMO_INVALID);
    }

    const promo = await PromoCode.findOne({ code });
    if (!promo) {
      throw new ApiError(400, MESSAGES.PROMO_INVALID);
    }

    await this.assertPromoApplicable(promo, String(plan._id), userId);
    return promo;
  },

  async recordUsage(promoCodeId: mongoose.Types.ObjectId | string): Promise<void> {
    await PromoCode.updateOne({ _id: promoCodeId }, { $inc: { usedCount: 1 } });
  },

  async adminCreatePromo(
    payload: Partial<IPromoCodeDocument>
  ): Promise<IPromoCodeDocument> {
    if (payload.code) {
      payload.code = this.normalizeCode(payload.code);
      const existing = await PromoCode.findOne({ code: payload.code });
      if (existing) {
        throw new ApiError(409, MESSAGES.PROMO_CODE_ALREADY_EXISTS);
      }
    }
    return PromoCode.create(payload);
  },

  async adminUpdatePromo(
    promoId: string,
    payload: Partial<IPromoCodeDocument>
  ): Promise<IPromoCodeDocument> {
    if (!mongoose.Types.ObjectId.isValid(promoId)) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }
    if (payload.code) {
      payload.code = this.normalizeCode(payload.code);
      const existing = await PromoCode.findOne({
        code: payload.code,
        _id: { $ne: promoId },
      });
      if (existing) {
        throw new ApiError(409, MESSAGES.PROMO_CODE_ALREADY_EXISTS);
      }
    }

    const promo = await PromoCode.findByIdAndUpdate(promoId, payload, {
      new: true,
      runValidators: true,
    });
    if (!promo) {
      throw new ApiError(404, MESSAGES.PROMO_NOT_FOUND);
    }
    return promo;
  },

  async adminDisablePromo(promoId: string): Promise<IPromoCodeDocument> {
    return this.adminUpdatePromo(promoId, { isActive: false });
  },

  async adminListPromos(): Promise<IPromoCodeDocument[]> {
    return PromoCode.find().sort({ createdAt: -1 });
  },
};
