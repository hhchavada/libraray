import mongoose from 'mongoose';
import { Library, ILibraryDocument } from '../models/library.model';
import { Seat } from '../models/seat.model';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import { SeatStatus } from '../constants/enums';
import { seatService } from './seat.service';
import { generateLibraryQrCode } from '../utils/qr.util';
import {
  computeSeatMapRows,
  deriveGridDimensionsFromPlacements,
  isValidGridIndex,
  SeatGridPlacement,
} from '../utils/seatGrid.util';

const DEFAULT_SEAT_MAP_COLUMNS = 12;

export type SeatMapType = 'default' | 'custom';

export interface CreateLibraryData {
  libraryName: string;
  address: string;
  seatMapType: SeatMapType;
  totalSeats?: number;
  selectedSeats?: SeatGridPlacement[];
}

const validateSeatPlacements = (placements: SeatGridPlacement[]): SeatGridPlacement[] => {
  const seatNumbers = new Set<number>();
  const cells = new Set<string>();

  for (const placement of placements) {
    if (!Number.isInteger(placement.seatNumber) || placement.seatNumber < 1) {
      throw new ApiError(400, MESSAGES.INVALID_SELECTED_SEATS);
    }
    if (seatNumbers.has(placement.seatNumber)) {
      throw new ApiError(400, MESSAGES.INVALID_SELECTED_SEATS);
    }
    seatNumbers.add(placement.seatNumber);

    if (!isValidGridIndex(placement.row) || !isValidGridIndex(placement.column)) {
      throw new ApiError(400, MESSAGES.INVALID_SEAT_GRID);
    }

    const cellKey = `${placement.column}-${placement.row}`;
    if (cells.has(cellKey)) {
      throw new ApiError(400, MESSAGES.DUPLICATE_SEAT_CELL);
    }
    cells.add(cellKey);
  }

  return placements;
};

export const libraryService = {
  async createLibrary(data: CreateLibraryData, ownerId: string) {
    const existingLibrary = await Library.findOne({ owner: ownerId });
    if (existingLibrary) {
      throw new ApiError(409, MESSAGES.LIBRARY_ALREADY_EXISTS);
    }

    const useCustomSeatMap = data.seatMapType === 'custom';

    let totalSeats: number;
    let seatMapRows: number;
    let seatMapColumns: number;
    let placements: SeatGridPlacement[] | undefined;

    if (useCustomSeatMap) {
      placements = validateSeatPlacements(data.selectedSeats!);
      totalSeats = placements.length;

      const gridSize = deriveGridDimensionsFromPlacements(placements);
      seatMapRows = gridSize.seatMapRows;
      seatMapColumns = gridSize.seatMapColumns;
    } else {
      if (!data.totalSeats || data.totalSeats < 1) {
        throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
      }
      totalSeats = data.totalSeats;
      seatMapColumns = DEFAULT_SEAT_MAP_COLUMNS;
      seatMapRows = computeSeatMapRows(totalSeats, seatMapColumns);
    }

    const library = await Library.create({
      libraryName: data.libraryName,
      address: data.address,
      totalSeats,
      hasCustomSeatMap: useCustomSeatMap,
      seatMapColumns,
      seatMapRows,
      owner: ownerId,
    });

    const qrData = await generateLibraryQrCode(library._id.toString(), library.libraryName);

    library.qrCodeId = qrData.qrCodeId;
    library.qrCodePayload = qrData.qrCodePayload;
    library.qrCodeImage = qrData.qrCodeImage;
    await library.save();

    if (useCustomSeatMap && placements) {
      await seatService.createSeatsFromSelection(library._id.toString(), placements);
    } else {
      await seatService.generateSeats(library._id.toString(), totalSeats, seatMapColumns);
    }

    const seats = await Seat.find({ library: library._id }).sort({ seatNumber: 1 });

    return {
      library,
      seats,
      seatMap: {
        type: data.seatMapType,
        rows: seatMapRows,
        columns: seatMapColumns,
      },
    };
  },

  async getLibraryQrCode(ownerId: string) {
    const library = await this.getLibraryByOwner(ownerId);

    if (!library.qrCodeImage) {
      const qrData = await generateLibraryQrCode(library._id.toString(), library.libraryName);
      library.qrCodeId = qrData.qrCodeId;
      library.qrCodePayload = qrData.qrCodePayload;
      library.qrCodeImage = qrData.qrCodeImage;
      await library.save();
    }

    return {
      libraryId: library._id,
      libraryName: library.libraryName,
      qrCodeId: library.qrCodeId,
      qrCodePayload: library.qrCodePayload,
      qrCodeImage: library.qrCodeImage,
    };
  },

  async getLibraryByOwner(ownerId: string): Promise<ILibraryDocument> {
    const library = await Library.findOne({ owner: ownerId });
    if (!library) {
      throw new ApiError(404, MESSAGES.LIBRARY_NOT_FOUND);
    }
    return library;
  },

  async getLibraryById(libraryId: string): Promise<ILibraryDocument> {
    if (!mongoose.Types.ObjectId.isValid(libraryId)) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }

    const library = await Library.findById(libraryId);
    if (!library) {
      throw new ApiError(404, MESSAGES.LIBRARY_NOT_FOUND);
    }
    return library;
  },

  async updateLibrary(
    libraryId: string,
    ownerId: string,
    data: Partial<CreateLibraryData>
  ): Promise<ILibraryDocument> {
    const library = await Library.findOneAndUpdate(
      { _id: libraryId, owner: ownerId },
      data,
      { new: true, runValidators: true }
    );

    if (!library) {
      throw new ApiError(404, MESSAGES.LIBRARY_NOT_FOUND);
    }

    return library;
  },

  async getLibraryStats(libraryId: string) {
    const [totalSeats, bookedSeats, availableSeats] = await Promise.all([
      Seat.countDocuments({ library: libraryId }),
      Seat.countDocuments({ library: libraryId, status: SeatStatus.BOOKED }),
      Seat.countDocuments({ library: libraryId, status: SeatStatus.AVAILABLE }),
    ]);

    return { totalSeats, bookedSeats, availableSeats };
  },
};
