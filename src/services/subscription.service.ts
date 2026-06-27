import mongoose from 'mongoose';
import {
  SubscriptionPlan,
  ISubscriptionPlanDocument,
} from '../models/subscriptionPlan.model';
import { Subscription, ISubscriptionDocument } from '../models/subscription.model';
import { IPromoCodeDocument } from '../models/promoCode.model';
import { User } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import {
  LibrarySubscriptionStatus,
  PlanCategory,
  SubscriptionPaymentStatus,
} from '../constants/enums';
import {
  PLAN_CATEGORY_LABELS,
  SUBSCRIPTION_PLANS_SEED,
} from '../constants/subscriptionPlans.data';
import { formatRazorpayContact, razorpayService, toRazorpayCustomerContact, RazorpaySubscriptionDetails } from './razorpay.service';
import { promoService, PromoPricingPreview } from './promo.service';
import { addMonths, toRupeesPaise } from '../utils/subscription.util';
import { calculateGstBreakdown } from '../utils/gst.util';
import { endFreeTrialForUser } from '../utils/freeTrial.util';
import { logger } from '../utils/logger';

const LOG_TAG = 'Subscription';

export type PlanWithAutoDebit = ISubscriptionPlanDocument & PlanClientMeta;

export type GroupedPlans = Record<string, PlanWithAutoDebit[]>;

interface PlanClientMeta {
  autoDebit: true;
  /** Months between automatic Razorpay charges (1 = every month). */
  chargesEveryMonths: number;
  billingLabel: string;
}

const enrichPlan = (plan: ISubscriptionPlanDocument): PlanWithAutoDebit =>
  Object.assign(plan, {
    autoDebit: true as const,
    chargesEveryMonths: plan.durationMonths,
    billingLabel:
      plan.durationMonths === 1
        ? 'Billed automatically every month'
        : `Billed automatically every ${plan.durationMonths} months`,
  });

interface RazorpayWebhookEntity {
  id: string;
  notes?: Record<string, string>;
  plan_id?: string;
  status?: string;
}

interface RazorpayWebhookPayload {
  subscription?: { entity: RazorpayWebhookEntity };
  payment?: { entity: { id: string; subscription_id?: string } };
  invoice?: { entity: { subscription_id?: string; payment_id?: string } };
}

interface RazorpayWebhookEvent {
  event: string;
  payload: RazorpayWebhookPayload;
}

const ensureRazorpayPlan = async (
  plan: ISubscriptionPlanDocument
): Promise<string> => {
  if (plan.razorpayPlanId) {
    try {
      const existing = await razorpayService.fetchPlan(plan.razorpayPlanId);
      const existingAmount = Number((existing as { item?: { amount?: number } }).item?.amount);
      if (existingAmount === toRupeesPaise(plan.amount)) {
        return plan.razorpayPlanId;
      }
      logger.info(LOG_TAG, 'Plan amount changed — creating new Razorpay plan', {
        planId: plan._id,
        oldRazorpayPlanId: plan.razorpayPlanId,
      });
    } catch {
      logger.warn(LOG_TAG, 'Stored Razorpay plan not found — recreating', {
        razorpayPlanId: plan.razorpayPlanId,
      });
    }
  }

  const razorpayPlan = await razorpayService.createPlan({
    name: plan.name,
    amountInRupees: plan.amount,
    currency: plan.currency,
    intervalMonths: plan.durationMonths,
    notes: {
      mongoPlanId: String(plan._id),
      category: plan.category,
      durationType: plan.durationType,
    },
  });

  plan.razorpayPlanId = razorpayPlan.id;
  await plan.save();

  return razorpayPlan.id;
};

/** Razorpay plan at a promo/discounted amount — managed entirely by backend (no Razorpay offers). */
const ensureRazorpayPlanAtAmount = async (
  plan: ISubscriptionPlanDocument,
  amountInRupees: number,
  promoCode?: string
): Promise<string> => {
  if (amountInRupees === plan.amount) {
    return ensureRazorpayPlan(plan);
  }

  const razorpayPlan = await razorpayService.createPlan({
    name: promoCode ? `${plan.name} (${promoCode})` : `${plan.name} (Promo)`,
    amountInRupees,
    currency: plan.currency,
    intervalMonths: plan.durationMonths,
    notes: {
      mongoPlanId: String(plan._id),
      category: plan.category,
      durationType: plan.durationType,
      promoCode: promoCode ?? '',
      promoAmount: String(amountInRupees),
    },
  });

  return razorpayPlan.id;
};

const schedulePromoRevertToFullPrice = async (
  subscription: ISubscriptionDocument
): Promise<void> => {
  if (!subscription.razorpaySubscriptionId || subscription.promoBillingCycles !== 1) {
    return;
  }
  if (subscription.promoRevertScheduled) {
    return;
  }

  const plan = await SubscriptionPlan.findById(subscription.planId);
  if (!plan) {
    return;
  }

  let rzSub: RazorpaySubscriptionDetails;
  try {
    rzSub = await razorpayService.fetchSubscription(subscription.razorpaySubscriptionId);
  } catch (err) {
    logger.warn(LOG_TAG, 'Could not fetch Razorpay subscription for promo revert', {
      subscriptionId: subscription._id,
      razorpaySubscriptionId: subscription.razorpaySubscriptionId,
      err,
    });
    return;
  }

  const schedulableStatuses = ['active', 'authenticated', 'completed'];
  if (!schedulableStatuses.includes(rzSub.status)) {
    logger.info(LOG_TAG, 'Promo revert deferred until subscription is active', {
      subscriptionId: subscription._id,
      razorpaySubscriptionId: subscription.razorpaySubscriptionId,
      status: rzSub.status,
    });
    return;
  }

  const fullPlanId = await ensureRazorpayPlan(plan);
  if (rzSub.plan_id === fullPlanId) {
    await Subscription.updateOne(
      { _id: subscription._id },
      { $set: { promoRevertScheduled: true } }
    );
    return;
  }

  try {
    await razorpayService.updateSubscriptionPlan(
      subscription.razorpaySubscriptionId,
      fullPlanId,
      'cycle_end'
    );
    await Subscription.updateOne(
      { _id: subscription._id },
      { $set: { promoRevertScheduled: true } }
    );
    logger.info(LOG_TAG, 'Scheduled Razorpay subscription revert to full plan price', {
      subscriptionId: subscription._id,
      razorpaySubscriptionId: subscription.razorpaySubscriptionId,
      promoBillingCycles: subscription.promoBillingCycles,
      fullPlanId,
      fullAmount: plan.amount,
    });
  } catch (err) {
    logger.warn(LOG_TAG, 'Could not schedule promo revert to full plan price', {
      subscriptionId: subscription._id,
      razorpaySubscriptionId: subscription.razorpaySubscriptionId,
      err,
    });
  }
};

const schedulePromoRevertByRazorpayId = async (
  razorpaySubscriptionId: string
): Promise<void> => {
  const subscription = await Subscription.findOne({ razorpaySubscriptionId }).sort({
    createdAt: -1,
  });
  if (subscription) {
    await schedulePromoRevertToFullPrice(subscription);
  }
};

export const subscriptionService = {
  async getPlansGrouped(): Promise<GroupedPlans> {
    const plans = await SubscriptionPlan.find({ isActive: true })
      .sort({ seatsMin: 1, durationMonths: 1 });

    const grouped: GroupedPlans = {};
    for (const category of Object.values(PlanCategory)) {
      grouped[PLAN_CATEGORY_LABELS[category]] = plans
        .filter((p) => p.category === category)
        .map((p) => enrichPlan(p));
    }
    return grouped;
  },

  async findActiveSubscription(
    userId: string,
    populatePlan = false
  ): Promise<ISubscriptionDocument | null> {
    const now = new Date();
    let query = Subscription.findOne({
      userId,
      status: LibrarySubscriptionStatus.ACTIVE,
      paymentStatus: SubscriptionPaymentStatus.PAID,
      endDate: { $gt: now },
    }).sort({ endDate: -1 });

    if (populatePlan) {
      query = query.populate('planId');
    }

    const active = await query;

    if (active) {
      return active;
    }

    await Subscription.updateMany(
      {
        userId,
        status: LibrarySubscriptionStatus.ACTIVE,
        endDate: { $lte: now },
      },
      { $set: { status: LibrarySubscriptionStatus.EXPIRED } }
    );

    return null;
  },

  async activateSubscription(
    subscription: ISubscriptionDocument,
    razorpayPaymentId: string,
    razorpaySignature?: string
  ): Promise<ISubscriptionDocument> {
    const userId = String(subscription.userId);

    const duplicatePayment = await Subscription.findOne({
      razorpayPaymentId,
      paymentStatus: SubscriptionPaymentStatus.PAID,
      _id: { $ne: subscription._id },
    });
    if (duplicatePayment) {
      throw new ApiError(409, MESSAGES.SUBSCRIPTION_DUPLICATE_PAYMENT);
    }

    if (subscription.paymentStatus === SubscriptionPaymentStatus.PAID) {
      return subscription.populate('planId');
    }

    const plan = await SubscriptionPlan.findById(subscription.planId);
    if (!plan) {
      throw new ApiError(500, MESSAGES.SUBSCRIPTION_PLAN_NOT_FOUND);
    }

    const now = new Date();
    let startDate = now;
    let endDate = addMonths(now, plan.durationMonths);

    if (subscription.isExtension) {
      const active = await this.findActiveSubscription(userId);
      if (active?.endDate) {
        const base = active.endDate > now ? active.endDate : now;
        startDate = active.startDate ?? now;
        endDate = addMonths(base, plan.durationMonths);
        active.status = LibrarySubscriptionStatus.EXPIRED;
        await active.save();
      }
    } else {
      await Subscription.updateMany(
        {
          userId,
          status: LibrarySubscriptionStatus.ACTIVE,
          _id: { $ne: subscription._id },
        },
        { $set: { status: LibrarySubscriptionStatus.CANCELLED } }
      );
    }

    const gst = calculateGstBreakdown(
      subscription.promoDiscountedAmount ?? subscription.amount
    );

    subscription.razorpayPaymentId = razorpayPaymentId;
    if (razorpaySignature) subscription.razorpaySignature = razorpaySignature;
    if (subscription.razorpaySubscriptionId) subscription.isRecurring = true;
    subscription.paymentStatus = SubscriptionPaymentStatus.PAID;
    subscription.status = LibrarySubscriptionStatus.ACTIVE;
    subscription.startDate = startDate;
    subscription.endDate = endDate;
    subscription.taxableAmount = gst.taxableAmount;
    subscription.gstAmount = gst.gstAmount;
    subscription.razorpayFee = gst.razorpayFee;
    subscription.razorpayGst = gst.razorpayGst;
    subscription.netSettlementAmount = gst.netSettlementAmount;
    await subscription.save();

    if (subscription.promoCodeId) {
      await promoService.recordUsage(subscription.promoCodeId);
    }

    if (subscription.promoBillingCycles === 1) {
      await schedulePromoRevertToFullPrice(subscription);
    }

    await endFreeTrialForUser(userId);

    logger.info(LOG_TAG, 'Subscription activated', {
      subscriptionId: subscription._id,
      userId,
      endDate,
    });

    return subscription.populate('planId');
  },

  async linkPendingSubscription(
    razorpaySubscriptionId: string,
    notes?: Record<string, string>
  ): Promise<ISubscriptionDocument | null> {
    if (notes?.subscriptionId && mongoose.Types.ObjectId.isValid(notes.subscriptionId)) {
      const byId = await Subscription.findById(notes.subscriptionId);
      if (byId && byId.paymentStatus === SubscriptionPaymentStatus.PENDING) {
        byId.razorpaySubscriptionId = razorpaySubscriptionId;
        await byId.save();
        logger.info(LOG_TAG, 'Linked subscription via notes.subscriptionId', {
          mongoId: byId._id,
          razorpaySubscriptionId,
        });
        return byId;
      }
    }

    if (notes?.userId && mongoose.Types.ObjectId.isValid(notes.userId)) {
      const byUser = await Subscription.findOne({
        userId: notes.userId,
        paymentStatus: SubscriptionPaymentStatus.PENDING,
        status: LibrarySubscriptionStatus.PENDING,
      }).sort({ createdAt: -1 });

      if (byUser) {
        byUser.razorpaySubscriptionId = razorpaySubscriptionId;
        await byUser.save();
        logger.info(LOG_TAG, 'Linked subscription via notes.userId', {
          mongoId: byUser._id,
          razorpaySubscriptionId,
        });
        return byUser;
      }
    }

    return null;
  },

  async processRecurringCharge(
    razorpaySubscriptionId: string,
    razorpayPaymentId: string,
    notes?: Record<string, string>
  ): Promise<ISubscriptionDocument | null> {
    if (!razorpayPaymentId) {
      logger.warn(LOG_TAG, 'Recurring charge without payment id', { razorpaySubscriptionId });
      return null;
    }

    const duplicatePayment = await Subscription.findOne({
      razorpayPaymentId,
      paymentStatus: SubscriptionPaymentStatus.PAID,
    });
    if (duplicatePayment) {
      logger.info(LOG_TAG, 'Idempotent recurring charge — already processed', {
        paymentId: razorpayPaymentId,
      });
      await schedulePromoRevertByRazorpayId(razorpaySubscriptionId);
      return duplicatePayment.populate('planId');
    }

    let pending = await Subscription.findOne({
      razorpaySubscriptionId,
      paymentStatus: SubscriptionPaymentStatus.PENDING,
    }).sort({ createdAt: -1 });

    if (!pending) {
      const linked = await this.linkPendingSubscription(razorpaySubscriptionId, notes);
      if (linked) {
        return this.activateSubscription(linked, razorpayPaymentId);
      }
    }

    if (pending) {
      return this.activateSubscription(pending, razorpayPaymentId);
    }

    const active = await Subscription.findOne({
      razorpaySubscriptionId,
      status: LibrarySubscriptionStatus.ACTIVE,
      paymentStatus: SubscriptionPaymentStatus.PAID,
    }).sort({ endDate: -1 });

    if (!active) {
      logger.warn(LOG_TAG, 'Recurring charge — no matching subscription', {
        razorpaySubscriptionId,
      });
      return null;
    }

    const plan = await SubscriptionPlan.findById(active.planId);
    if (!plan) {
      throw new ApiError(500, MESSAGES.SUBSCRIPTION_PLAN_NOT_FOUND);
    }

    const now = new Date();
    const base = active.endDate && active.endDate > now ? active.endDate : now;
    const startDate = base;
    const endDate = addMonths(base, plan.durationMonths);
    const gst = calculateGstBreakdown(plan.amount);

    active.status = LibrarySubscriptionStatus.EXPIRED;
    await Subscription.updateOne(
      { _id: active._id },
      {
        $set: { status: LibrarySubscriptionStatus.EXPIRED },
        $unset: { razorpaySubscriptionId: 1 },
      }
    );

    const renewal = await Subscription.create({
      userId: active.userId,
      planId: active.planId,
      razorpaySubscriptionId,
      razorpayCustomerId: active.razorpayCustomerId,
      razorpayPaymentId,
      amount: plan.amount,
      taxableAmount: gst.taxableAmount,
      gstAmount: gst.gstAmount,
      razorpayFee: gst.razorpayFee,
      razorpayGst: gst.razorpayGst,
      netSettlementAmount: gst.netSettlementAmount,
      startDate,
      endDate,
      status: LibrarySubscriptionStatus.ACTIVE,
      paymentStatus: SubscriptionPaymentStatus.PAID,
      isRecurring: true,
      isExtension: true,
      replacedPrevious: false,
    });

    logger.info(LOG_TAG, 'Subscription renewed via auto-debit', {
      subscriptionId: renewal._id,
      razorpaySubscriptionId,
      endDate,
    });

    return renewal.populate('planId');
  },

  async validatePromo(planId: string, promoCode: string, userId: string): Promise<PromoPricingPreview> {
    if (!mongoose.Types.ObjectId.isValid(planId)) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) {
      throw new ApiError(404, MESSAGES.SUBSCRIPTION_PLAN_NOT_FOUND);
    }

    const promo = await promoService.findValidPromoForPlan(promoCode, plan, userId);
    return promoService.buildPricingPreview(promo, plan);
  },

  async createOrder(
    userId: string,
    planId: string,
    confirmReplace = false,
    promoCode?: string
  ): Promise<{
    razorpaySubscriptionId: string;
    amount: number;
    discountedAmount?: number;
    currency: string;
    key: string;
    subscriptionId: string;
    isRecurring: true;
    promoApplied?: {
      code: string;
      discountLabel: string;
      billingCycles: number | null;
      recurringAmount: number;
    };
  }> {
    if (!mongoose.Types.ObjectId.isValid(planId)) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) {
      throw new ApiError(404, MESSAGES.SUBSCRIPTION_PLAN_NOT_FOUND);
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, MESSAGES.USER_NOT_FOUND);
    }

    const active = await this.findActiveSubscription(userId);

    if (active) {
      const activePlanId = String(active.planId);
      if (activePlanId === String(plan._id) && active.razorpaySubscriptionId) {
        throw new ApiError(409, MESSAGES.SUBSCRIPTION_ALREADY_RECURRING);
      }
      if (activePlanId !== String(plan._id) && !confirmReplace) {
        throw new ApiError(409, MESSAGES.SUBSCRIPTION_REPLACE_CONFIRMATION_REQUIRED);
      }
      if (active.razorpaySubscriptionId) {
        try {
          await razorpayService.cancelSubscription(active.razorpaySubscriptionId, false);
        } catch (err) {
          logger.warn(LOG_TAG, 'Could not cancel previous Razorpay subscription', {
            razorpaySubscriptionId: active.razorpaySubscriptionId,
            err,
          });
        }
      }
      active.status = LibrarySubscriptionStatus.CANCELLED;
      await active.save();
    }

    await Subscription.updateMany(
      {
        userId,
        status: LibrarySubscriptionStatus.PENDING,
        paymentStatus: SubscriptionPaymentStatus.PENDING,
      },
      { $set: { status: LibrarySubscriptionStatus.CANCELLED } }
    );

    const razorpayPlanId = await ensureRazorpayPlan(plan);

    let appliedPromo: IPromoCodeDocument | null = null;
    let promoDiscountedRupees: number | undefined;
    let checkoutRazorpayPlanId = razorpayPlanId;
    if (promoCode?.trim()) {
      appliedPromo = await promoService.findValidPromoForPlan(promoCode, plan, userId);
      promoDiscountedRupees = promoService.calculateDiscountedAmount(plan.amount, appliedPromo);
      checkoutRazorpayPlanId = await ensureRazorpayPlanAtAmount(
        plan,
        promoDiscountedRupees,
        appliedPromo.code
      );
    }

    const customer = await razorpayService.findOrCreateCustomer({
      name: user.fullName,
      email: user.email,
      contact: toRazorpayCustomerContact(user.mobileNumber),
    });

    const subscription = await Subscription.create({
      userId,
      planId: plan._id,
      amount: plan.amount,
      promoCode: appliedPromo?.code,
      promoCodeId: appliedPromo?._id,
      promoDiscountedAmount: promoDiscountedRupees,
      promoBillingCycles: appliedPromo?.billingCycles,
      status: LibrarySubscriptionStatus.PENDING,
      paymentStatus: SubscriptionPaymentStatus.PENDING,
      isRecurring: true,
      isExtension: false,
      replacedPrevious: Boolean(active),
    });

    const razorpaySub = await razorpayService.createSubscription({
      planId: checkoutRazorpayPlanId,
      intervalMonths: plan.durationMonths,
      customerId: customer.id,
      notifyEmail: user.email,
      notifyPhone: formatRazorpayContact(user.mobileNumber),
      notes: {
        userId,
        planId: String(plan._id),
        subscriptionId: subscription._id.toString(),
        ...(appliedPromo
          ? {
              promoCode: appliedPromo.code,
              promoAmount: String(promoDiscountedRupees),
            }
          : {}),
      },
    });

    if (!razorpaySub.id) {
      subscription.status = LibrarySubscriptionStatus.CANCELLED;
      await subscription.save();
      throw new ApiError(500, MESSAGES.SUBSCRIPTION_PAYMENT_FAILED);
    }

    subscription.razorpaySubscriptionId = razorpaySub.id;
    subscription.razorpayCustomerId = customer.id;
    await subscription.save();

    const saved = await Subscription.findById(subscription._id).select('razorpaySubscriptionId');
    if (!saved?.razorpaySubscriptionId) {
      logger.error(LOG_TAG, 'razorpaySubscriptionId not persisted after save', {
        subscriptionId: subscription._id,
        razorpayId: razorpaySub.id,
      });
      await Subscription.updateOne(
        { _id: subscription._id },
        { $set: { razorpaySubscriptionId: razorpaySub.id, razorpayCustomerId: customer.id } }
      );
    }

    if (!razorpaySub.id) {
      subscription.status = LibrarySubscriptionStatus.CANCELLED;
      await subscription.save();
      throw new ApiError(500, MESSAGES.SUBSCRIPTION_PAYMENT_FAILED);
    }

    logger.info(LOG_TAG, 'Pending recurring subscription created — open Razorpay Checkout with subscription_id', {
      subscriptionId: subscription._id,
      razorpaySubscriptionId: razorpaySub.id,
      userId,
      shortUrl: razorpaySub.short_url,
    });

    return {
      razorpaySubscriptionId: razorpaySub.id,
      amount: toRupeesPaise(plan.amount),
      discountedAmount:
        promoDiscountedRupees != null ? toRupeesPaise(promoDiscountedRupees) : undefined,
      currency: plan.currency ?? 'INR',
      key: razorpayService.getPublicKey(),
      subscriptionId: subscription._id.toString(),
      isRecurring: true,
      promoApplied: appliedPromo
        ? {
            code: appliedPromo.code,
            discountLabel: promoService.buildDiscountLabel(appliedPromo),
            billingCycles: appliedPromo.billingCycles ?? null,
            recurringAmount:
              appliedPromo.billingCycles === 1 ? plan.amount : promoDiscountedRupees ?? plan.amount,
          }
        : undefined,
    };
  },

  async verifyPayment(
    userId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    razorpaySubscriptionId?: string
  ): Promise<ISubscriptionDocument> {
    const duplicatePayment = await Subscription.findOne({
      razorpayPaymentId,
      paymentStatus: SubscriptionPaymentStatus.PAID,
    });

    if (duplicatePayment) {
      if (String(duplicatePayment.userId) === userId) {
        logger.info(LOG_TAG, 'Idempotent verify — payment already processed', {
          paymentId: razorpayPaymentId,
        });
        if (razorpaySubscriptionId) {
          await schedulePromoRevertByRazorpayId(razorpaySubscriptionId);
        }
        return duplicatePayment.populate('planId');
      }
      throw new ApiError(409, MESSAGES.SUBSCRIPTION_DUPLICATE_PAYMENT);
    }

    if (!razorpaySubscriptionId) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }

    const subscription = await Subscription.findOne({
      razorpaySubscriptionId,
      userId,
    }).populate('planId');

    if (!subscription) {
      throw new ApiError(404, MESSAGES.SUBSCRIPTION_ORDER_NOT_FOUND);
    }

    if (subscription.paymentStatus === SubscriptionPaymentStatus.PAID) {
      return subscription;
    }

    const isValid = razorpayService.verifySubscriptionPaymentSignature(
      razorpayPaymentId,
      razorpaySubscriptionId,
      razorpaySignature
    );

    if (!isValid) {
      subscription.paymentStatus = SubscriptionPaymentStatus.FAILED;
      await subscription.save();
      throw new ApiError(400, MESSAGES.SUBSCRIPTION_INVALID_SIGNATURE);
    }

    return this.activateSubscription(subscription, razorpayPaymentId, razorpaySignature);
  },

  /** Razorpay redirect after subscription checkout (GET) — no auth. */
  async handleSubscriptionCallback(query: Record<string, string | undefined>) {
    const razorpayPaymentId = query.razorpay_payment_id;
    const razorpaySubscriptionId = query.razorpay_subscription_id;
    const razorpaySignature = query.razorpay_signature;

    if (!razorpayPaymentId || !razorpaySubscriptionId || !razorpaySignature) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }

    const isValid = razorpayService.verifySubscriptionPaymentSignature(
      razorpayPaymentId,
      razorpaySubscriptionId,
      razorpaySignature
    );
    if (!isValid) {
      throw new ApiError(400, MESSAGES.SUBSCRIPTION_INVALID_SIGNATURE);
    }

    const subscription = await Subscription.findOne({
      razorpaySubscriptionId,
    });
    if (!subscription) {
      throw new ApiError(404, MESSAGES.SUBSCRIPTION_ORDER_NOT_FOUND);
    }

    return this.activateSubscription(subscription, razorpayPaymentId, razorpaySignature);
  },

  /** Resolve Razorpay rzp.io hosted auth URL for redirect (never api.razorpay.com/.../subscriptions/...). */
  async getPaymentRedirectUrl(razorpaySubscriptionId: string): Promise<string> {
    if (!razorpaySubscriptionId.startsWith('sub_')) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }

    const local = await Subscription.findOne({ razorpaySubscriptionId });
    if (!local) {
      throw new ApiError(404, MESSAGES.SUBSCRIPTION_ORDER_NOT_FOUND);
    }

    return razorpayService.resolveSubscriptionAuthUrl(razorpaySubscriptionId);
  },

  /**
   * If payment succeeded on Razorpay but webhook/verify was missed, activate on read.
   */
  async syncPendingSubscriptionFromRazorpay(userId: string): Promise<void> {
    let pending = await Subscription.findOne({
      userId,
      paymentStatus: SubscriptionPaymentStatus.PENDING,
      razorpaySubscriptionId: { $exists: true, $ne: '' },
    }).sort({ createdAt: -1 });

    if (!pending) {
      pending = await Subscription.findOne({
        userId,
        paymentStatus: SubscriptionPaymentStatus.PENDING,
        status: LibrarySubscriptionStatus.PENDING,
      }).sort({ createdAt: -1 });
    }

    if (!pending) {
      return;
    }

    try {
      if (!pending.razorpaySubscriptionId) {
        const matches = await razorpayService.findSubscriptionsByMongoSubscriptionId(
          pending._id.toString()
        );
        const activeMatch = matches.find((s) =>
          ['active', 'authenticated', 'completed'].includes(s.status)
        );
        if (activeMatch?.id) {
          pending.razorpaySubscriptionId = activeMatch.id;
          await pending.save();
        }
      }

      if (!pending.razorpaySubscriptionId) {
        return;
      }

      const rzSub = await razorpayService.fetchSubscription(pending.razorpaySubscriptionId);
      const activeStatuses = ['active', 'authenticated', 'completed'];
      if (!activeStatuses.includes(rzSub.status)) {
        return;
      }

      const paymentId = await razorpayService.fetchLatestPaidPaymentForSubscription(
        pending.razorpaySubscriptionId
      );
      if (!paymentId) {
        return;
      }

      await this.processRecurringCharge(
        pending.razorpaySubscriptionId,
        paymentId,
        { userId, subscriptionId: pending._id.toString() }
      );
      logger.info(LOG_TAG, 'Synced pending subscription from Razorpay', {
        userId,
        razorpaySubscriptionId: pending.razorpaySubscriptionId,
        paymentId,
      });
    } catch (err) {
      logger.warn(LOG_TAG, 'Could not sync pending subscription from Razorpay', {
        userId,
        err,
      });
    }
  },

  async handleWebhook(rawBody: string, signature: string | undefined): Promise<void> {
    if (!signature) {
      throw new ApiError(400, MESSAGES.SUBSCRIPTION_INVALID_SIGNATURE);
    }

    if (!razorpayService.verifyWebhookSignature(rawBody, signature)) {
      throw new ApiError(400, MESSAGES.SUBSCRIPTION_INVALID_SIGNATURE);
    }

    const event = JSON.parse(rawBody) as RazorpayWebhookEvent;
    const eventName = event.event;
    const subEntity = event.payload?.subscription?.entity;
    const paymentEntity = event.payload?.payment?.entity;

    logger.info(LOG_TAG, 'Webhook received', { event: eventName, subscriptionId: subEntity?.id });

    switch (eventName) {
      case 'subscription.authenticated':
      case 'subscription.activated':
      case 'subscription.charged': {
        if (subEntity?.id) {
          const paymentId =
            paymentEntity?.id ??
            (await razorpayService.fetchLatestPaidPaymentForSubscription(subEntity.id));
          if (paymentId) {
            await this.processRecurringCharge(subEntity.id, paymentId, subEntity.notes);
          } else {
            logger.warn(LOG_TAG, 'Subscription event without payment id', {
              event: eventName,
              subscriptionId: subEntity.id,
            });
          }
          await schedulePromoRevertByRazorpayId(subEntity.id);
        }
        break;
      }

      case 'payment.captured':
      case 'payment.authorized': {
        const pay = paymentEntity;
        if (pay?.subscription_id && pay.id) {
          await this.processRecurringCharge(pay.subscription_id, pay.id);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.payload?.invoice?.entity;
        if (invoice?.subscription_id && invoice.payment_id) {
          await this.processRecurringCharge(invoice.subscription_id, invoice.payment_id);
        }
        break;
      }

      case 'subscription.halted':
      case 'subscription.cancelled':
      case 'subscription.completed':
        if (subEntity?.id) {
          await this.handleRecurringEnded(subEntity.id, eventName);
        }
        break;

      default:
        logger.info(LOG_TAG, 'Unhandled webhook event', { event: eventName });
    }
  },

  async handleRecurringEnded(razorpaySubscriptionId: string, reason: string): Promise<void> {
    const result = await Subscription.updateMany(
      {
        razorpaySubscriptionId,
        status: { $in: [LibrarySubscriptionStatus.ACTIVE, LibrarySubscriptionStatus.PENDING] },
      },
      { $set: { status: LibrarySubscriptionStatus.CANCELLED } }
    );

    logger.info(LOG_TAG, 'Recurring subscription ended', {
      razorpaySubscriptionId,
      reason,
      modified: result.modifiedCount,
    });
  },

  async getCurrentSubscription(userId: string) {
    await this.syncPendingSubscriptionFromRazorpay(userId);
    return this.findActiveSubscription(userId, true);
  },

  /** Debug Razorpay recurring status for the logged-in user. */
  async getRecurringStatus(userId: string) {
    let local = await Subscription.findOne({
      userId,
      razorpaySubscriptionId: { $exists: true, $ne: '' },
    })
      .sort({ createdAt: -1 })
      .populate('planId');

    if (!local?.razorpaySubscriptionId) {
      const legacyOneTime = Boolean(local?.razorpayPaymentLinkId || local?.razorpayOrderId);
      return {
        hasRecurring: false,
        legacyOneTimePayment: legacyOneTime,
        message: legacyOneTime
          ? 'Paid via one-time Payment Link — no auto-debit mandate. Create a new order and pay with subscription checkout (subscription_id) to enable monthly auto-cut.'
          : 'No Razorpay subscription linked. Pay via subscription checkout (subscription_id), not one-time order_id or Payment Link.',
      };
    }

    if (local.promoBillingCycles === 1 && !local.promoRevertScheduled) {
      await schedulePromoRevertToFullPrice(local);
      local =
        (await Subscription.findById(local._id).populate('planId')) ??
        local;
    }

    const razorpaySubscriptionId = local.razorpaySubscriptionId as string;
    const rz = await razorpayService.fetchSubscription(razorpaySubscriptionId);
    const recurringActive = ['active', 'authenticated'].includes(rz.status);

    return {
      hasRecurring: true,
      localStatus: local.status,
      localPaymentStatus: local.paymentStatus,
      razorpaySubscriptionId: local.razorpaySubscriptionId,
      razorpayStatus: rz.status,
      paidCount: rz.paid_count ?? 0,
      remainingCount: rz.remaining_count ?? 0,
      chargeAt: rz.charge_at ? new Date(rz.charge_at * 1000).toISOString() : null,
      recurringActive,
      message: recurringActive
        ? 'Auto-debit mandate is active. Razorpay will charge on schedule.'
        : `Razorpay subscription is "${rz.status}" — auto-debit will not run until active/authenticated.`,
    };
  },

  async getSubscriptionHistory(userId: string) {
    return Subscription.find({ userId })
      .sort({ createdAt: -1 })
      .populate('planId');
  },

  // ——— Admin ———

  async adminCreatePlan(
    payload: Partial<ISubscriptionPlanDocument>
  ): Promise<ISubscriptionPlanDocument> {
    const plan = await SubscriptionPlan.create(payload);
    await ensureRazorpayPlan(plan);
    return plan;
  },

  async adminUpdatePlan(
    planId: string,
    payload: Partial<ISubscriptionPlanDocument>
  ): Promise<ISubscriptionPlanDocument> {
    if (!mongoose.Types.ObjectId.isValid(planId)) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }
    const plan = await SubscriptionPlan.findByIdAndUpdate(planId, payload, {
      new: true,
      runValidators: true,
    });
    if (!plan) {
      throw new ApiError(404, MESSAGES.SUBSCRIPTION_PLAN_NOT_FOUND);
    }
    if (payload.amount !== undefined || payload.durationMonths !== undefined) {
      await ensureRazorpayPlan(plan);
    }
    return plan;
  },

  async adminDisablePlan(planId: string): Promise<ISubscriptionPlanDocument> {
    return this.adminUpdatePlan(planId, { isActive: false });
  },

  async adminGetAllSubscriptions(filters?: {
    status?: LibrarySubscriptionStatus;
    paymentStatus?: SubscriptionPaymentStatus;
  }) {
    const query: Record<string, unknown> = {};
    if (filters?.status) query.status = filters.status;
    if (filters?.paymentStatus) query.paymentStatus = filters.paymentStatus;

    return Subscription.find(query)
      .sort({ createdAt: -1 })
      .populate('planId')
      .populate('userId', 'fullName email mobileNumber');
  },

  async migrateLegacySubscriptionPlans(): Promise<void> {
    await this.migrateSubscriptionIndexes();

    const collection = SubscriptionPlan.collection;
    const indexes = await collection.indexes();

    for (const index of indexes) {
      const name = index.name;
      if (!name || name === '_id_') continue;

      const keys = index.key as Record<string, number>;
      const isLegacyKey = 'planType' in keys || name === 'planType_1';

      if (isLegacyKey) {
        try {
          await collection.dropIndex(name);
          logger.info(LOG_TAG, 'Dropped legacy subscription plan index', { name });
        } catch (err) {
          logger.warn(LOG_TAG, 'Could not drop index (may already be gone)', { name, err });
        }
      }
    }

    const removed = await SubscriptionPlan.deleteMany({
      category: { $exists: false },
    });
    if (removed.deletedCount > 0) {
      logger.info(LOG_TAG, 'Removed legacy subscription plan documents', {
        count: removed.deletedCount,
      });
    }

    await SubscriptionPlan.syncIndexes();
  },

  /** Drop legacy unique indexes that block multiple recurring subscriptions (null order ids). */
  async migrateSubscriptionIndexes(): Promise<void> {
    const collection = Subscription.collection;
    const indexes = await collection.indexes();

    for (const index of indexes) {
      const name = index.name;
      if (!name || name === '_id_') continue;

      const keys = index.key as Record<string, number>;
      const hasPartialFilter = Boolean(index.partialFilterExpression);

      if ('razorpayOrderId' in keys && !hasPartialFilter) {
        try {
          await collection.dropIndex(name);
          logger.info(LOG_TAG, 'Dropped legacy razorpayOrderId index', { name });
        } catch (err) {
          logger.warn(LOG_TAG, 'Could not drop razorpayOrderId index', { name, err });
        }
      }

      if ('razorpayPaymentLinkId' in keys) {
        try {
          await collection.dropIndex(name);
          logger.info(LOG_TAG, 'Dropped legacy razorpayPaymentLinkId index', { name });
        } catch (err) {
          logger.warn(LOG_TAG, 'Could not drop razorpayPaymentLinkId index', { name, err });
        }
      }

      // Non-unique auto index from old `index: true` on razorpaySubscriptionId field.
      if (
        'razorpaySubscriptionId' in keys &&
        !index.unique &&
        name === 'razorpaySubscriptionId_1'
      ) {
        try {
          await collection.dropIndex(name);
          logger.info(LOG_TAG, 'Dropped duplicate razorpaySubscriptionId index', { name });
        } catch (err) {
          logger.warn(LOG_TAG, 'Could not drop razorpaySubscriptionId index', { name, err });
        }
      }
    }

    await Subscription.syncIndexes();
  },

  async seedPlans(): Promise<{ created: number; updated: number }> {
    await this.migrateLegacySubscriptionPlans();

    let created = 0;
    let updated = 0;

    for (const seed of SUBSCRIPTION_PLANS_SEED) {
      const exists = await SubscriptionPlan.exists({
        category: seed.category,
        durationType: seed.durationType,
      });

      const plan = await SubscriptionPlan.findOneAndUpdate(
        { category: seed.category, durationType: seed.durationType },
        {
          $set: {
            name: seed.name,
            seatsMin: seed.seatsMin,
            seatsMax: seed.seatsMax,
            durationMonths: seed.durationMonths,
            baseAmount: seed.baseAmount,
            amount: seed.amount,
            savingPercent: seed.savingPercent,
            perMonthAmount: seed.perMonthAmount,
            currency: 'INR',
            isActive: true,
          },
          $unset: {
            planType: '',
            price: '',
            interval: '',
            intervalType: '',
            maxLibraries: '',
            features: '',
          },
        },
        { upsert: true, new: true }
      );

      if (plan) {
        await ensureRazorpayPlan(plan);
      }

      if (exists) {
        updated += 1;
      } else {
        created += 1;
      }
    }

    return { created, updated };
  },
};
