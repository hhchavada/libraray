import mongoose from 'mongoose';
import { Seat, ISeatDocument } from '../models/seat.model';
import { Member } from '../models/member.model';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import { SeatStatus, ShiftType, MemberStatus } from '../constants/enums';
import {
  defaultPlacementForSeat,
  placementToGridFields,
  SeatGridPlacement,
} from '../utils/seatGrid.util';
import {
  countMemberShiftOccupancy,
  isSeatAvailableForShift,
  ShiftSeatStats,
} from '../utils/seatShift.util';

const getActiveBookedShifts = async (seatId: string): Promise<ShiftType[]> => {
  const activeMembers = await Member.find({
    seat: seatId,
    status: MemberStatus.ACTIVE,
  }).select('shiftType');

  return activeMembers.map((m) => m.shiftType);
};

const attachSeatBookings = async (seats: ISeatDocument[]) => {
  const seatIds = seats.map((s) => s._id);

  const members = await Member.find({
    seat: { $in: seatIds },
    status: MemberStatus.ACTIVE,
  }).select('seat shiftType fullName memberId');

  const bySeat = new Map<string, Array<{ memberId: string; fullName: string; shiftType: ShiftType }>>();

  for (const member of members) {
    const seatKey = member.seat!.toString();
    const list = bySeat.get(seatKey) ?? [];
    list.push({
      memberId: member.memberId,
      fullName: member.fullName,
      shiftType: member.shiftType,
    });
    bySeat.set(seatKey, list);
  }

  return seats.map((seat) => {
    const bookings = bySeat.get(seat._id.toString()) ?? [];
    const seatObj = seat.toObject() as ISeatDocument & {
      bookings: Array<{ memberId: string; fullName: string; shiftType: ShiftType }>;
      bookedShifts: ShiftType[];
    };
    seatObj.bookings = bookings;
    seatObj.bookedShifts = bookings.map((b) => b.shiftType);
    return seatObj;
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

  async assignSeat(seatId: string, memberId: string, shiftType: ShiftType): Promise<ISeatDocument> {
    const seat = await this.getSeatById(seatId);

    const isAvailable = await this.isSeatAvailableForShift(seatId, shiftType);
    if (!isAvailable) {
      throw new ApiError(400, MESSAGES.SEAT_ALREADY_BOOKED);
    }

    seat.status = SeatStatus.BOOKED;
    seat.assignedTo = new mongoose.Types.ObjectId(memberId);
    seat.shiftType = shiftType;
    seat.lockedAt = null;
    await seat.save();

    const bookedShifts = await getActiveBookedShifts(seatId);
    if (bookedShifts.length > 1) {
      const morningMember = await Member.findOne({
        seat: seatId,
        status: MemberStatus.ACTIVE,
        shiftType: ShiftType.MORNING,
      });
      if (morningMember && shiftType === ShiftType.EVENING) {
        seat.assignedTo = morningMember._id;
        seat.shiftType = ShiftType.MORNING;
        await seat.save();
      }
    }

    return seat;
  },

  async releaseSeat(seatId: string): Promise<ISeatDocument> {
    const seat = await this.getSeatById(seatId);

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
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }

    const seat = await Seat.findById(seatId);
    if (!seat) {
      throw new ApiError(404, MESSAGES.SEAT_NOT_FOUND);
    }

    return seat;
  },
};
