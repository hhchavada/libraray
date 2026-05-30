import mongoose from 'mongoose';
import { Library } from '../models/library.model';
import { Member } from '../models/member.model';
import { Seat } from '../models/seat.model';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import { MemberStatus, MemberType, SeatStatus } from '../constants/enums';
import { seatService } from './seat.service';
import { formatMemberLabels, formatSeatLabels } from '../utils/formatLabel.util';

export interface AdminLibraryRow {
  libraryId: string;
  libraryName: string;
  address: string;
  isActive: boolean;
  totalSeats: number;
  createdAt: Date;
  owner: {
    id: string;
    fullName: string;
    email: string;
    mobileNumber: string;
  } | null;
  members: {
    total: number;
    active: number;
    permanent: number;
    demo: number;
    withoutSeat: number;
  };
  seats: {
    total: number;
    available: number;
    booked: number;
    locked: number;
    morningOccupied: number;
    eveningOccupied: number;
    morningAvailable: number;
    eveningAvailable: number;
  };
  revenue: {
    totalCollected: number;
    totalDue: number;
  };
}

export interface AdminLibraryDetail extends AdminLibraryRow {
  seatMap: {
    rows: number;
    columns: number;
    hasCustomSeatMap: boolean;
  };
  membersList: Array<{
    id: string;
    memberId: string;
    fullName: string;
    mobileNumber: string;
    memberType: string;
    shiftType: string;
    status: string;
    membershipPlan?: string | null;
    amountPaid: number;
    dueAmount: number;
    seatNumber: number | null;
  }>;
  seatsList: Array<{
    id: string;
    seatNumber: number;
    status: string;
    cellLabel: string | null;
    gridRow: string | null;
    gridColumn: string | null;
    bookedShifts: string[];
    bookings: Array<{ memberId: string; fullName: string; shiftType: string }>;
  }>;
}

export interface AdminDashboardData {
  summary: {
    totalLibraries: number;
    activeLibraries: number;
    totalMembers: number;
    activeMembers: number;
    totalSeats: number;
    availableSeats: number;
    bookedSeats: number;
    lockedSeats: number;
    totalRevenue: number;
    totalDue: number;
  };
  libraries: AdminLibraryRow[];
}

const buildLibraryStats = async (
  library: {
    _id: mongoose.Types.ObjectId;
    libraryName: string;
    address: string;
    isActive: boolean;
    totalSeats: number;
    createdAt: Date;
    owner: unknown;
  }
): Promise<AdminLibraryRow> => {
  const libraryId = library._id.toString();
  const libraryObjectId = library._id;

  const [
    memberTypeCounts,
    memberStatusCounts,
    seatStatusCounts,
    shiftStats,
    revenueAgg,
  ] = await Promise.all([
    Member.aggregate<{ _id: MemberType; count: number }>([
      { $match: { library: libraryObjectId } },
      { $group: { _id: '$memberType', count: { $sum: 1 } } },
    ]),
    Member.aggregate<{ _id: MemberStatus; count: number }>([
      { $match: { library: libraryObjectId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Seat.aggregate<{ _id: SeatStatus; count: number }>([
      { $match: { library: libraryObjectId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    seatService.getShiftSeatStats(libraryId),
    Member.aggregate<{ totalCollected: number; totalDue: number }>([
      { $match: { library: libraryObjectId } },
      {
        $group: {
          _id: null,
          totalCollected: { $sum: '$amountPaid' },
          totalDue: { $sum: '$dueAmount' },
        },
      },
    ]),
  ]);

  const countByMemberType = (type: MemberType) =>
    memberTypeCounts.find((r) => r._id === type)?.count ?? 0;
  const activeMembers =
    memberStatusCounts.find((r) => r._id === MemberStatus.ACTIVE)?.count ?? 0;
  const totalMembers = memberTypeCounts.reduce((sum, r) => sum + r.count, 0);

  const countBySeatStatus = (status: SeatStatus) =>
    seatStatusCounts.find((r) => r._id === status)?.count ?? 0;
  const seatTotal = seatStatusCounts.reduce((sum, r) => sum + r.count, 0);

  const ownerDoc = library.owner as unknown as
    | { _id: mongoose.Types.ObjectId; fullName: string; email: string; mobileNumber: string }
    | null;
  const owner =
    ownerDoc && typeof ownerDoc === 'object' && 'fullName' in ownerDoc ? ownerDoc : null;

  return {
    libraryId,
    libraryName: library.libraryName,
    address: library.address,
    isActive: library.isActive,
    totalSeats: library.totalSeats,
    createdAt: library.createdAt,
    owner: owner
      ? {
          id: owner._id.toString(),
          fullName: owner.fullName,
          email: owner.email,
          mobileNumber: owner.mobileNumber,
        }
      : null,
    members: {
      total: totalMembers,
      active: activeMembers,
      permanent: countByMemberType(MemberType.PERMANENT),
      demo: countByMemberType(MemberType.DEMO),
      withoutSeat: countByMemberType(MemberType.WITHOUT_SEAT),
    },
    seats: {
      total: seatTotal,
      available: countBySeatStatus(SeatStatus.AVAILABLE),
      booked: countBySeatStatus(SeatStatus.BOOKED),
      locked: countBySeatStatus(SeatStatus.LOCKED),
      morningOccupied: shiftStats.morning.occupied,
      eveningOccupied: shiftStats.evening.occupied,
      morningAvailable: shiftStats.morning.available,
      eveningAvailable: shiftStats.evening.available,
    },
    revenue: {
      totalCollected: revenueAgg[0]?.totalCollected ?? 0,
      totalDue: revenueAgg[0]?.totalDue ?? 0,
    },
  };
};

export const adminService = {
  async getDashboard(): Promise<AdminDashboardData> {
    const libraries = await Library.find()
      .populate('owner', 'fullName email mobileNumber')
      .sort({ createdAt: -1 })
      .lean();

    const libraryRows = await Promise.all(libraries.map((lib) => buildLibraryStats(lib)));

    const summary = libraryRows.reduce(
      (acc, row) => {
        acc.totalLibraries += 1;
        if (row.isActive) acc.activeLibraries += 1;
        acc.totalMembers += row.members.total;
        acc.activeMembers += row.members.active;
        acc.totalSeats += row.seats.total;
        acc.availableSeats += row.seats.available;
        acc.bookedSeats += row.seats.booked;
        acc.lockedSeats += row.seats.locked;
        acc.totalRevenue += row.revenue.totalCollected;
        acc.totalDue += row.revenue.totalDue;
        return acc;
      },
      {
        totalLibraries: 0,
        activeLibraries: 0,
        totalMembers: 0,
        activeMembers: 0,
        totalSeats: 0,
        availableSeats: 0,
        bookedSeats: 0,
        lockedSeats: 0,
        totalRevenue: 0,
        totalDue: 0,
      }
    );

    return { summary, libraries: libraryRows };
  },

  async getLibraryDetail(libraryId: string): Promise<AdminLibraryDetail> {
    if (!mongoose.Types.ObjectId.isValid(libraryId)) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }

    const library = await Library.findById(libraryId)
      .populate('owner', 'fullName email mobileNumber')
      .lean();

    if (!library) {
      throw new ApiError(404, MESSAGES.LIBRARY_NOT_FOUND);
    }

    const stats = await buildLibraryStats(library);

    const [members, seatsRaw] = await Promise.all([
      Member.find({ library: libraryId })
        .populate('seat', 'seatNumber')
        .sort({ createdAt: -1 })
        .lean(),
      seatService.getAllSeats(libraryId),
    ]);

    const seatsList = seatsRaw.map((seat) => {
      const s = seat as typeof seat & {
        bookings?: Array<{ memberId: string; fullName: string; shiftType: string }>;
        bookedShifts?: string[];
      };
      return formatSeatLabels({
        id: String(s._id),
        seatNumber: s.seatNumber,
        status: s.status,
        cellLabel: s.cellLabel ?? null,
        gridRow: s.gridRow ?? null,
        gridColumn: s.gridColumn ?? null,
        bookedShifts: s.bookedShifts ?? [],
        bookings: s.bookings ?? [],
      } as Record<string, unknown>) as AdminLibraryDetail['seatsList'][number];
    });

    return {
      ...stats,
      seatMap: {
        rows: library.seatMapRows ?? 0,
        columns: library.seatMapColumns ?? 12,
        hasCustomSeatMap: library.hasCustomSeatMap,
      },
      membersList: members.map((m) => {
        const seat = m.seat as { seatNumber?: number } | null | undefined;
        return formatMemberLabels({
          id: m._id.toString(),
          memberId: m.memberId,
          fullName: m.fullName,
          mobileNumber: m.mobileNumber,
          memberType: m.memberType,
          shiftType: m.shiftType,
          status: m.status,
          amountPaid: m.amountPaid ?? 0,
          dueAmount: m.dueAmount ?? 0,
          seatNumber: seat?.seatNumber ?? null,
          membershipPlan: m.membershipPlan ?? null,
        } as Record<string, unknown>);
      }) as AdminLibraryDetail['membersList'],
      seatsList,
    };
  },
};
