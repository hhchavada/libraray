import crypto from 'crypto';
import Razorpay from 'razorpay';
import { ENV } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import { logger } from '../utils/logger';
import { toRupeesPaise } from '../utils/subscription.util';

const LOG_TAG = 'Razorpay';

let razorpayInstance: Razorpay | null = null;

export const getRazorpayClient = (): Razorpay => {
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

export interface CreateRazorpayPlanInput {
  name: string;
  amountInRupees: number;
  currency?: string;
  intervalMonths: number;
  notes?: Record<string, string>;
}

export interface CreateRazorpayCustomerInput {
  name: string;
  email: string;
  contact: string;
}

export interface CreateRazorpaySubscriptionInput {
  planId: string;
  customerId?: string;
  notes?: Record<string, string>;
}

/** Format Indian mobile for Razorpay (e.g. +919876543210). */
export const formatRazorpayContact = (mobile: string): string => {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (mobile.trim().startsWith('+')) return mobile.trim();
  return `+${digits}`;
};

export const razorpayService = {
  getPublicKey(): string {
    if (!ENV.RAZORPAY_KEY_ID) {
      throw new ApiError(500, MESSAGES.RAZORPAY_NOT_CONFIGURED);
    }
    return ENV.RAZORPAY_KEY_ID;
  },

  async createPlan(input: CreateRazorpayPlanInput) {
    const currency = input.currency ?? 'INR';
    const amount = toRupeesPaise(input.amountInRupees);

    logger.info(LOG_TAG, 'Creating recurring plan', {
      name: input.name,
      amount,
      intervalMonths: input.intervalMonths,
    });

    const plan = await getRazorpayClient().plans.create({
      period: 'monthly',
      interval: input.intervalMonths,
      item: {
        name: input.name,
        amount,
        currency,
        description: `${input.name} — auto-renewing`,
      },
      notes: input.notes,
    });

    logger.info(LOG_TAG, 'Recurring plan created', { planId: plan.id });
    return plan;
  },

  async fetchPlan(planId: string) {
    return getRazorpayClient().plans.fetch(planId);
  },

  async findOrCreateCustomer(input: CreateRazorpayCustomerInput) {
    const client = getRazorpayClient();

    const existing = (await client.customers.all({ count: 10 })) as {
      items?: Array<{ id: string; email?: string }>;
    };
    const match = existing.items?.find(
      (c) => c.email?.toLowerCase() === input.email.toLowerCase()
    );
    if (match) {
      return match;
    }

    logger.info(LOG_TAG, 'Creating Razorpay customer', { email: input.email });

    return client.customers.create({
      name: input.name,
      email: input.email,
      contact: input.contact,
      fail_existing: 0,
    });
  },

  async createSubscription(input: CreateRazorpaySubscriptionInput) {
    logger.info(LOG_TAG, 'Creating recurring subscription', {
      planId: input.planId,
      customerId: input.customerId,
    });

    const payload: {
      plan_id: string;
      total_count: number;
      customer_notify: 0 | 1;
      notes?: Record<string, string>;
      customer_id?: string;
    } = {
      plan_id: input.planId,
      // High cycle count — effectively runs until user/admin cancels.
      total_count: 1200,
      customer_notify: 1,
      notes: input.notes,
    };

    if (input.customerId) {
      payload.customer_id = input.customerId;
    }

    const subscription = (await getRazorpayClient().subscriptions.create(
      payload
    )) as unknown as { id: string; short_url: string };

    logger.info(LOG_TAG, 'Recurring subscription created', {
      subscriptionId: subscription.id,
      shortUrl: subscription.short_url,
    });

    return subscription;
  },

  async cancelSubscription(razorpaySubscriptionId: string, cancelAtCycleEnd = false) {
    logger.info(LOG_TAG, 'Cancelling Razorpay subscription', {
      subscriptionId: razorpaySubscriptionId,
      cancelAtCycleEnd,
    });

    return getRazorpayClient().subscriptions.cancel(
      razorpaySubscriptionId,
      cancelAtCycleEnd
    );
  },

  verifySubscriptionPaymentSignature(
    razorpayPaymentId: string,
    razorpaySubscriptionId: string,
    razorpaySignature: string
  ): boolean {
    const body = `${razorpayPaymentId}|${razorpaySubscriptionId}`;
    const expected = crypto
      .createHmac('sha256', ENV.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    const isValid = expected === razorpaySignature;

    if (!isValid) {
      logger.warn(LOG_TAG, 'Subscription signature verification failed', {
        subscriptionId: razorpaySubscriptionId,
        paymentId: razorpayPaymentId,
      });
    }

    return isValid;
  },

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!ENV.RAZORPAY_WEBHOOK_SECRET) {
      logger.warn(LOG_TAG, 'RAZORPAY_WEBHOOK_SECRET not set — skipping verification');
      return ENV.NODE_ENV !== 'production';
    }

    try {
      return Razorpay.validateWebhookSignature(
        rawBody,
        signature,
        ENV.RAZORPAY_WEBHOOK_SECRET
      );
    } catch (err) {
      logger.warn(LOG_TAG, 'Webhook signature verification failed', { err });
      return false;
    }
  },
};
