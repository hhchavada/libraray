import { Request, Response } from 'express';
import { libraryService } from '../services/library.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { MESSAGES } from '../constants/messages';
import { getAuthUserId } from '../utils/auth.util';

export const libraryController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const library = await libraryService.createLibrary(req.body, getAuthUserId(req));
    res.status(201).json(new ApiResponse(201, MESSAGES.LIBRARY_CREATED, library));
  }),

  getMyLibrary: asyncHandler(async (req: Request, res: Response) => {
    const library = await libraryService.getLibraryByOwner(getAuthUserId(req));
    res.status(200).json(new ApiResponse(200, MESSAGES.LIBRARY_FETCHED, library));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const library = await libraryService.getLibraryByOwner(getAuthUserId(req));
    const updated = await libraryService.updateLibrary(
      library._id.toString(),
      getAuthUserId(req),
      req.body
    );
    res.status(200).json(new ApiResponse(200, MESSAGES.LIBRARY_UPDATED, updated));
  }),

  getStats: asyncHandler(async (req: Request, res: Response) => {
    const library = await libraryService.getLibraryByOwner(getAuthUserId(req));
    const stats = await libraryService.getLibraryStats(library._id.toString());
    res.status(200).json(new ApiResponse(200, MESSAGES.LIBRARY_STATS_FETCHED, stats));
  }),

  getQrCode: asyncHandler(async (req: Request, res: Response) => {
    const qrData = await libraryService.getLibraryQrCode(getAuthUserId(req));
    res.status(200).json(new ApiResponse(200, MESSAGES.LIBRARY_QR_FETCHED, qrData));
  }),
};
