import mongoose from 'mongoose';
import { Member } from '../models/member.model';
import { Seat } from '../models/seat.model';
import { MemberStatus, SeatStatus } from '../constants/enums';
import { seatService } from './seat.service';

export const dashboardService = {
  async getDashboardStats(libraryId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const libraryObjectId = new mongoose.Types.ObjectId(libraryId);

    const [activeMembers, availableSeats, revenueResult, dueResult, shiftAvailability] =
      await Promise.all([
        Member.countDocuments({ library: libraryId, status: MemberStatus.ACTIVE }),

        Seat.countDocuments({ library: libraryId, status: SeatStatus.AVAILABLE }),

        Member.aggregate([
          {
            $match: {
              library: libraryObjectId,
              createdAt: { $gte: startOfMonth, $lte: endOfMonth },
            },
          },
          {
            $group: {
              _id: null,
              currentMonthRevenue: { $sum: '$amountPaid' },
            },
          },
        ]),

        Member.aggregate([
          {
            $match: {
              library: libraryObjectId,
              dueAmount: { $gt: 0 },
            },
          },
          {
            $group: {
              _id: null,
              totalDueAmount: { $sum: '$dueAmount' },
            },
          },
        ]),

        seatService.getShiftSeatStats(libraryId),
      ]);

    const currentMonthRevenue = revenueResult[0]?.currentMonthRevenue ?? 0;
    const totalDueAmount = dueResult[0]?.totalDueAmount ?? 0;

    return {
      activeMembers,
      availableSeats,
      currentMonthRevenue,
      totalDueAmount,
      shiftAvailability: {
        morning: shiftAvailability.morning,
        evening: shiftAvailability.evening,
        fullDay: shiftAvailability.fullDay,
        morningOccupied: shiftAvailability.morning.occupied,
        eveningOccupied: shiftAvailability.evening.occupied,
        fullDayOccupied: shiftAvailability.fullDay.occupied,
        morningAvailable: shiftAvailability.morning.available,
        eveningAvailable: shiftAvailability.evening.available,
        fullDayAvailable: shiftAvailability.fullDay.available,
      },
    };
  },
};
