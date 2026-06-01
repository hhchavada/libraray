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

export interface CreateOrderInput {
  amountInRupees: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface CreatePaymentLinkInput {
  amountInRupees: number;
  currency?: string;
  description: string;
  referenceId: string;
  customer: { name: string; email: string; contact: string };
  notes?: Record<string, string>;
  callbackUrl?: string;
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

  async createOrder(input: CreateOrderInput) {
    const currency = input.currency ?? 'INR';
    const amount = toRupeesPaise(input.amountInRupees);

    logger.info(LOG_TAG, 'Creating order', {
      receipt: input.receipt,
      amount,
      currency,
    });

    const order = await getRazorpayClient().orders.create({
      amount,
      currency,
      receipt: input.receipt,
      notes: input.notes,
    });

    logger.info(LOG_TAG, 'Order created', { orderId: order.id, amount: order.amount });

    return order;
  },

  verifyPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): boolean {
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expected = crypto
      .createHmac('sha256', ENV.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    const isValid = expected === razorpaySignature;

    if (!isValid) {
      logger.warn(LOG_TAG, 'Signature verification failed', {
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
      });
    }

    return isValid;
  },

  async createPaymentLink(input: CreatePaymentLinkInput) {
    const currency = input.currency ?? 'INR';
    const amount = toRupeesPaise(input.amountInRupees);

    logger.info(LOG_TAG, 'Creating payment link', {
      referenceId: input.referenceId,
      amount,
    });

    const paymentLink = await getRazorpayClient().paymentLink.create({
      amount,
      currency,
      accept_partial: false,
      description: input.description,
      reference_id: input.referenceId,
      customer: input.customer,
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: input.notes,
      callback_url: input.callbackUrl,
      callback_method: input.callbackUrl ? 'get' : undefined,
    });

    logger.info(LOG_TAG, 'Payment link created', {
      id: paymentLink.id,
      short_url: paymentLink.short_url,
    });

    return paymentLink;
  },

  /** Razorpay Payment Link redirect callback signature. */
  verifyPaymentLinkSignature(
    paymentLinkId: string,
    referenceId: string,
    status: string,
    paymentId: string,
    signature: string
  ): boolean {
    const body = `${paymentLinkId}|${referenceId}|${status}|${paymentId}`;
    const expected = crypto
      .createHmac('sha256', ENV.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');
    return expected === signature;
  },
};
