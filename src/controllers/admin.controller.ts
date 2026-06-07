import { Request, Response } from 'express';
import path from 'path';
import { adminService } from '../services/admin.service';
import { adminAnalyticsService } from '../services/adminAnalytics.service';
import { adminImportService } from '../services/adminImport.service';
import { subscriptionService } from '../services/subscription.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { MESSAGES } from '../constants/messages';
import { parseAdminFilters } from '../utils/adminFilter.util';

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

  getFilterOptions: asyncHandler(async (_req: Request, res: Response) => {
    const data = await adminAnalyticsService.getFilterOptions();
    res.status(200).json(new ApiResponse(200, MESSAGES.ADMIN_ANALYTICS_FETCHED, data));
  }),

  getCitiesByState: asyncHandler(async (req: Request, res: Response) => {
    const data = await adminAnalyticsService.getCitiesByState(req.params.state);
    res.status(200).json(new ApiResponse(200, MESSAGES.ADMIN_ANALYTICS_FETCHED, data));
  }),

  getDashboardSummary: asyncHandler(async (req: Request, res: Response) => {
    const filters = parseAdminFilters(req.query as Record<string, unknown>);
    const data = await adminAnalyticsService.getDashboardSummary(filters);
    res.status(200).json(new ApiResponse(200, MESSAGES.ADMIN_ANALYTICS_FETCHED, data));
  }),

  getRevenueAnalytics: asyncHandler(async (req: Request, res: Response) => {
    const filters = parseAdminFilters(req.query as Record<string, unknown>);
    const data = await adminAnalyticsService.getRevenueAnalytics(filters);
    res.status(200).json(new ApiResponse(200, MESSAGES.ADMIN_ANALYTICS_FETCHED, data));
  }),

  getGrowthAnalytics: asyncHandler(async (req: Request, res: Response) => {
    const filters = parseAdminFilters(req.query as Record<string, unknown>);
    const data = await adminAnalyticsService.getGrowthAnalytics(filters);
    res.status(200).json(new ApiResponse(200, MESSAGES.ADMIN_ANALYTICS_FETCHED, data));
  }),

  getLibraryStatus: asyncHandler(async (req: Request, res: Response) => {
    const filters = parseAdminFilters(req.query as Record<string, unknown>);
    const data = await adminAnalyticsService.getLibraryStatus(filters);
    res.status(200).json(new ApiResponse(200, MESSAGES.ADMIN_ANALYTICS_FETCHED, data));
  }),

  getTransactions: asyncHandler(async (req: Request, res: Response) => {
    const filters = parseAdminFilters(req.query as Record<string, unknown>);
    const data = await adminAnalyticsService.getTransactions(filters);
    res.status(200).json(new ApiResponse(200, MESSAGES.ADMIN_TRANSACTIONS_FETCHED, data));
  }),

  getResourceUsage: asyncHandler(async (req: Request, res: Response) => {
    const filters = parseAdminFilters(req.query as Record<string, unknown>);
    const data = await adminAnalyticsService.getResourceUsage(filters);
    res.status(200).json(new ApiResponse(200, MESSAGES.ADMIN_ANALYTICS_FETCHED, data));
  }),

  getExecutivePerformance: asyncHandler(async (req: Request, res: Response) => {
    const filters = parseAdminFilters(req.query as Record<string, unknown>);
    const data = await adminAnalyticsService.getExecutivePerformance(filters);
    res.status(200).json(new ApiResponse(200, MESSAGES.ADMIN_ANALYTICS_FETCHED, data));
  }),

  getRenewalForecast: asyncHandler(async (req: Request, res: Response) => {
    const filters = parseAdminFilters(req.query as Record<string, unknown>);
    const data = await adminAnalyticsService.getRenewalForecast(filters);
    res.status(200).json(new ApiResponse(200, MESSAGES.ADMIN_ANALYTICS_FETCHED, data));
  }),

  exportTransactions: asyncHandler(async (req: Request, res: Response) => {
    const filters = parseAdminFilters(req.query as Record<string, unknown>);
    const format = (req.query.format as 'csv' | 'excel') ?? 'excel';
    const result = await adminAnalyticsService.exportTransactions(filters, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
      res.send(result.body);
      return;
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=transactions.xlsx');
    res.send(Buffer.from(result.body as ArrayBuffer));
  }),

  importMembers: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file?.buffer) {
      res.status(400).json(new ApiResponse(400, MESSAGES.MEMBER_IMPORT_FILE_REQUIRED, null));
      return;
    }
    const data = await adminImportService.importMembersFromExcel(
      req.params.libraryId,
      req.file.buffer
    );
    res.status(200).json(new ApiResponse(200, MESSAGES.MEMBER_IMPORT_COMPLETED, data));
  }),

  listExecutives: asyncHandler(async (_req: Request, res: Response) => {
    const data = await adminAnalyticsService.listExecutives();
    res.status(200).json(new ApiResponse(200, MESSAGES.EXECUTIVES_FETCHED, data));
  }),

  createExecutive: asyncHandler(async (req: Request, res: Response) => {
    const data = await adminAnalyticsService.createExecutive(req.body);
    res.status(201).json(new ApiResponse(201, MESSAGES.EXECUTIVE_CREATED, data));
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
