import { Request, Response } from 'express';
import { subscriptionService } from '../services/subscription.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { MESSAGES } from '../constants/messages';
import { getAuthUserId } from '../utils/auth.util';
import { getFreeTrialForUserId } from '../utils/freeTrial.util';

export const subscriptionController = {
  getPlans: asyncHandler(async (_req: Request, res: Response) => {
    const plans = await subscriptionService.getPlansGrouped();
    res.status(200).json(new ApiResponse(200, MESSAGES.SUBSCRIPTION_PLANS_FETCHED, plans));
  }),

  createOrder: asyncHandler(async (req: Request, res: Response) => {
    const { planId, confirmReplace, promoCode } = req.body;
    const result = await subscriptionService.createOrder(
      getAuthUserId(req),
      planId,
      Boolean(confirmReplace),
      promoCode
    );
    res.status(201).json(new ApiResponse(201, MESSAGES.SUBSCRIPTION_ORDER_CREATED, result));
  }),

  validatePromo: asyncHandler(async (req: Request, res: Response) => {
    const { planId, promoCode } = req.body;
    const result = await subscriptionService.validatePromo(planId, promoCode, getAuthUserId(req));
    res.status(200).json(new ApiResponse(200, MESSAGES.PROMO_VALIDATED, result));
  }),

  verifyPayment: asyncHandler(async (req: Request, res: Response) => {
    const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature } = req.body;
    const subscription = await subscriptionService.verifyPayment(
      getAuthUserId(req),
      razorpay_payment_id,
      razorpay_signature,
      razorpay_subscription_id
    );
    res.status(200).json(new ApiResponse(200, MESSAGES.SUBSCRIPTION_ACTIVATED, subscription));
  }),

  getCurrent: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthUserId(req);
    const [subscription, freeTrial, recurring] = await Promise.all([
      subscriptionService.getCurrentSubscription(userId),
      getFreeTrialForUserId(userId),
      subscriptionService.getRecurringStatus(userId),
    ]);
    res.status(200).json(
      new ApiResponse(200, MESSAGES.SUBSCRIPTION_FETCHED, {
        subscription,
        freeTrial,
        recurring,
      })
    );
  }),

  getHistory: asyncHandler(async (req: Request, res: Response) => {
    const history = await subscriptionService.getSubscriptionHistory(getAuthUserId(req));
    res.status(200).json(new ApiResponse(200, MESSAGES.SUBSCRIPTION_HISTORY_FETCHED, history));
  }),

  getRecurringStatus: asyncHandler(async (req: Request, res: Response) => {
    const status = await subscriptionService.getRecurringStatus(getAuthUserId(req));
    res.status(200).json(new ApiResponse(200, MESSAGES.SUBSCRIPTION_FETCHED, status));
  }),

  /** Open Razorpay hosted pay page — redirects to https://rzp.io/... */
  redirectPay: asyncHandler(async (req: Request, res: Response) => {
    const url = await subscriptionService.getPaymentRedirectUrl(req.params.razorpaySubscriptionId);
    res.redirect(302, url);
  }),

  /** Razorpay subscription redirect after successful payment — no auth (signature verified). */
  paymentCallback: asyncHandler(async (req: Request, res: Response) => {
    const subscription = await subscriptionService.handleSubscriptionCallback(
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
        `<p style="color:#64748b;font-size:14px">You can close this window and return to the app.</p></body></html>`
    );
  }),

  /** Razorpay webhook — no auth (HMAC verified). Requires raw body middleware. */
  webhook: asyncHandler(async (req: Request, res: Response) => {
    const rawBody =
      typeof req.body === 'string'
        ? req.body
        : Buffer.isBuffer(req.body)
          ? req.body.toString('utf8')
          : JSON.stringify(req.body);

    await subscriptionService.handleWebhook(rawBody, req.headers['x-razorpay-signature'] as string);
    res.status(200).json({ status: 'ok' });
  }),
};
