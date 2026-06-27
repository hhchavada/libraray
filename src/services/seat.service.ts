import mongoose from 'mongoose';
import { Seat, ISeatDocument } from '../models/seat.model';
import { Member } from '../models/member.model';
import { Library } from '../models/library.model';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import { SeatStatus, ShiftType, MemberStatus, MemberType } from '../constants/enums';
import {
  computeSeatMapRows,
  defaultPlacementForSeat,
  GRID_INDEX_MAX,
  GRID_INDEX_MIN,
  placementToGridFields,
  SeatGridPlacement,
} from '../utils/seatGrid.util';
import {
  countMemberShiftOccupancy,
  isSeatAvailableForShift,
  ShiftSeatStats,
} from '../utils/seatShift.util';
import { formatSeatLabels } from '../utils/formatLabel.util';

const getActiveBookedShifts = async (seatId: string): Promise<ShiftType[]> => {
  const activeMembers = await Member.find({
    seat: seatId,
    status: MemberStatus.ACTIVE,
  }).select('shiftType');

  return activeMembers.map((m) => m.shiftType);
};

/** Sync seat.status / assignedTo / shiftType from active members on that seat. */
const syncSeatFromMembers = async (seatId: string): Promise<ISeatDocument> => {
  const seat = await Seat.findById(seatId);
  if (!seat) {
    throw new ApiError(404, MESSAGES.SEAT_NOT_FOUND);
  }

  const remainingMembers = await Member.find({
    seat: seatId,
    status: MemberStatus.ACTIVE,
  }).sort({ createdAt: 1 });

  if (remainingMembers.length === 0) {
    seat.status = SeatStatus.AVAILABLE;
    seat.assignedTo = null;
    seat.shiftType = null;
    seat.lockedAt = null;
  } else {
    const primary = remainingMembers[0];
    seat.assignedTo = primary._id;
    seat.shiftType = primary.shiftType;
    seat.status = SeatStatus.BOOKED;
    seat.lockedAt = null;
  }

  await seat.save();
  return seat;
};

const attachSeatBookings = async (seats: ISeatDocument[]) => {
  const seatIds = seats.map((s) => s._id);

  const members = await Member.find({
    seat: { $in: seatIds },
    status: MemberStatus.ACTIVE,
  }).select('seat shiftType fullName memberId');

  const bySeat = new Map<string, Array<{ _id: string; memberId: string; fullName: string; shiftType: ShiftType }>>();

  for (const member of members) {
    const seatKey = member.seat!.toString();
    const list = bySeat.get(seatKey) ?? [];
    list.push({
      _id: member._id.toString(),
      memberId: member.memberId,
      fullName: member.fullName,
      shiftType: member.shiftType,
    });
    bySeat.set(seatKey, list);
  }

  return seats.map((seat) => {
    const bookings = bySeat.get(seat._id.toString()) ?? [];
    const seatObj = seat.toObject() as ISeatDocument & {
      bookings: Array<{ _id: string; memberId: string; fullName: string; shiftType: ShiftType }>;
      bookedShifts: ShiftType[];
    };
    seatObj.bookings = bookings;
    seatObj.bookedShifts = bookings.map((b) => b.shiftType);
    return formatSeatLabels(seatObj as unknown as Record<string, unknown>);
  });
};

export const seatService = {
  async generateSeats(libraryId: string, totalSeats: number, seatMapColumns = 12): Promise<void> {
    const seats = Array.from({ length: totalSeats }, (_, index) => {
      const seatNumber = index + 1;
      const grid = defaultPlacementForSeat(seatNumber, seatMapColumns);
      return {
        library: libraryId,
        seatNumber,
        gridColumn: grid.gridColumn,
        gridRow: grid.gridRow,
        gridColumnIndex: grid.gridColumnIndex,
        gridRowIndex: grid.gridRowIndex,
        cellLabel: grid.cellLabel,
        status: SeatStatus.AVAILABLE,
      };
    });

    await Seat.insertMany(seats);
  },

  async createSeatsFromSelection(libraryId: string, placements: SeatGridPlacement[]): Promise<void> {
    const seats = placements
      .map((placement) => {
        const grid = placementToGridFields(placement);
        return {
          library: libraryId,
          seatNumber: grid.seatNumber,
          gridColumn: grid.gridColumn,
          gridRow: grid.gridRow,
          gridColumnIndex: grid.gridColumnIndex,
          gridRowIndex: grid.gridRowIndex,
          cellLabel: grid.cellLabel,
          status: SeatStatus.AVAILABLE,
        };
      })
      .sort((a, b) => a.seatNumber - b.seatNumber);

    await Seat.insertMany(seats);
  },

  async getAllSeats(libraryId: string) {
    const seats = await Seat.find({ library: libraryId })
      .sort({ seatNumber: 1 })
      .populate('assignedTo', 'fullName memberId');

    return attachSeatBookings(seats);
  },

  async getAvailableSeats(libraryId: string, shiftType?: ShiftType): Promise<ISeatDocument[]> {
    const seats = await Seat.find({ library: libraryId }).sort({ seatNumber: 1 });

    const availableSeats: ISeatDocument[] = [];

    for (const seat of seats) {
      if (seat.status === SeatStatus.LOCKED) {
        continue;
      }

      const bookedShifts = await getActiveBookedShifts(seat._id.toString());

      let isAvailable = false;

      if (!shiftType) {
        isAvailable =
          isSeatAvailableForShift(bookedShifts, ShiftType.MORNING) ||
          isSeatAvailableForShift(bookedShifts, ShiftType.EVENING) ||
          isSeatAvailableForShift(bookedShifts, ShiftType.FULL_DAY);
      } else {
        isAvailable = isSeatAvailableForShift(bookedShifts, shiftType);
      }

      if (isAvailable) {
        availableSeats.push(seat);
      }
    }

    return availableSeats;
  },

  async isSeatAvailableForShift(seatId: string, requestedShift: ShiftType): Promise<boolean> {
    const bookedShifts = await getActiveBookedShifts(seatId);
    return isSeatAvailableForShift(bookedShifts, requestedShift);
  },

  async lockSeat(seatId: string, _memberId: string): Promise<ISeatDocument> {
    const seat = await this.getSeatById(seatId);

    const bookedShifts = await getActiveBookedShifts(seatId);
    const isAvailable =
      isSeatAvailableForShift(bookedShifts, ShiftType.FULL_DAY) && bookedShifts.length === 0;

    if (!isAvailable || seat.status === SeatStatus.LOCKED) {
      throw new ApiError(400, MESSAGES.SEAT_NOT_AVAILABLE);
    }

    seat.status = SeatStatus.LOCKED;
    seat.lockedAt = new Date();
    await seat.save();

    return seat;
  },

  async assignSeat(seatId: string, _memberId: string, shiftType: ShiftType): Promise<ISeatDocument> {
    const seat = await this.getSeatById(seatId);

    const isAvailable = await this.isSeatAvailableForShift(seatId, shiftType);
    if (!isAvailable) {
      throw new ApiError(400, MESSAGES.SEAT_ALREADY_BOOKED);
    }

    seat.status = SeatStatus.BOOKED;
    seat.lockedAt = null;
    await seat.save();

    return seat;
  },

  async syncSeatFromMembers(seatId: string): Promise<ISeatDocument> {
    return syncSeatFromMembers(seatId);
  },

  async releaseSeat(seatId: string, memberId?: string, libraryId?: string): Promise<ISeatDocument> {
    const seat = await this.getSeatById(seatId);

    if (libraryId && seat.library.toString() !== libraryId) {
      throw new ApiError(400, MESSAGES.SEAT_LIBRARY_MISMATCH);
    }

    const query: any = { seat: seatId, status: MemberStatus.ACTIVE };
    if (memberId) {
      query._id = memberId;
    }

    const membersToRelease = await Member.find(query);

    if (memberId && membersToRelease.length === 0) {
      throw new ApiError(404, MESSAGES.MEMBER_HAS_NO_SEAT); // Or specific message
    }

    for (const member of membersToRelease) {
      member.seat = undefined;
      if (member.memberType === MemberType.PERMANENT) {
        member.memberType = MemberType.WITHOUT_SEAT;
      }
      await member.save();
    }

    return syncSeatFromMembers(seatId);
  },

  async getShiftSeatStats(libraryId: string): Promise<ShiftSeatStats> {
    const seats = await Seat.find({ library: libraryId });
    const totalSeats = seats.length;

    const activeMembersWithSeat = await Member.find({
      library: libraryId,
      status: MemberStatus.ACTIVE,
      seat: { $ne: null },
    }).select('shiftType');

    const occupancy = countMemberShiftOccupancy(activeMembersWithSeat);

    let morningAvailable = 0;
    let eveningAvailable = 0;
    let fullDayAvailable = 0;

    for (const seat of seats) {
      if (seat.status === SeatStatus.LOCKED) {
        continue;
      }

      const bookedShifts = await getActiveBookedShifts(seat._id.toString());

      if (isSeatAvailableForShift(bookedShifts, ShiftType.MORNING)) {
        morningAvailable++;
      }
      if (isSeatAvailableForShift(bookedShifts, ShiftType.EVENING)) {
        eveningAvailable++;
      }
      if (isSeatAvailableForShift(bookedShifts, ShiftType.FULL_DAY)) {
        fullDayAvailable++;
      }
    }

    return {
      totalSeats,
      morning: {
        available: morningAvailable,
        occupied: occupancy.morningSlots,
      },
      evening: {
        available: eveningAvailable,
        occupied: occupancy.eveningSlots,
      },
      fullDay: {
        available: fullDayAvailable,
        occupied: occupancy.fullDay,
      },
    };
  },

  /** @deprecated Use getShiftSeatStats — kept for backward compatibility */
  async getSeatsByShift(libraryId: string) {
    const stats = await this.getShiftSeatStats(libraryId);
    return {
      totalSeats: stats.totalSeats,
      morning: stats.morning,
      evening: stats.evening,
      fullDay: stats.fullDay,
      morningAvailable: stats.morning.available,
      eveningAvailable: stats.evening.available,
      fullDayAvailable: stats.fullDay.available,
      morningOccupied: stats.morning.occupied,
      eveningOccupied: stats.evening.occupied,
      fullDayOccupied: stats.fullDay.occupied,
    };
  },

  async getSeatById(seatId: string): Promise<ISeatDocument> {
    if (!mongoose.Types.ObjectId.isValid(seatId)) {
      throw new ApiError(400, MESSAGES.INVALID_SEAT_ID);
    }

    const seat = await Seat.findById(seatId);
    if (!seat) {
      throw new ApiError(404, MESSAGES.SEAT_NOT_FOUND);
    }

    return seat;
  },

  async getSeatByNumber(libraryId: string, seatNumber: number): Promise<ISeatDocument> {
    if (!mongoose.Types.ObjectId.isValid(libraryId)) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }
    if (!Number.isInteger(seatNumber) || seatNumber < 1) {
      throw new ApiError(400, MESSAGES.INVALID_SEAT_ID);
    }

    const seat = await Seat.findOne({ library: libraryId, seatNumber });
    if (!seat) {
      throw new ApiError(404, MESSAGES.SEAT_NOT_FOUND);
    }

    return seat;
  },

  async deleteSeat(seatId: string, libraryId: string): Promise<void> {
    await this.deleteSeats([seatId], libraryId);
  },

  async deleteSeats(
    seatIds: string[],
    libraryId: string
  ): Promise<{ deletedCount: number; seatIds: string[] }> {
    const uniqueSeatIds = [...new Set(seatIds)];

    for (const seatId of uniqueSeatIds) {
      const seat = await this.getSeatById(seatId);

      if (seat.library.toString() !== libraryId) {
        throw new ApiError(400, MESSAGES.SEAT_LIBRARY_MISMATCH);
      }

      if (seat.status === SeatStatus.LOCKED) {
        throw new ApiError(400, MESSAGES.SEAT_LOCKED_CANNOT_DELETE);
      }

      const hasAssignedMember = await Member.exists({
        seat: seatId,
        status: MemberStatus.ACTIVE,
      });

      if (hasAssignedMember) {
        throw new ApiError(400, MESSAGES.SEAT_ASSIGNED_CANNOT_DELETE);
      }
    }

    await Seat.deleteMany({ _id: { $in: uniqueSeatIds } });

    return {
      deletedCount: uniqueSeatIds.length,
      seatIds: uniqueSeatIds,
    };
  },

  async adjustLibrarySeats(
    libraryId: string,
    delta: number
  ): Promise<{ totalSeats: number; added?: number; removed?: number }> {
    if (!Number.isInteger(delta) || delta === 0) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }

    if (Math.abs(delta) > 50) {
      throw new ApiError(400, MESSAGES.SEAT_ADJUST_LIMIT);
    }

    const library = await Library.findById(libraryId);
    if (!library) {
      throw new ApiError(404, MESSAGES.LIBRARY_NOT_FOUND);
    }

    const currentCount = await Seat.countDocuments({ library: libraryId });
    const seatMapColumns = library.seatMapColumns ?? 12;

    if (delta > 0) {
      if (currentCount + delta > 1000) {
        throw new ApiError(400, MESSAGES.SEAT_MAX_LIMIT);
      }

      const maxSeatDoc = await Seat.findOne({ library: libraryId }).sort({ seatNumber: -1 });
      let nextSeatNumber = (maxSeatDoc?.seatNumber ?? 0) + 1;

      const existingSeats = library.hasCustomSeatMap
        ? await Seat.find({ library: libraryId }).select('gridRowIndex gridColumnIndex').lean()
        : [];
      const occupiedCells = new Set(
        existingSeats.map((s) => `${s.gridColumnIndex ?? ''}-${s.gridRowIndex ?? ''}`)
      );

      const seatsToInsert: Array<{
        library: string;
        seatNumber: number;
        gridColumn: string;
        gridRow: string;
        gridColumnIndex: number;
        gridRowIndex: number;
        cellLabel: string;
        status: SeatStatus;
      }> = [];

      for (let i = 0; i < delta; i++) {
        let grid;
        if (!library.hasCustomSeatMap) {
          grid = defaultPlacementForSeat(nextSeatNumber, seatMapColumns);
        } else {
          let found = false;
          for (let row = GRID_INDEX_MIN; row <= GRID_INDEX_MAX && !found; row++) {
            for (let col = GRID_INDEX_MIN; col <= GRID_INDEX_MAX && !found; col++) {
              const key = `${col}-${row}`;
              if (!occupiedCells.has(key)) {
                grid = placementToGridFields({ seatNumber: nextSeatNumber, row, column: col });
                occupiedCells.add(key);
                found = true;
              }
            }
          }
          if (!grid) {
            throw new ApiError(400, MESSAGES.SEAT_MAP_GRID_FULL);
          }
        }

        seatsToInsert.push({
          library: libraryId,
          seatNumber: nextSeatNumber,
          gridColumn: grid.gridColumn,
          gridRow: grid.gridRow,
          gridColumnIndex: grid.gridColumnIndex,
          gridRowIndex: grid.gridRowIndex,
          cellLabel: grid.cellLabel,
          status: SeatStatus.AVAILABLE,
        });
        nextSeatNumber += 1;
      }

      await Seat.insertMany(seatsToInsert);

      const newTotal = currentCount + delta;
      library.totalSeats = newTotal;

      if (!library.hasCustomSeatMap) {
        library.seatMapRows = computeSeatMapRows(newTotal, seatMapColumns);
      } else {
        const maxRow = Math.max(
          library.seatMapRows ? library.seatMapRows - 1 : 0,
          ...seatsToInsert.map((s) => s.gridRowIndex)
        );
        const maxCol = Math.max(
          library.seatMapColumns ? library.seatMapColumns - 1 : 0,
          ...seatsToInsert.map((s) => s.gridColumnIndex)
        );
        library.seatMapRows = Math.max(library.seatMapRows ?? 0, maxRow + 1);
        library.seatMapColumns = Math.max(library.seatMapColumns ?? seatMapColumns, maxCol + 1);
      }

      await library.save();
      return { totalSeats: newTotal, added: delta };
    }

    const removeCount = Math.abs(delta);
    if (currentCount - removeCount < 1) {
      throw new ApiError(400, MESSAGES.SEAT_MIN_LIMIT);
    }

    const seats = await Seat.find({ library: libraryId }).sort({ seatNumber: -1 });
    const toDelete: string[] = [];

    for (const seat of seats) {
      if (toDelete.length >= removeCount) break;
      if (seat.status === SeatStatus.LOCKED) continue;

      const hasAssignedMember = await Member.exists({
        seat: seat._id,
        status: MemberStatus.ACTIVE,
      });
      if (hasAssignedMember) continue;

      toDelete.push(seat._id.toString());
    }

    if (toDelete.length < removeCount) {
      throw new ApiError(400, MESSAGES.SEAT_REMOVE_NOT_ALLOWED);
    }

    await Seat.deleteMany({ _id: { $in: toDelete } });

    const newTotal = currentCount - removeCount;
    library.totalSeats = newTotal;
    if (!library.hasCustomSeatMap) {
      library.seatMapRows = computeSeatMapRows(newTotal, seatMapColumns);
    }
    await library.save();

    return { totalSeats: newTotal, removed: removeCount };
  },
};
