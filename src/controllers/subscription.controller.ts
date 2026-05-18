import { Request, Response } from 'express';
import { subscriptionService } from '../services/subscription.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { MESSAGES } from '../constants/messages';
import { ApiError } from '../utils/ApiError';
import { getAuthUserId } from '../utils/auth.util';

export const subscriptionController = {
  getAllPlans: asyncHandler(async (_req: Request, res: Response) => {
    const plans = await subscriptionService.getAllPlans();
    res.status(200).json(new ApiResponse(200, MESSAGES.SUBSCRIPTION_PLANS_FETCHED, plans));
  }),

  createSubscription: asyncHandler(async (req: Request, res: Response) => {
    const { planId } = req.body;
    if (!planId) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }

    const result = await subscriptionService.createSubscription(getAuthUserId(req), planId);
    res.status(201).json(new ApiResponse(201, MESSAGES.SUBSCRIPTION_CREATED, result));
  }),

  getMySubscription: asyncHandler(async (req: Request, res: Response) => {
    const subscription = await subscriptionService.getMySubscription(getAuthUserId(req));
    res.status(200).json(new ApiResponse(200, MESSAGES.SUBSCRIPTION_FETCHED, subscription));
  }),

  cancelSubscription: asyncHandler(async (req: Request, res: Response) => {
    const subscription = await subscriptionService.cancelSubscription(getAuthUserId(req));
    res.status(200).json(new ApiResponse(200, MESSAGES.SUBSCRIPTION_CANCELLED, subscription));
  }),

  webhook: asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['x-razorpay-signature'] as string;

    if (!signature) {
      throw new ApiError(400, MESSAGES.SUBSCRIPTION_INVALID_SIGNATURE);
    }

    const rawBody = req.body as Buffer;
    const result = await subscriptionService.handleWebhook(rawBody, signature);

    res.status(200).json(
      new ApiResponse(200, MESSAGES.SUBSCRIPTION_WEBHOOK_RECEIVED, {
        ...result,
        message: MESSAGES.SUBSCRIPTION_WEBHOOK_VERIFIED,
      })
    );
  }),
};
