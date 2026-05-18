import crypto from 'crypto';
import Razorpay from 'razorpay';
import { ENV } from '../config/env';
import { SubscriptionPlan, ISubscriptionPlanDocument } from '../models/subscriptionPlan.model';
import { UserSubscription, IUserSubscriptionDocument } from '../models/userSubscription.model';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import {
  SubscriptionStatus,
  RazorpayWebhookEvent,
} from '../constants/enums';

let razorpayInstance: Razorpay | null = null;

const getRazorpay = (): Razorpay => {
  if (!ENV.RAZORPAY_KEY_ID || !ENV.RAZORPAY_KEY_SECRET) {
    throw new ApiError(500, MESSAGES.RAZORPAY_NOT_CONFIGURED);
  }
  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: ENV.RAZORPAY_KEY_ID,
      key_secret: ENV.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
};

const ACTIVE_STATUSES = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.AUTHENTICATED,
  SubscriptionStatus.PENDING,
];

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    subscription?: {
      entity: {
        id: string;
        status: string;
        current_start?: number;
        current_end?: number;
        customer_id?: string;
      };
    };
    payment?: {
      entity: {
        id: string;
        status: string;
      };
    };
  };
}

export const subscriptionService = {
  async getAllPlans(): Promise<ISubscriptionPlanDocument[]> {
    return SubscriptionPlan.find({ isActive: true });
  },

  async createSubscription(userId: string, planId: string) {
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) {
      throw new ApiError(404, MESSAGES.SUBSCRIPTION_PLAN_NOT_FOUND);
    }

    const existingActive = await UserSubscription.findOne({
      user: userId,
      status: { $in: ACTIVE_STATUSES },
    });

    if (existingActive) {
      throw new ApiError(400, MESSAGES.SUBSCRIPTION_ALREADY_ACTIVE);
    }

    const razorpaySubscription = await getRazorpay().subscriptions.create({
      plan_id: plan.razorpayPlanId,
      total_count: 12,
      quantity: 1,
    });

    const subscription = await UserSubscription.create({
      user: userId,
      plan: plan._id,
      razorpaySubscriptionId: razorpaySubscription.id,
      status: SubscriptionStatus.CREATED,
      shortUrl: razorpaySubscription.short_url,
    });

    const populated = await subscription.populate('plan');

    return {
      subscription: populated,
      shortUrl: razorpaySubscription.short_url,
    };
  },

  async getMySubscription(userId: string): Promise<IUserSubscriptionDocument | null> {
    return UserSubscription.findOne({
      user: userId,
      status: { $in: ACTIVE_STATUSES },
    }).populate('plan');
  },

  async cancelSubscription(userId: string) {
    const subscription = await UserSubscription.findOne({
      user: userId,
      status: { $in: ACTIVE_STATUSES },
    });

    if (!subscription) {
      throw new ApiError(404, MESSAGES.SUBSCRIPTION_NOT_FOUND);
    }

    await getRazorpay().subscriptions.cancel(subscription.razorpaySubscriptionId, false);

    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelledAt = new Date();
    await subscription.save();

    return subscription.populate('plan');
  },

  async handleWebhook(rawBody: Buffer, signature: string) {
    const expectedSignature = crypto
      .createHmac('sha256', ENV.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new ApiError(400, MESSAGES.SUBSCRIPTION_INVALID_SIGNATURE);
    }

    const payload: RazorpayWebhookPayload = JSON.parse(rawBody.toString('utf8'));
    const event = payload.event;

    const subscriptionEntity = payload.payload?.subscription?.entity;

    if (subscriptionEntity) {
      const userSubscription = await UserSubscription.findOne({
        razorpaySubscriptionId: subscriptionEntity.id,
      });

      if (userSubscription) {
        switch (event) {
          case RazorpayWebhookEvent.SUBSCRIPTION_ACTIVATED:
            userSubscription.status = SubscriptionStatus.ACTIVE;
            if (subscriptionEntity.current_start) {
              userSubscription.currentPeriodStart = new Date(
                subscriptionEntity.current_start * 1000
              );
            }
            if (subscriptionEntity.current_end) {
              userSubscription.currentPeriodEnd = new Date(subscriptionEntity.current_end * 1000);
            }
            if (subscriptionEntity.customer_id) {
              userSubscription.razorpayCustomerId = subscriptionEntity.customer_id;
            }
            break;

          case RazorpayWebhookEvent.SUBSCRIPTION_CHARGED:
            if (subscriptionEntity.current_start) {
              userSubscription.currentPeriodStart = new Date(
                subscriptionEntity.current_start * 1000
              );
            }
            if (subscriptionEntity.current_end) {
              userSubscription.currentPeriodEnd = new Date(subscriptionEntity.current_end * 1000);
            }
            break;

          case RazorpayWebhookEvent.SUBSCRIPTION_CANCELLED:
            userSubscription.status = SubscriptionStatus.CANCELLED;
            userSubscription.cancelledAt = new Date();
            break;

          case RazorpayWebhookEvent.SUBSCRIPTION_HALTED:
            userSubscription.status = SubscriptionStatus.HALTED;
            break;

          case RazorpayWebhookEvent.SUBSCRIPTION_COMPLETED:
            userSubscription.status = SubscriptionStatus.COMPLETED;
            break;

          default:
            break;
        }

        await userSubscription.save();
      }
    }

    return { event, verified: true };
  },
};
