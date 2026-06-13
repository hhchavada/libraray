import { Request, Response } from 'express';
import path from 'path';
import { scanService } from '../services/scan.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { MESSAGES } from '../constants/messages';
import { buildLibraryScanUrl, generateQrScanPngBuffer, generateQrScanSvg } from '../utils/qr.util';

export const scanController = {
  renderScanPage: (_req: Request, res: Response): void => {
    res.sendFile(path.join(__dirname, '../../public/scan.html'));
  },

  renderLibraryQrPage: (_req: Request, res: Response): void => {
    res.sendFile(path.join(__dirname, '../../public/library-qr.html'));
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
    await scanService.validateLibraryQr(libraryId, qrCodeId);

    const scanUrl = buildLibraryScanUrl(libraryId, qrCodeId);
    const imageBuffer = await generateQrScanPngBuffer(scanUrl);
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(imageBuffer);
  }),

  getQrSvg: asyncHandler(async (req: Request, res: Response) => {
    const { libraryId, qrCodeId } = req.query as { libraryId: string; qrCodeId: string };
    await scanService.validateLibraryQr(libraryId, qrCodeId);

    const scanUrl = buildLibraryScanUrl(libraryId, qrCodeId);
    const svg = await generateQrScanSvg(scanUrl);
    res.set('Content-Type', 'image/svg+xml; charset=utf-8');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Content-Disposition', `attachment; filename="library-qr-${qrCodeId}.svg"`);
    res.send(svg);
  }),
};
