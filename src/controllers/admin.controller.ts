import { Request, Response } from 'express';
import path from 'path';
import { adminService } from '../services/admin.service';
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
};
