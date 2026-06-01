import { Request, Response } from 'express';
import { subscriptionService } from '../services/subscription.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { MESSAGES } from '../constants/messages';
import { getAuthUserId } from '../utils/auth.util';

export const subscriptionController = {
  getPlans: asyncHandler(async (_req: Request, res: Response) => {
    const plans = await subscriptionService.getPlansGrouped();
    res.status(200).json(new ApiResponse(200, MESSAGES.SUBSCRIPTION_PLANS_FETCHED, plans));
  }),

  createOrder: asyncHandler(async (req: Request, res: Response) => {
    const { planId, confirmReplace } = req.body;
    const result = await subscriptionService.createOrder(
      getAuthUserId(req),
      planId,
      Boolean(confirmReplace)
    );
    res.status(201).json(new ApiResponse(201, MESSAGES.SUBSCRIPTION_ORDER_CREATED, result));
  }),

  verifyPayment: asyncHandler(async (req: Request, res: Response) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const subscription = await subscriptionService.verifyPayment(
      getAuthUserId(req),
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );
    res.status(200).json(new ApiResponse(200, MESSAGES.SUBSCRIPTION_ACTIVATED, subscription));
  }),

  getCurrent: asyncHandler(async (req: Request, res: Response) => {
    const subscription = await subscriptionService.getCurrentSubscription(getAuthUserId(req));
    res.status(200).json(new ApiResponse(200, MESSAGES.SUBSCRIPTION_FETCHED, subscription));
  }),

  getHistory: asyncHandler(async (req: Request, res: Response) => {
    const history = await subscriptionService.getSubscriptionHistory(getAuthUserId(req));
    res.status(200).json(new ApiResponse(200, MESSAGES.SUBSCRIPTION_HISTORY_FETCHED, history));
  }),

  /** Razorpay Payment Link redirect — no auth (signature verified). */
  paymentCallback: asyncHandler(async (req: Request, res: Response) => {
    const subscription = await subscriptionService.handlePaymentLinkCallback(
      req.query as Record<string, string | undefined>
    );
    const plan = subscription.planId as { name?: string } | null;
    const end = subscription.endDate
      ? new Date(subscription.endDate).toLocaleDateString('en-IN')
      : '—';

    res.status(200).send(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Payment successful</title></head>` +
        `<body style="font-family:system-ui;text-align:center;padding:48px">` +
        `<h1>Payment successful</h1>` +
        `<p>${plan?.name ?? 'Subscription'} is active until <strong>${end}</strong>.</p>` +
        `<p style="color:#64748b;font-size:14px">You can close this window.</p></body></html>`
    );
  }),
};
