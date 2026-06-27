import { Request, Response } from 'express';
import { seatService } from '../services/seat.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { MESSAGES } from '../constants/messages';
import { ShiftType } from '../constants/enums';

import { getAuthUserId } from '../utils/auth.util';
import { libraryService } from '../services/library.service';

const getOwnerLibraryId = async (ownerId: string): Promise<string> => {
  const library = await libraryService.getLibraryByOwner(ownerId);
  return library._id.toString();
};

export const seatController = {
  getAllSeats: asyncHandler(async (req: Request, res: Response) => {
    const { libraryId } = req.params;
    const seats = await seatService.getAllSeats(libraryId);
    res.status(200).json(new ApiResponse(200, MESSAGES.SEATS_FETCHED, seats));
  }),

  getAvailableSeats: asyncHandler(async (req: Request, res: Response) => {
    const { libraryId } = req.params;
    const shift = req.query.shift as ShiftType | undefined;
    const seats = await seatService.getAvailableSeats(libraryId, shift);
    res.status(200).json(new ApiResponse(200, MESSAGES.SEATS_FETCHED, seats));
  }),

  getSeatsByShift: asyncHandler(async (req: Request, res: Response) => {
    const { libraryId } = req.params;
    const counts = await seatService.getSeatsByShift(libraryId);
    res.status(200).json(new ApiResponse(200, MESSAGES.SEATS_FETCHED, counts));
  }),

  lockSeat: asyncHandler(async (req: Request, res: Response) => {
    const { seatId } = req.params;
    const memberId = req.body.memberId as string;
    const seat = await seatService.lockSeat(seatId, memberId);
    res.status(200).json(new ApiResponse(200, MESSAGES.SEAT_LOCKED, seat));
  }),

  releaseSeat: asyncHandler(async (req: Request, res: Response) => {
    const libraryId = await getOwnerLibraryId(getAuthUserId(req));
    const { seatId } = req.params;
    const memberId = req.body.memberId as string | undefined;
    const seat = await seatService.releaseSeat(seatId, memberId, libraryId);
    res.status(200).json(new ApiResponse(200, MESSAGES.SEAT_RELEASED, seat));
  }),

  deleteSeat: asyncHandler(async (req: Request, res: Response) => {
    const libraryId = await getOwnerLibraryId(getAuthUserId(req));
    const { seatId } = req.params;
    await seatService.deleteSeat(seatId, libraryId);
    res.status(200).json(new ApiResponse(200, MESSAGES.SEAT_DELETED, null));
  }),

  deleteSeats: asyncHandler(async (req: Request, res: Response) => {
    const libraryId = await getOwnerLibraryId(getAuthUserId(req));
    const { seatIds } = req.body as { seatIds: string[] };
    const result = await seatService.deleteSeats(seatIds, libraryId);
    res.status(200).json(new ApiResponse(200, MESSAGES.SEATS_DELETED, result));
  }),
};
