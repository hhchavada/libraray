import mongoose from 'mongoose';
import { Member } from '../models/member.model';
import { Seat } from '../models/seat.model';
import { User } from '../models/user.model';
import { MemberStatus, SeatStatus } from '../constants/enums';
import { seatService } from './seat.service';

const FREE_TRIAL_DAYS = 7;

export const dashboardService = {
  async getDashboardStats(libraryId: string, ownerId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const libraryObjectId = new mongoose.Types.ObjectId(libraryId);

    const [activeMembers, availableSeats, revenueResult, dueResult, shiftAvailability, owner] =
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

        User.findById(ownerId).select('createdAt'),
      ]);

    const currentMonthRevenue = revenueResult[0]?.currentMonthRevenue ?? 0;
    const totalDueAmount = dueResult[0]?.totalDueAmount ?? 0;

    // Free trial: 7 days from owner registration date
    const registeredAt = owner?.createdAt ?? now;
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysSinceRegistration = Math.floor((now.getTime() - registeredAt.getTime()) / msPerDay);
    const isFreeTrialExpired = daysSinceRegistration >= FREE_TRIAL_DAYS;
    const freeTrialDaysLeft = Math.max(0, FREE_TRIAL_DAYS - daysSinceRegistration);

    return {
      activeMembers,
      availableSeats,
      currentMonthRevenue,
      totalDueAmount,
      isFreeTrialExpired,
      freeTrialDaysLeft,
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
