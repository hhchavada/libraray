import mongoose from 'mongoose';
import {
  SubscriptionPlan,
  ISubscriptionPlanDocument,
} from '../models/subscriptionPlan.model';
import { Subscription, ISubscriptionDocument } from '../models/subscription.model';
import { User } from '../models/user.model';
import { ENV } from '../config/env';
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
import { formatRazorpayContact, razorpayService } from './razorpay.service';
import { addMonths } from '../utils/subscription.util';
import { calculateGstBreakdown } from '../utils/gst.util';
import { logger } from '../utils/logger';

const LOG_TAG = 'Subscription';

export type GroupedPlans = Record<string, ISubscriptionPlanDocument[]>;

export const subscriptionService = {
  async getPlansGrouped(): Promise<GroupedPlans> {
    const plans = await SubscriptionPlan.find({ isActive: true })
      .sort({ seatsMin: 1, durationMonths: 1 })
      .lean<ISubscriptionPlanDocument[]>();

    const grouped: GroupedPlans = {};
    for (const category of Object.values(PlanCategory)) {
      grouped[PLAN_CATEGORY_LABELS[category]] = plans.filter((p) => p.category === category);
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

    // Mark expired actives
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

    const gst = calculateGstBreakdown(subscription.amount);

    subscription.razorpayPaymentId = razorpayPaymentId;
    if (razorpaySignature) subscription.razorpaySignature = razorpaySignature;
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

    logger.info(LOG_TAG, 'Subscription activated', {
      subscriptionId: subscription._id,
      userId,
      endDate,
    });

    return subscription.populate('planId');
  },

  async createOrder(
    userId: string,
    planId: string,
    confirmReplace = false
  ): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    key: string;
    subscriptionId: string;
    paymentUrl: string;
    paymentLinkId: string;
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
    let isExtension = false;

    if (active) {
      const activePlanId = String(active.planId);
      if (activePlanId === String(plan._id)) {
        isExtension = true;
      } else if (!confirmReplace) {
        throw new ApiError(409, MESSAGES.SUBSCRIPTION_REPLACE_CONFIRMATION_REQUIRED);
      }
    }

    // Cancel stale pending orders for this user
    await Subscription.updateMany(
      {
        userId,
        status: LibrarySubscriptionStatus.PENDING,
        paymentStatus: SubscriptionPaymentStatus.PENDING,
      },
      { $set: { status: LibrarySubscriptionStatus.CANCELLED } }
    );

    const receipt = `sub_${userId.slice(-6)}_${Date.now()}`;
    const order = await razorpayService.createOrder({
      amountInRupees: plan.amount,
      currency: plan.currency,
      receipt,
      notes: {
        userId,
        planId: String(plan._id),
        category: plan.category,
        durationType: plan.durationType,
      },
    });

    const subscription = await Subscription.create({
      userId,
      planId: plan._id,
      razorpayOrderId: order.id,
      amount: plan.amount,
      status: LibrarySubscriptionStatus.PENDING,
      paymentStatus: SubscriptionPaymentStatus.PENDING,
      isExtension,
      replacedPrevious: Boolean(active && !isExtension),
    });

    const paymentLink = await razorpayService.createPaymentLink({
      amountInRupees: plan.amount,
      currency: plan.currency,
      description: plan.name,
      referenceId: subscription._id.toString(),
      customer: {
        name: user.fullName,
        email: user.email,
        contact: formatRazorpayContact(user.mobileNumber),
      },
      notes: {
        userId,
        planId: String(plan._id),
        razorpayOrderId: order.id,
        subscriptionId: subscription._id.toString(),
      },
      callbackUrl: ENV.RAZORPAY_PAYMENT_CALLBACK_URL,
    });

    subscription.razorpayPaymentLinkId = paymentLink.id;
    await subscription.save();

    logger.info(LOG_TAG, 'Pending subscription created', {
      subscriptionId: subscription._id,
      orderId: order.id,
      paymentLinkId: paymentLink.id,
      userId,
      isExtension,
    });

    return {
      orderId: order.id,
      amount: Number(order.amount),
      currency: order.currency ?? 'INR',
      key: razorpayService.getPublicKey(),
      subscriptionId: subscription._id.toString(),
      paymentUrl: paymentLink.short_url,
      paymentLinkId: paymentLink.id,
    };
  },

  /** Razorpay Payment Link redirect (GET) — activates subscription after successful payment. */
  async handlePaymentLinkCallback(query: Record<string, string | undefined>) {
    const paymentId = query.razorpay_payment_id;
    const paymentLinkId = query.razorpay_payment_link_id;
    const referenceId = query.razorpay_payment_link_reference_id ?? '';
    const status = query.razorpay_payment_link_status ?? '';
    const signature = query.razorpay_signature;

    if (!paymentId || !paymentLinkId || !signature) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }

    if (status !== 'paid') {
      throw new ApiError(400, MESSAGES.SUBSCRIPTION_PAYMENT_FAILED);
    }

    const isValid = razorpayService.verifyPaymentLinkSignature(
      paymentLinkId,
      referenceId,
      status,
      paymentId,
      signature
    );
    if (!isValid) {
      throw new ApiError(400, MESSAGES.SUBSCRIPTION_INVALID_SIGNATURE);
    }

    const subscription = await Subscription.findOne({
      razorpayPaymentLinkId: paymentLinkId,
    });
    if (!subscription) {
      throw new ApiError(404, MESSAGES.SUBSCRIPTION_ORDER_NOT_FOUND);
    }

    return this.activateSubscription(subscription, paymentId, signature);
  },

  async verifyPayment(
    userId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
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
        return duplicatePayment.populate('planId');
      }
      throw new ApiError(409, MESSAGES.SUBSCRIPTION_DUPLICATE_PAYMENT);
    }

    const subscription = await Subscription.findOne({
      razorpayOrderId,
      userId,
    }).populate('planId');

    if (!subscription) {
      throw new ApiError(404, MESSAGES.SUBSCRIPTION_ORDER_NOT_FOUND);
    }

    if (subscription.paymentStatus === SubscriptionPaymentStatus.PAID) {
      return subscription;
    }

    const isValid = razorpayService.verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      subscription.paymentStatus = SubscriptionPaymentStatus.FAILED;
      await subscription.save();
      throw new ApiError(400, MESSAGES.SUBSCRIPTION_INVALID_SIGNATURE);
    }

    return this.activateSubscription(subscription, razorpayPaymentId, razorpaySignature);
  },

  async getCurrentSubscription(userId: string) {
    return this.findActiveSubscription(userId, true);
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
    return SubscriptionPlan.create(payload);
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

  /**
   * Drops indexes/rows from the old SubscriptionPlan schema (planType, razorpayPlanId).
   * Required once when upgrading an existing database.
   */
  async migrateLegacySubscriptionPlans(): Promise<void> {
    const collection = SubscriptionPlan.collection;
    const indexes = await collection.indexes();

    for (const index of indexes) {
      const name = index.name;
      if (!name || name === '_id_') continue;

      const keys = index.key as Record<string, number>;
      const isLegacyKey =
        'planType' in keys || 'razorpayPlanId' in keys || name === 'planType_1';

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

  async seedPlans(): Promise<{ created: number; updated: number }> {
    await this.migrateLegacySubscriptionPlans();

    let created = 0;
    let updated = 0;

    for (const seed of SUBSCRIPTION_PLANS_SEED) {
      const exists = await SubscriptionPlan.exists({
        category: seed.category,
        durationType: seed.durationType,
      });

      await SubscriptionPlan.findOneAndUpdate(
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
            razorpayPlanId: '',
            price: '',
            interval: '',
            intervalType: '',
            maxLibraries: '',
            features: '',
          },
        },
        { upsert: true }
      );

      if (exists) {
        updated += 1;
      } else {
        created += 1;
      }
    }

    return { created, updated };
  },
};
