import mongoose from 'mongoose';
import { Library, ILibraryDocument } from '../models/library.model';
import { Seat } from '../models/seat.model';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import { SeatStatus } from '../constants/enums';
import { seatService } from './seat.service';
import {
  buildLibraryQrImageUrl,
  buildLibraryQrShareUrl,
  buildLibraryQrSvgUrl,
  buildLibraryScanUrl,
  generateLibraryQrCode,
  refreshLibraryQrPayload,
} from '../utils/qr.util';
import {
  computeSeatMapRows,
  deriveGridDimensionsFromPlacements,
  isValidGridIndex,
  SeatGridPlacement,
} from '../utils/seatGrid.util';
import { getFreeTrialForUserId } from '../utils/freeTrial.util';
import { generateLibraryCode, ensureLibraryCode } from '../utils/libraryCode.util';

const DEFAULT_SEAT_MAP_COLUMNS = 12;

export type SeatMapType = 'default' | 'custom';

export interface CreateLibraryData {
  libraryName: string;
  address: string;
  state?: string;
  city?: string;
  seatMapType: SeatMapType;
  totalSeats?: number;
  selectedSeats?: SeatGridPlacement[];
}

export interface UpdateLibraryData {
  libraryName?: string;
  address?: string;
  state?: string;
  city?: string;
  totalSeats?: number;
  hasCustomSeatMap?: boolean;
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

export const syncLibraryQrCodeIfNeeded = async (library: ILibraryDocument): Promise<void> => {
  const libraryId = library._id.toString();
  const expectedPayload = refreshLibraryQrPayload(
    libraryId,
    library.qrCodeId,
    library.libraryName
  );

  if (library.qrCodeId && library.qrCodePayload && library.qrCodePayload === expectedPayload) {
    return;
  }

  if (library.qrCodeId && library.qrCodePayload) {
    library.qrCodePayload = expectedPayload;
    await library.save();
    return;
  }

  const qrData = await generateLibraryQrCode(libraryId, library.libraryName, {
    qrCodeId: library.qrCodeId || undefined,
  });

  library.qrCodeId = qrData.qrCodeId;
  library.qrCodePayload = qrData.qrCodePayload;
  library.qrCodeImage = qrData.qrCodeImage;
  await library.save();
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

    const libraryCode = await generateLibraryCode();

    const library = await Library.create({
      libraryCode,
      libraryName: data.libraryName,
      address: data.address,
      ...(data.state?.trim() ? { state: data.state.trim() } : {}),
      ...(data.city?.trim() ? { city: data.city.trim() } : {}),
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

    const libraryWithQr = {
      ...(library.toObject() as unknown as Record<string, unknown>),
      qrCodeScanUrl: qrData.qrCodeScanUrl,
      qrCodeShareUrl: buildLibraryQrShareUrl(library._id.toString(), qrData.qrCodeId),
      qrCodeSvgUrl: buildLibraryQrSvgUrl(library._id.toString(), qrData.qrCodeId),
      qrCodeImage: qrData.qrCodeImageUrl,
      qrCodeImageUrl: qrData.qrCodeImageUrl,
    };

    if (useCustomSeatMap && placements) {
      await seatService.createSeatsFromSelection(library._id.toString(), placements);
    } else {
      await seatService.generateSeats(library._id.toString(), totalSeats, seatMapColumns);
    }

    const seats = await Seat.find({ library: library._id }).sort({ seatNumber: 1 });
    const freeTrial = await getFreeTrialForUserId(ownerId);

    return {
      library: libraryWithQr,
      seats,
      seatMap: {
        type: data.seatMapType,
        rows: seatMapRows,
        columns: seatMapColumns,
      },
      freeTrial,
    };
  },

  async getLibraryQrCode(ownerId: string) {
    const library = await this.getLibraryByOwner(ownerId);
    await syncLibraryQrCodeIfNeeded(library);

    const qrCodeImageUrl = buildLibraryQrImageUrl(library._id.toString(), library.qrCodeId);
    const qrCodeShareUrl = buildLibraryQrShareUrl(library._id.toString(), library.qrCodeId);
    const qrCodeSvgUrl = buildLibraryQrSvgUrl(library._id.toString(), library.qrCodeId);

    return {
      libraryId: library._id,
      libraryCode: library.libraryCode ?? (await ensureLibraryCode(library)),
      libraryName: library.libraryName,
      qrCodeId: library.qrCodeId,
      qrCodePayload: library.qrCodePayload,
      qrCodeScanUrl: buildLibraryScanUrl(library._id.toString(), library.qrCodeId),
      qrCodeShareUrl,
      qrCodeSvgUrl,
      qrCodeImage: qrCodeImageUrl,
      qrCodeImageUrl,
    };
  },

  async getLibraryByOwner(ownerId: string): Promise<ILibraryDocument> {
    const library = await Library.findOne({ owner: ownerId });
    if (!library) {
      throw new ApiError(404, MESSAGES.LIBRARY_NOT_FOUND);
    }
    return library;
  },

  /**
   * Returns library data with `libraryId` (MongoDB _id for API routes) and
   * `libraryCode` (human-readable BRD-0001 id) at the top level.
   */
  async getLibraryForApp(ownerId: string) {
    const library = await this.getLibraryByOwner(ownerId);
    await syncLibraryQrCodeIfNeeded(library);

    const libraryCode = await ensureLibraryCode(library);
    const libraryObj = library.toJSON();
    const freeTrial = await getFreeTrialForUserId(ownerId);

    const qrCodeImageUrl = buildLibraryQrImageUrl(library._id.toString(), libraryObj.qrCodeId);
    const qrCodeShareUrl = buildLibraryQrShareUrl(library._id.toString(), libraryObj.qrCodeId);
    const qrCodeSvgUrl = buildLibraryQrSvgUrl(library._id.toString(), libraryObj.qrCodeId);

    return {
      _id: library._id.toString(),
      libraryCode,
      libraryId: library._id.toString(),
      ownerId: library.owner.toString(),
      libraryName: libraryObj.libraryName,
      address: libraryObj.address,
      state: libraryObj.state ?? null,
      city: libraryObj.city ?? null,
      totalSeats: libraryObj.totalSeats,
      hasCustomSeatMap: libraryObj.hasCustomSeatMap,
      seatMapColumns: libraryObj.seatMapColumns,
      seatMapRows: libraryObj.seatMapRows,
      isActive: libraryObj.isActive,
      qrCodeId: libraryObj.qrCodeId,
      qrCodePayload: libraryObj.qrCodePayload,
      qrCodeScanUrl: buildLibraryScanUrl(library._id.toString(), libraryObj.qrCodeId),
      qrCodeShareUrl,
      qrCodeSvgUrl,
      qrCodeImage: qrCodeImageUrl,
      qrCodeImageUrl,
      createdAt: libraryObj.createdAt,
      updatedAt: libraryObj.updatedAt,
      freeTrial,
    };
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
    data: UpdateLibraryData
  ): Promise<ILibraryDocument> {
    const updates: UpdateLibraryData = {};
    if (data.libraryName !== undefined) updates.libraryName = data.libraryName;
    if (data.address !== undefined) updates.address = data.address;
    if (data.state !== undefined) updates.state = data.state.trim() || undefined;
    if (data.city !== undefined) updates.city = data.city.trim() || undefined;
    if (data.totalSeats !== undefined) updates.totalSeats = data.totalSeats;
    if (data.hasCustomSeatMap !== undefined) updates.hasCustomSeatMap = data.hasCustomSeatMap;

    const library = await Library.findOneAndUpdate(
      { _id: libraryId, owner: ownerId },
      updates,
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
