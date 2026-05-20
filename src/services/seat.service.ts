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

  async getAllSeats(libraryId: string): Promise<ISeatDocument[]> {
    return Seat.find({ library: libraryId }).sort({ seatNumber: 1 }).populate('assignedTo', 'fullName memberId');
  },

  /**
   * Shift availability rules:
   * - FULL_DAY booking blocks the seat for all other bookings
   * - MORNING booking still allows EVENING on the same seat
   * - EVENING booking still allows MORNING on the same seat
   * - A seat can hold max 2 members (one MORNING + one EVENING)
   */
  async getAvailableSeats(libraryId: string, shiftType?: ShiftType): Promise<ISeatDocument[]> {
    const seats = await Seat.find({ library: libraryId }).sort({ seatNumber: 1 });

    const availableSeats: ISeatDocument[] = [];

    for (const seat of seats) {
      if (seat.status === SeatStatus.LOCKED) {
        continue;
      }

      let isAvailable = false;

      if (!shiftType) {
        const [morning, evening, fullDay] = await Promise.all([
          this.isSeatAvailableForShift(seat._id.toString(), ShiftType.MORNING),
          this.isSeatAvailableForShift(seat._id.toString(), ShiftType.EVENING),
          this.isSeatAvailableForShift(seat._id.toString(), ShiftType.FULL_DAY),
        ]);
        isAvailable = morning || evening || fullDay;
      } else {
        isAvailable = await this.isSeatAvailableForShift(seat._id.toString(), shiftType);
      }

      if (isAvailable) {
        availableSeats.push(seat);
      }
    }

    return availableSeats;
  },

  async isSeatAvailableForShift(seatId: string, requestedShift: ShiftType): Promise<boolean> {
    const activeMembers = await Member.find({
      seat: seatId,
      status: MemberStatus.ACTIVE,
    });

    const bookedShifts = activeMembers.map((m) => m.shiftType);

    // FULL_DAY seat → not available for any other booking
    if (bookedShifts.includes(ShiftType.FULL_DAY)) {
      return false;
    }

    if (requestedShift === ShiftType.FULL_DAY) {
      return bookedShifts.length === 0;
    }

    // MORNING seat → still available for EVENING (and vice versa)
    if (requestedShift === ShiftType.MORNING) {
      return !bookedShifts.includes(ShiftType.MORNING);
    }

    if (requestedShift === ShiftType.EVENING) {
      return !bookedShifts.includes(ShiftType.EVENING);
    }

    return bookedShifts.length < 2;
  },

  async lockSeat(seatId: string, _memberId: string): Promise<ISeatDocument> {
    const seat = await this.getSeatById(seatId);

    const isAvailable = await this.isSeatAvailableForShift(seatId, ShiftType.FULL_DAY);
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

    return seat;
  },

  async releaseSeat(seatId: string): Promise<ISeatDocument> {
    const seat = await this.getSeatById(seatId);

    const remainingMembers = await Member.countDocuments({
      seat: seatId,
      status: MemberStatus.ACTIVE,
    });

    if (remainingMembers === 0) {
      seat.status = SeatStatus.AVAILABLE;
      seat.assignedTo = null;
      seat.shiftType = null;
      seat.lockedAt = null;
    } else {
      const activeMember = await Member.findOne({
        seat: seatId,
        status: MemberStatus.ACTIVE,
      }).sort({ createdAt: -1 });

      if (activeMember) {
        seat.assignedTo = activeMember._id;
        seat.shiftType = activeMember.shiftType;
        seat.status = SeatStatus.BOOKED;
      }
    }

    await seat.save();
    return seat;
  },

  async getSeatsByShift(libraryId: string) {
    const seats = await Seat.find({ library: libraryId });

    let morning = 0;
    let evening = 0;
    let fullDay = 0;

    for (const seat of seats) {
      if (seat.status === SeatStatus.LOCKED) {
        continue;
      }

      const morningAvailable = await this.isSeatAvailableForShift(seat._id.toString(), ShiftType.MORNING);
      const eveningAvailable = await this.isSeatAvailableForShift(seat._id.toString(), ShiftType.EVENING);
      const fullDayAvailable = await this.isSeatAvailableForShift(seat._id.toString(), ShiftType.FULL_DAY);

      if (morningAvailable) morning++;
      if (eveningAvailable) evening++;
      if (fullDayAvailable) fullDay++;
    }

    return { morning, evening, fullDay };
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
