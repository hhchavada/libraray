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
  notifyEmail?: string;
  notifyPhone?: string;
}

export interface RazorpaySubscriptionDetails {
  id: string;
  status: string;
  plan_id?: string;
  paid_count?: number;
  remaining_count?: number;
  charge_at?: number;
  current_start?: number;
  current_end?: number;
  ended_at?: number | null;
  short_url?: string;
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
    logger.info(LOG_TAG, 'Finding or creating Razorpay customer', { email: input.email });

    // fail_existing: 0 returns the existing customer when email/contact already exists.
    return getRazorpayClient().customers.create({
      name: input.name,
      email: input.email,
      contact: input.contact,
      fail_existing: 0,
    }) as Promise<{ id: string }>;
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
      expire_by?: number;
      notify_info?: { notify_email?: string; notify_phone?: string };
    } = {
      plan_id: input.planId,
      // High cycle count — effectively runs until user/admin cancels.
      total_count: 1200,
      customer_notify: 1,
      notes: input.notes,
      // Hosted checkout link valid for 30 days.
      expire_by: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    };

    if (input.customerId) {
      payload.customer_id = input.customerId;
    }

    if (input.notifyEmail || input.notifyPhone) {
      payload.notify_info = {
        notify_email: input.notifyEmail,
        notify_phone: input.notifyPhone,
      };
    }

    const subscription = (await getRazorpayClient().subscriptions.create(
      payload
    )) as unknown as RazorpaySubscriptionDetails;

    if (!subscription.id) {
      logger.error(LOG_TAG, 'Razorpay subscription create returned no id', { subscription });
      throw new ApiError(500, MESSAGES.SUBSCRIPTION_PAYMENT_FAILED);
    }

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

  async fetchSubscription(razorpaySubscriptionId: string): Promise<RazorpaySubscriptionDetails> {
    const sub = await getRazorpayClient().subscriptions.fetch(razorpaySubscriptionId);
    return sub as unknown as RazorpaySubscriptionDetails;
  },

  async fetchLatestPaidPaymentForSubscription(
    razorpaySubscriptionId: string
  ): Promise<string | null> {
    try {
      const payments = (await getRazorpayClient().payments.all({
        subscription_id: razorpaySubscriptionId,
        count: 20,
      } as never)) as {
        items?: Array<{ id: string; status: string }>;
      };

      const captured = payments.items?.find(
        (p) => p.status === 'captured' || p.status === 'authorized'
      );
      if (captured?.id) {
        return captured.id;
      }
    } catch (err) {
      logger.warn(LOG_TAG, 'Could not fetch subscription payments', {
        razorpaySubscriptionId,
        err,
      });
    }

    try {
      const invoices = (await getRazorpayClient().invoices.all({
        subscription_id: razorpaySubscriptionId,
        count: 20,
      })) as { items?: Array<{ status?: string; payment_id?: string }> };

      const paid = invoices.items?.find(
        (invoice) => invoice.status === 'paid' && invoice.payment_id
      );
      return paid?.payment_id ?? null;
    } catch (err) {
      logger.warn(LOG_TAG, 'Could not fetch subscription invoices', {
        razorpaySubscriptionId,
        err,
      });
      return null;
    }
  },

  async findSubscriptionsByMongoSubscriptionId(mongoSubscriptionId: string) {
    try {
      const result = (await getRazorpayClient().subscriptions.all({
        count: 100,
      })) as {
        items?: Array<{ id: string; status: string; notes?: Record<string, string> }>;
      };

      return (
        result.items?.filter(
          (sub) => sub.notes?.subscriptionId === mongoSubscriptionId
        ) ?? []
      );
    } catch (err) {
      logger.warn(LOG_TAG, 'Could not list Razorpay subscriptions', { err });
      return [];
    }
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
