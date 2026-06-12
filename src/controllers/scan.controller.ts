import { Request, Response } from 'express';
import path from 'path';
import { scanService } from '../services/scan.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { MESSAGES } from '../constants/messages';
import { dataUrlToPngBuffer } from '../utils/qr.util';
import { ApiError } from '../utils/ApiError';

export const scanController = {
  renderScanPage: (_req: Request, res: Response): void => {
    res.sendFile(path.join(__dirname, '../../public/scan.html'));
  },

  getLibraryInfo: asyncHandler(async (req: Request, res: Response) => {
    const { libraryId, qrCodeId } = req.query as { libraryId: string; qrCodeId: string };
    const info = await scanService.getLibraryScanInfo(libraryId, qrCodeId);
    res.status(200).json(new ApiResponse(200, MESSAGES.SCAN_LIBRARY_FETCHED, info));
  }),

  registerDemoStudent: asyncHandler(async (req: Request, res: Response) => {
    const { libraryId, qrCodeId, ...memberData } = req.body;
    const member = await scanService.registerDemoStudent(libraryId, qrCodeId, memberData);
    res.status(201).json(new ApiResponse(201, MESSAGES.SCAN_REGISTRATION_SUCCESS, member));
  }),

  getQrImage: asyncHandler(async (req: Request, res: Response) => {
    const { libraryId, qrCodeId } = req.query as { libraryId: string; qrCodeId: string };
    const library = await scanService.validateLibraryQr(libraryId, qrCodeId);

    if (!library.qrCodeImage) {
      throw new ApiError(404, MESSAGES.LIBRARY_QR_NOT_FOUND);
    }

    const imageBuffer = dataUrlToPngBuffer(library.qrCodeImage);
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(imageBuffer);
  }),
};
