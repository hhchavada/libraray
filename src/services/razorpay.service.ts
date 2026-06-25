import crypto from 'crypto';
import Razorpay from 'razorpay';
import { ENV } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import { logger } from '../utils/logger';
import { toRupeesPaise } from '../utils/subscription.util';

const LOG_TAG = 'Razorpay';

/** Razorpay rejects subscription end_time beyond ~year 2121 (unix 4765046400). */
const RAZORPAY_MAX_END_UNIX = 4_765_046_400;
/** Recurring mandate length — auto-debit runs for this many years, then user re-subscribes. */
const SUBSCRIPTION_AUTO_DEBIT_YEARS = 2;
const AVG_MONTH_SECONDS = 30 * 24 * 60 * 60;

/**
 * Billing cycles for Razorpay subscription (controls mandate / auto-cut expiry).
 * Capped at SUBSCRIPTION_AUTO_DEBIT_YEARS and within Razorpay/UPI platform limits.
 */
export const getSafeSubscriptionTotalCount = (intervalMonths: number): number => {
  const interval = Math.max(1, intervalMonths);

  const autoDebitMaxCycles = Math.floor((SUBSCRIPTION_AUTO_DEBIT_YEARS * 12) / interval);

  const nowUnix = Math.floor(Date.now() / 1000);
  const remainingSeconds = RAZORPAY_MAX_END_UNIX - nowUnix;
  const platformMaxCycles = Math.floor(remainingSeconds / (interval * AVG_MONTH_SECONDS)) - 6;

  const totalCount = Math.min(autoDebitMaxCycles, platformMaxCycles);
  return Math.max(1, totalCount);
};

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
  /** Plan billing interval in months (1 = monthly). Used to cap total_count. */
  intervalMonths: number;
  customerId?: string;
  offerId?: string;
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

/** 10-digit Indian mobile for Razorpay Customer API (no +91 prefix). */
export const toRazorpayCustomerContact = (mobile: string): string => {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 10) return digits;
  return digits;
};

/** Format Indian mobile for Razorpay Checkout prefill (e.g. +919876543210). */
export const formatRazorpayContact = (mobile: string): string => {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (mobile.trim().startsWith('+')) return mobile.trim();
  return `+${digits}`;
};

const isRazorpayCustomerExistsError = (err: unknown): boolean => {
  const e = err as { error?: { description?: string } };
  return (e.error?.description ?? '').toLowerCase().includes('customer already exists');
};

const findCustomerByEmail = async (email: string): Promise<{ id: string } | null> => {
  const client = getRazorpayClient();
  let skip = 0;

  for (let page = 0; page < 20; page += 1) {
    const result = (await client.customers.all({ count: 100, skip })) as {
      items?: Array<{ id: string; email?: string }>;
    };
    const match = result.items?.find(
      (c) => c.email?.toLowerCase() === email.toLowerCase()
    );
    if (match) return match;
    if (!result.items?.length || result.items.length < 100) break;
    skip += 100;
  }

  return null;
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
    const contact = toRazorpayCustomerContact(input.contact);
    logger.info(LOG_TAG, 'Finding or creating Razorpay customer', { email: input.email });

    try {
      return (await getRazorpayClient().customers.create({
        name: input.name,
        email: input.email,
        contact,
        // Must be string "0" — number 0 is ignored by razorpay-node SDK.
        fail_existing: '0' as never,
      })) as { id: string };
    } catch (err) {
      if (!isRazorpayCustomerExistsError(err)) {
        throw err;
      }

      const existing = await findCustomerByEmail(input.email);
      if (existing) {
        logger.info(LOG_TAG, 'Reusing existing Razorpay customer', {
          email: input.email,
          customerId: existing.id,
        });
        return existing;
      }

      throw err;
    }
  },

  async createSubscription(input: CreateRazorpaySubscriptionInput) {
    logger.info(LOG_TAG, 'Creating recurring subscription', {
      planId: input.planId,
      customerId: input.customerId,
    });

    const totalCount = getSafeSubscriptionTotalCount(input.intervalMonths);

    const payload: {
      plan_id: string;
      total_count: number;
      customer_notify: 0 | 1;
      notes?: Record<string, string>;
      customer_id?: string;
      offer_id?: string;
      expire_by?: number;
      notify_info?: { notify_email?: string; notify_phone?: string };
    } = {
      plan_id: input.planId,
      total_count: totalCount,
      customer_notify: 1,
      notes: input.notes,
      // Hosted checkout link valid for 30 days.
      expire_by: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    };

    logger.info(LOG_TAG, 'Subscription total_count capped for Razorpay end_time limit', {
      intervalMonths: input.intervalMonths,
      totalCount,
    });

    if (input.customerId) {
      payload.customer_id = input.customerId;
    }

    if (input.offerId) {
      payload.offer_id = input.offerId;
    }

    if (input.notifyEmail || input.notifyPhone) {
      payload.notify_info = {
        notify_email: input.notifyEmail,
        notify_phone: input.notifyPhone
          ? toRazorpayCustomerContact(input.notifyPhone)
          : undefined,
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

  /** Valid Razorpay hosted auth page — always rzp.io, never api.razorpay.com/.../subscriptions/sub_xxx */
  async resolveSubscriptionAuthUrl(
    razorpaySubscriptionId: string,
    shortUrl?: string
  ): Promise<string> {
    const isHostedUrl = (url?: string) =>
      Boolean(url && /^https:\/\/rzp\.io\//i.test(url));

    if (isHostedUrl(shortUrl)) {
      return shortUrl!;
    }

    const sub = await this.fetchSubscription(razorpaySubscriptionId);
    if (isHostedUrl(sub.short_url)) {
      return sub.short_url!;
    }

    logger.error(LOG_TAG, 'No valid Razorpay hosted URL for subscription', {
      razorpaySubscriptionId,
      shortUrl,
      fetchedShortUrl: sub.short_url,
      status: sub.status,
    });
    throw new ApiError(400, MESSAGES.SUBSCRIPTION_PAYMENT_LINK_UNAVAILABLE);
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

  /** Switch subscription to a different plan (e.g. revert promo price after first cycle). */
  async updateSubscriptionPlan(
    razorpaySubscriptionId: string,
    planId: string,
    scheduleAt: 'now' | 'cycle_end' = 'cycle_end'
  ) {
    logger.info(LOG_TAG, 'Updating Razorpay subscription plan', {
      razorpaySubscriptionId,
      planId,
      scheduleAt,
    });

    return getRazorpayClient().subscriptions.update(razorpaySubscriptionId, {
      plan_id: planId,
      schedule_change_at: scheduleAt,
      customer_notify: 1,
    });
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
