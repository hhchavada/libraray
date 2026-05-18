import mongoose from 'mongoose';
import { Library, ILibraryDocument } from '../models/library.model';
import { Seat } from '../models/seat.model';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import { SeatStatus } from '../constants/enums';
import { seatService } from './seat.service';
import { generateLibraryQrCode } from '../utils/qr.util';

export interface CreateLibraryData {
  libraryName: string;
  address: string;
  totalSeats: number;
  hasCustomSeatMap?: boolean;
}

export const libraryService = {
  async createLibrary(data: CreateLibraryData, ownerId: string): Promise<ILibraryDocument> {
    const existingLibrary = await Library.findOne({ owner: ownerId });
    if (existingLibrary) {
      throw new ApiError(409, MESSAGES.LIBRARY_ALREADY_EXISTS);
    }

    const library = await Library.create({
      ...data,
      owner: ownerId,
    });

    const qrData = await generateLibraryQrCode(library._id.toString(), library.libraryName);

    library.qrCodeId = qrData.qrCodeId;
    library.qrCodePayload = qrData.qrCodePayload;
    library.qrCodeImage = qrData.qrCodeImage;
    await library.save();

    await seatService.generateSeats(library._id.toString(), data.totalSeats);

    return library;
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
