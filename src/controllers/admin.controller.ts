import { Request, Response } from 'express';
import path from 'path';
import { adminService } from '../services/admin.service';
import { subscriptionService } from '../services/subscription.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { MESSAGES } from '../constants/messages';

export const adminController = {
  renderAdminPage: (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../../public/admin.html'));
  },

  getDashboard: asyncHandler(async (_req: Request, res: Response) => {
    const data = await adminService.getDashboard();
    res.status(200).json(new ApiResponse(200, MESSAGES.ADMIN_DASHBOARD_FETCHED, data));
  }),

  getLibraryDetail: asyncHandler(async (req: Request, res: Response) => {
    const data = await adminService.getLibraryDetail(req.params.libraryId);
    res.status(200).json(new ApiResponse(200, MESSAGES.ADMIN_LIBRARY_FETCHED, data));
  }),

  createSubscriptionPlan: asyncHandler(async (req: Request, res: Response) => {
    const plan = await subscriptionService.adminCreatePlan(req.body);
    res.status(201).json(new ApiResponse(201, MESSAGES.SUBSCRIPTION_PLAN_CREATED, plan));
  }),

  updateSubscriptionPlan: asyncHandler(async (req: Request, res: Response) => {
    const plan = await subscriptionService.adminUpdatePlan(req.params.planId, req.body);
    res.status(200).json(new ApiResponse(200, MESSAGES.SUBSCRIPTION_PLAN_UPDATED, plan));
  }),

  disableSubscriptionPlan: asyncHandler(async (req: Request, res: Response) => {
    const plan = await subscriptionService.adminDisablePlan(req.params.planId);
    res.status(200).json(new ApiResponse(200, MESSAGES.SUBSCRIPTION_PLAN_DISABLED, plan));
  }),

  getAllSubscriptions: asyncHandler(async (req: Request, res: Response) => {
    const list = await subscriptionService.adminGetAllSubscriptions({
      status: req.query.status as never,
      paymentStatus: req.query.paymentStatus as never,
    });
    res.status(200).json(new ApiResponse(200, MESSAGES.SUBSCRIPTION_ADMIN_LIST_FETCHED, list));
  }),
};
