import { Request, Response } from 'express';
import { revenueService, parseRevenueFilter } from '../services/revenue.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { MESSAGES } from '../constants/messages';

export const revenueController = {
  getSummary: asyncHandler(async (req: Request, res: Response) => {
    const { libraryId } = req.params;
    const filter = parseRevenueFilter(req.query.filter as string);
    const data = await revenueService.getRevenueSummary(libraryId, filter);
    res.status(200).json(new ApiResponse(200, MESSAGES.REVENUE_FETCHED, data));
  }),

  getByPaymentMode: asyncHandler(async (req: Request, res: Response) => {
    const { libraryId } = req.params;
    const filter = parseRevenueFilter(req.query.filter as string);
    const data = await revenueService.getRevenueByPaymentMode(libraryId, filter);
    res.status(200).json(new ApiResponse(200, MESSAGES.REVENUE_FETCHED, data));
  }),

  getTrend: asyncHandler(async (req: Request, res: Response) => {
    const { libraryId } = req.params;
    const data = await revenueService.getMonthlyRevenueTrend(libraryId);
    res.status(200).json(new ApiResponse(200, MESSAGES.REVENUE_FETCHED, data));
  }),
};
