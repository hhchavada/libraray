import { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { MESSAGES } from '../constants/messages';
import { getAuthUserId } from '../utils/auth.util';

export const dashboardController = {
  getStats: asyncHandler(async (req: Request, res: Response) => {
    const { libraryId } = req.params;
    const ownerId = getAuthUserId(req);
    const stats = await dashboardService.getDashboardStats(libraryId, ownerId);
    res.status(200).json(new ApiResponse(200, MESSAGES.DASHBOARD_STATS_FETCHED, stats));
  }),
};
