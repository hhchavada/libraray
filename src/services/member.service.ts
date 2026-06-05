import mongoose from 'mongoose';
import { Member, IMemberDocument } from '../models/member.model';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import {
  MemberType,
  MemberStatus,
  PaymentStatus,
  PaymentMode,
  MembershipPlan,
  MEMBERSHIP_PLAN_MONTHS,
  normalizeMembershipPlan,
  ShiftType,
} from '../constants/enums';
import { seatService } from './seat.service';
import { addMonths } from '../utils/subscription.util';

export interface MemberFilters {
  status?: MemberStatus;
  memberType?: MemberType;
  paymentStatus?: PaymentStatus;
  hasSeat?: boolean;
  search?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export type MemberSortOption = 'name_asc' | 'name_desc' | 'newest' | 'expiry_asc';

export interface CreatePermanentMemberData {
  fullName: string;
  mobileNumber: string;
  email?: string;
  courseName?: string;
  memberType: MemberType;
  membershipPlan: MembershipPlan;
  shiftType: ShiftType;
  startDate: Date;
  endDate: Date;
  feePerMonth: number;
  discount?: number;
  paymentStatus: PaymentStatus;
  paymentMode: string;
  amountPaid: number;
  seatId?: string;
  remarks?: string;
}

export interface CreateDemoMemberData {
  fullName: string;
  mobileNumber: string;
  email?: string;
  courseName?: string;
  memberType: MemberType;
  shiftType: ShiftType;
  startDate: Date;
  // endDate is optional for demo members
  endDate?: Date;
  remarks?: string;
}

export type CreateMemberType = 'permanent' | 'demo' | 'without-seat';

export interface CreateMemberData {
  type: CreateMemberType;
  fullName: string;
  mobileNumber: string;
  email?: string;
  courseName?: string;
  shiftType: ShiftType;
  startDate: Date;
  // endDate is optional for demo members
  endDate?: Date;
  remarks?: string;
  membershipPlan?: MembershipPlan;
  feePerMonth?: number;
  discount?: number;
  paymentStatus?: PaymentStatus;
  paymentMode?: string;
  amountPaid?: number;
  seatId?: string;
}

export interface RenewMemberData {
  membershipPlan?: MembershipPlan;
  feePerMonth?: number;
  discount?: number;
  amountPaid: number;
  paymentMode: PaymentMode;
  remarks?: string;
}

export interface ConvertDemoToPermanentData {
  membershipPlan: MembershipPlan;
  feePerMonth: number;
  discount?: number;
  endDate: Date;
  amountPaid: number;
  paymentMode: PaymentMode;
  seatId?: string;
  remarks?: string;
  shiftType?: ShiftType;
  startDate?: Date;
}

const resolvePlanMonths = (plan: MembershipPlan | string): number => {
  const normalized =
    normalizeMembershipPlan(String(plan)) ?? (plan as MembershipPlan);
  const months = MEMBERSHIP_PLAN_MONTHS[normalized];
  if (!months) {
    throw new ApiError(400, MESSAGES.INVALID_MEMBERSHIP_PLAN);
  }
  return months;
};

const calculateFees = (data: {
  feePerMonth: number;
  discount?: number;
  membershipPlan: MembershipPlan | string;
  amountPaid: number;
}) => {
  const discount = data.discount ?? 0;
  if (discount > data.feePerMonth) {
    throw new ApiError(400, MESSAGES.DISCOUNT_EXCEEDS_FEE);
  }
  const feesAfterDiscount = data.feePerMonth - discount;
  const multiplier = resolvePlanMonths(data.membershipPlan);
  const totalFee = feesAfterDiscount * multiplier;
  const dueAmount = Math.max(0, totalFee - data.amountPaid);

  let paymentStatus: PaymentStatus;
  if (data.amountPaid === 0) {
    paymentStatus = PaymentStatus.UNPAID;
  } else if (dueAmount === 0) {
    paymentStatus = PaymentStatus.PAID;
  } else {
    paymentStatus = PaymentStatus.PARTIAL;
  }

  return { feesAfterDiscount, totalFee, dueAmount, paymentStatus };
};

const resolvePaymentStatus = (amountPaid: number, dueAmount: number): PaymentStatus => {
  if (amountPaid === 0) return PaymentStatus.UNPAID;
  if (dueAmount === 0) return PaymentStatus.PAID;
  return PaymentStatus.PARTIAL;
};

const remarksForDb = (remarks?: string | null): string | undefined => {
  const trimmed = remarks?.trim();
  return trimmed ? trimmed : undefined;
};

const buildSortQuery = (sort?: MemberSortOption): Record<string, 1 | -1> => {
  switch (sort) {
    case 'name_asc':
      return { fullName: 1 };
    case 'name_desc':
      return { fullName: -1 };
    case 'expiry_asc':
      return { endDate: 1 };
    case 'newest':
    default:
      return { createdAt: -1 };
  }
};

export const memberService = {
  async createMember(data: CreateMemberData, libraryId: string): Promise<IMemberDocument> {
    let membershipPlan: MembershipPlan | undefined;

    if (data.type !== 'demo') {
      if (!data.membershipPlan) {
        throw new ApiError(400, MESSAGES.INVALID_MEMBERSHIP_PLAN);
      }
      const normalized = normalizeMembershipPlan(String(data.membershipPlan));
      if (!normalized) {
        throw new ApiError(400, MESSAGES.INVALID_MEMBERSHIP_PLAN);
      }
      membershipPlan = normalized;
    }

    switch (data.type) {
      case 'permanent':
        return this.createPermanentMember(
          {
            fullName: data.fullName,
            mobileNumber: data.mobileNumber,
            email: data.email,
            courseName: data.courseName,
            memberType: MemberType.PERMANENT,
            membershipPlan: membershipPlan!,
            shiftType: data.shiftType,
            startDate: data.startDate,
            endDate: data.endDate!,
            feePerMonth: data.feePerMonth!,
            discount: data.discount,
            paymentStatus: data.paymentStatus!,
            paymentMode: data.paymentMode!,
            amountPaid: data.amountPaid!,
            seatId: data.seatId,
            remarks: data.remarks,
          },
          libraryId
        );
      case 'demo':
        return this.createDemoMember(
          {
            fullName: data.fullName,
            mobileNumber: data.mobileNumber,
            email: data.email,
            courseName: data.courseName,
            memberType: MemberType.DEMO,
            shiftType: data.shiftType,
            startDate: data.startDate,
            endDate: data.endDate,
            remarks: data.remarks,
          },
          libraryId
        );
      case 'without-seat':
        return this.createMemberWithoutSeat(
          {
            fullName: data.fullName,
            mobileNumber: data.mobileNumber,
            email: data.email,
            courseName: data.courseName,
            memberType: MemberType.WITHOUT_SEAT,
            membershipPlan: membershipPlan!,
            shiftType: data.shiftType,
            startDate: data.startDate,
            endDate: data.endDate!,
            feePerMonth: data.feePerMonth!,
            discount: data.discount,
            paymentStatus: data.paymentStatus!,
            paymentMode: data.paymentMode!,
            amountPaid: data.amountPaid!,
            remarks: data.remarks,
          },
          libraryId
        );
      default:
        throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }
  },

  async generateMemberId(libraryId: string): Promise<string> {
    const count = await Member.countDocuments({ library: libraryId });
    const paddedNumber = String(count + 1).padStart(4, '0');
    return `LIB-${paddedNumber}`;
  },

  async createPermanentMember(
    data: CreatePermanentMemberData,
    libraryId: string
  ): Promise<IMemberDocument> {
    const memberId = await this.generateMemberId(libraryId);
    const { feesAfterDiscount, totalFee, dueAmount, paymentStatus } = calculateFees({
      feePerMonth: data.feePerMonth,
      discount: data.discount,
      membershipPlan: data.membershipPlan,
      amountPaid: data.amountPaid,
    });

    const member = await Member.create({
      library: libraryId,
      memberId,
      fullName: data.fullName,
      email: data.email,
      mobileNumber: data.mobileNumber,
      courseName: data.courseName,
      memberType: MemberType.PERMANENT,
      membershipPlan: data.membershipPlan,
      shiftType: data.shiftType,
      startDate: data.startDate,
      endDate: data.endDate,
      feePerMonth: data.feePerMonth,
      discount: data.discount ?? 0,
      feesAfterDiscount,
      totalFee,
      amountPaid: data.amountPaid,
      dueAmount,
      paymentStatus,
      paymentMode: data.paymentMode,
      ...(remarksForDb(data.remarks) ? { remarks: remarksForDb(data.remarks) } : {}),
    });

    if (data.seatId) {
      await seatService.assignSeat(data.seatId, member._id.toString(), data.shiftType);
      member.seat = new mongoose.Types.ObjectId(data.seatId);
      await member.save();
      await seatService.syncSeatFromMembers(data.seatId);
    }

    return member.populate('seat');
  },

  async createDemoMember(data: CreateDemoMemberData, libraryId: string): Promise<IMemberDocument> {
    const memberId = await this.generateMemberId(libraryId);

    const payload: Record<string, unknown> = {
      library: libraryId,
      memberId,
      fullName: data.fullName,
      email: data.email,
      mobileNumber: data.mobileNumber,
      courseName: data.courseName,
      memberType: MemberType.DEMO,
      shiftType: data.shiftType,
      startDate: data.startDate,
    };

    if (data.endDate) {
      payload.endDate = data.endDate;
    }
    const remarks = remarksForDb(data.remarks);
    if (remarks) {
      payload.remarks = remarks;
    }

    return Member.create(payload);
  },

  async createMemberWithoutSeat(
    data: CreatePermanentMemberData,
    libraryId: string
  ): Promise<IMemberDocument> {
    const memberId = await this.generateMemberId(libraryId);
    const { feesAfterDiscount, totalFee, dueAmount, paymentStatus } = calculateFees({
      feePerMonth: data.feePerMonth,
      discount: data.discount,
      membershipPlan: data.membershipPlan,
      amountPaid: data.amountPaid,
    });

    return Member.create({
      library: libraryId,
      memberId,
      fullName: data.fullName,
      email: data.email,
      mobileNumber: data.mobileNumber,
      courseName: data.courseName,
      memberType: MemberType.WITHOUT_SEAT,
      membershipPlan: data.membershipPlan,
      shiftType: data.shiftType,
      startDate: data.startDate,
      endDate: data.endDate,
      feePerMonth: data.feePerMonth,
      discount: data.discount ?? 0,
      feesAfterDiscount,
      totalFee,
      amountPaid: data.amountPaid,
      dueAmount,
      paymentStatus,
      paymentMode: data.paymentMode,
      ...(remarksForDb(data.remarks) ? { remarks: remarksForDb(data.remarks) } : {}),
    });
  },

  async getAllMembers(
    libraryId: string,
    filters: MemberFilters = {},
    pagination: PaginationOptions = {},
    sort?: MemberSortOption
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { library: libraryId };

    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.memberType) {
      query.memberType = filters.memberType;
    }
    if (filters.paymentStatus) {
      query.paymentStatus = filters.paymentStatus;
    }
    if (filters.hasSeat === true) {
      query.seat = { $exists: true, $ne: null };
    } else if (filters.hasSeat === false) {
      query.$or = [{ seat: { $exists: false } }, { seat: null }];
    }
    if (filters.search) {
      query.fullName = { $regex: filters.search, $options: 'i' };
    }

    const sortQuery = buildSortQuery(sort);

    const [members, totalCount] = await Promise.all([
      Member.find(query).populate('seat').sort(sortQuery).skip(skip).limit(limit),
      Member.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      members,
      totalCount,
      totalPages,
      currentPage: page,
    };
  },

  async getMemberById(
    memberId: string,
    options?: { populateSeat?: boolean }
  ): Promise<IMemberDocument> {
    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      throw new ApiError(400, MESSAGES.INVALID_MEMBER_ID);
    }

    let query = Member.findById(memberId);
    if (options?.populateSeat !== false) {
      query = query.populate({ path: 'seat', strictPopulate: false });
    }

    const member = await query;
    if (!member) {
      throw new ApiError(404, MESSAGES.MEMBER_NOT_FOUND);
    }
    return member;
  },

  async assignSeatToMember(
    memberId: string,
    libraryId: string,
    seatId: string,
    shiftType?: ShiftType
  ): Promise<IMemberDocument> {
    const member = await this.getMemberById(memberId);

    if (member.library.toString() !== libraryId) {
      throw new ApiError(404, MESSAGES.MEMBER_NOT_FOUND);
    }

    if (member.seat) {
      throw new ApiError(400, MESSAGES.MEMBER_ALREADY_HAS_SEAT);
    }

    if (member.memberType === MemberType.DEMO) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }

    const seat = await seatService.getSeatById(seatId);
    if (seat.library.toString() !== libraryId) {
      throw new ApiError(400, MESSAGES.SEAT_LIBRARY_MISMATCH);
    }

    const shift = shiftType ?? member.shiftType;

    await seatService.assignSeat(seatId, member._id.toString(), shift);
    member.seat = new mongoose.Types.ObjectId(seatId);
    member.shiftType = shift;

    if (member.memberType === MemberType.WITHOUT_SEAT) {
      member.memberType = MemberType.PERMANENT;
    }

    await member.save();
    await seatService.syncSeatFromMembers(seatId);
    return member.populate('seat');
  },

  async changeMemberSeat(
    memberId: string,
    libraryId: string,
    newSeatId: string,
    shiftType: ShiftType
  ): Promise<IMemberDocument> {
    const member = await this.getMemberById(memberId, { populateSeat: false });

    if (member.library.toString() !== libraryId) {
      throw new ApiError(404, MESSAGES.MEMBER_NOT_FOUND);
    }

    if (!member.seat) {
      throw new ApiError(400, MESSAGES.MEMBER_HAS_NO_SEAT);
    }

    const oldSeatId = member.seat.toString();

    if (oldSeatId === newSeatId) {
      throw new ApiError(400, MESSAGES.SAME_SEAT_SELECTED);
    }

    const newSeat = await seatService.getSeatById(newSeatId);
    if (newSeat.library.toString() !== libraryId) {
      throw new ApiError(400, MESSAGES.SEAT_LIBRARY_MISMATCH);
    }

    const memberTypeBefore = member.memberType;

    await seatService.releaseSeat(oldSeatId, member._id.toString());
    await seatService.assignSeat(newSeatId, member._id.toString(), shiftType);

    member.seat = new mongoose.Types.ObjectId(newSeatId);
    member.shiftType = shiftType;
    if (memberTypeBefore === MemberType.PERMANENT) {
      member.memberType = MemberType.PERMANENT;
    }
    await member.save();
    await seatService.syncSeatFromMembers(newSeatId);

    return member.populate('seat');
  },

  async convertDemoToPermanent(
    memberId: string,
    libraryId: string,
    data: ConvertDemoToPermanentData
  ): Promise<IMemberDocument> {
    const member = await this.getMemberById(memberId, { populateSeat: false });

    if (member.library.toString() !== libraryId) {
      throw new ApiError(404, MESSAGES.MEMBER_NOT_FOUND);
    }

    if (member.memberType !== MemberType.DEMO) {
      throw new ApiError(400, MESSAGES.MEMBER_CONVERT_NOT_DEMO);
    }

    const normalized = normalizeMembershipPlan(String(data.membershipPlan));
    if (!normalized) {
      throw new ApiError(400, MESSAGES.INVALID_MEMBERSHIP_PLAN);
    }

    const endDate = new Date(data.endDate);
    const startDate = data.startDate ? new Date(data.startDate) : new Date(member.startDate);
    if (endDate <= startDate) {
      throw new ApiError(400, MESSAGES.END_DATE_AFTER_START);
    }

    const { feesAfterDiscount, totalFee, dueAmount, paymentStatus } = calculateFees({
      feePerMonth: data.feePerMonth,
      discount: data.discount,
      membershipPlan: normalized,
      amountPaid: data.amountPaid,
    });

    member.memberType = MemberType.PERMANENT;
    member.membershipPlan = normalized;
    member.feePerMonth = data.feePerMonth;
    member.discount = data.discount ?? 0;
    member.feesAfterDiscount = feesAfterDiscount;
    member.totalFee = totalFee;
    member.amountPaid = data.amountPaid;
    member.dueAmount = dueAmount;
    member.paymentStatus = paymentStatus;
    member.paymentMode = data.paymentMode;
    if (data.startDate) {
      member.startDate = startDate;
    }
    member.endDate = endDate;
    member.status = MemberStatus.ACTIVE;

    if (data.shiftType) {
      member.shiftType = data.shiftType;
    }

    if (data.remarks !== undefined) {
      member.remarks = remarksForDb(data.remarks);
    }

    await member.save();

    if (data.seatId) {
      const seat = await seatService.getSeatById(data.seatId);
      if (seat.library.toString() !== libraryId) {
        throw new ApiError(400, MESSAGES.SEAT_LIBRARY_MISMATCH);
      }
      await seatService.assignSeat(data.seatId, member._id.toString(), member.shiftType);
      member.seat = new mongoose.Types.ObjectId(data.seatId);
      await member.save();
      await seatService.syncSeatFromMembers(data.seatId);
    }

    return member.populate('seat');
  },

  async renewMember(
    memberId: string,
    libraryId: string,
    data: RenewMemberData
  ): Promise<IMemberDocument> {
    const member = await this.getMemberById(memberId);

    if (member.library.toString() !== libraryId) {
      throw new ApiError(404, MESSAGES.MEMBER_NOT_FOUND);
    }

    if (member.memberType === MemberType.DEMO) {
      throw new ApiError(400, MESSAGES.MEMBER_RENEW_NOT_ALLOWED);
    }

    let membershipPlan = member.membershipPlan;
    if (data.membershipPlan) {
      const normalized = normalizeMembershipPlan(String(data.membershipPlan));
      if (!normalized) {
        throw new ApiError(400, MESSAGES.INVALID_MEMBERSHIP_PLAN);
      }
      membershipPlan = normalized;
    }

    if (!membershipPlan) {
      throw new ApiError(400, MESSAGES.INVALID_MEMBERSHIP_PLAN);
    }

    const feePerMonth = data.feePerMonth ?? member.feePerMonth;
    if (!feePerMonth) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }

    const discount = data.discount ?? member.discount ?? 0;
    const planMonths = resolvePlanMonths(membershipPlan);

    const now = new Date();
    const previousEndDate = new Date(member.endDate ?? new Date());
    const renewalStart = previousEndDate > now ? previousEndDate : now;
    const newEndDate = addMonths(renewalStart, planMonths);

    const renewalPeriod = calculateFees({
      feePerMonth,
      discount,
      membershipPlan,
      amountPaid: data.amountPaid,
    });

    member.membershipPlan = membershipPlan;
    member.feePerMonth = feePerMonth;
    member.discount = discount;
    member.feesAfterDiscount = renewalPeriod.feesAfterDiscount;
    member.totalFee = (member.totalFee ?? 0) + renewalPeriod.totalFee;
    member.amountPaid = (member.amountPaid ?? 0) + data.amountPaid;
    member.dueAmount = Math.max(0, member.totalFee - member.amountPaid);
    member.paymentStatus = resolvePaymentStatus(member.amountPaid, member.dueAmount);
    member.paymentMode = data.paymentMode;
    member.endDate = newEndDate;
    member.status = MemberStatus.ACTIVE;

    if (data.remarks !== undefined) {
      member.remarks = remarksForDb(data.remarks);
    }

    await member.save();
    return member.populate('seat');
  },

  async updateMember(memberId: string, data: Partial<CreatePermanentMemberData>): Promise<IMemberDocument> {
    const member = await this.getMemberById(memberId);

    const feeFieldsUpdated =
      data.feePerMonth !== undefined ||
      data.discount !== undefined ||
      data.membershipPlan !== undefined ||
      data.amountPaid !== undefined;

    if (feeFieldsUpdated && member.feePerMonth && member.membershipPlan) {
      const { feesAfterDiscount, totalFee, dueAmount, paymentStatus } = calculateFees({
        feePerMonth: data.feePerMonth ?? member.feePerMonth,
        discount: data.discount ?? member.discount,
        membershipPlan: data.membershipPlan ?? member.membershipPlan,
        amountPaid: data.amountPaid ?? member.amountPaid,
      });

      member.feesAfterDiscount = feesAfterDiscount;
      member.totalFee = totalFee;
      member.dueAmount = dueAmount;
      member.paymentStatus = paymentStatus;
    }

    if (data.fullName) member.fullName = data.fullName;
    if (data.mobileNumber) member.mobileNumber = data.mobileNumber;
    if (data.email !== undefined) member.email = data.email;
    if (data.courseName !== undefined) member.courseName = data.courseName;
    if (data.shiftType) member.shiftType = data.shiftType;
    if (data.startDate) member.startDate = data.startDate;
    if (data.endDate) member.endDate = data.endDate;
    if (data.feePerMonth !== undefined) member.feePerMonth = data.feePerMonth;
    if (data.discount !== undefined) member.discount = data.discount;
    if (data.membershipPlan) {
      const normalized = normalizeMembershipPlan(String(data.membershipPlan));
      if (!normalized) {
        throw new ApiError(400, MESSAGES.INVALID_MEMBERSHIP_PLAN);
      }
      member.membershipPlan = normalized;
    }
    if (data.amountPaid !== undefined) member.amountPaid = data.amountPaid;
    if (data.paymentMode) member.paymentMode = data.paymentMode as IMemberDocument['paymentMode'];
    if (data.remarks !== undefined) {
      member.remarks = remarksForDb(data.remarks);
    }

    await member.save();
    return member.populate('seat');
  },

  async deleteMember(memberId: string): Promise<void> {
    const member = await this.getMemberById(memberId, { populateSeat: false });
    const seatId = member.seat?.toString();

    await Member.findByIdAndDelete(memberId);

    if (seatId) {
      await seatService.syncSeatFromMembers(seatId);
    }
  },


  async markAsPaid(
    memberId: string,
    libraryId: string,
    data: { amountPaid: number; paymentMode: PaymentMode; remarks?: string }
  ): Promise<IMemberDocument> {
    const member = await this.getMemberById(memberId);

    if (member.library.toString() !== libraryId) {
      throw new ApiError(404, MESSAGES.MEMBER_NOT_FOUND);
    }

    if (member.memberType === MemberType.DEMO) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }

    const currentDue = member.dueAmount ?? 0;

    if (currentDue <= 0) {
      throw new ApiError(400, MESSAGES.MEMBER_NO_DUE);
    }

    if (data.amountPaid > currentDue) {
      throw new ApiError(400, MESSAGES.MEMBER_PAYMENT_EXCEEDS_DUE);
    }

    member.amountPaid = (member.amountPaid ?? 0) + data.amountPaid;
    member.dueAmount = Math.max(0, currentDue - data.amountPaid);
    member.paymentStatus = resolvePaymentStatus(member.amountPaid, member.dueAmount);
    member.paymentMode = data.paymentMode;

    if (data.remarks !== undefined) {
      member.remarks = remarksForDb(data.remarks);
    }

    await member.save();
    return member.populate('seat');
  },

  async getExpiredMembers(libraryId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await Member.updateMany(
      {
        library: libraryId,
        endDate: { $lt: today },
        status: MemberStatus.ACTIVE,
      },
      { status: MemberStatus.EXPIRED }
    );

    return result.modifiedCount;
  },

  /**
   * Returns active members whose membership plan is expiring
   * within the next 1–5 days (including today).
   */
  async getExpiringSoonMembers(libraryId: string): Promise<{
    members: Array<Record<string, unknown> & { daysRemaining: number }>;
    totalCount: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fiveDaysLater = new Date(today);
    fiveDaysLater.setDate(fiveDaysLater.getDate() + 5);
    fiveDaysLater.setHours(23, 59, 59, 999);

    const members = await Member.find({
      library: libraryId,
      status: MemberStatus.ACTIVE,
      endDate: { $gte: today, $lte: fiveDaysLater },
    })
      .populate('seat')
      .sort({ endDate: 1 });

    const now = new Date();
    const membersWithDays = members.map((m) => {
      const memberObj = m.toJSON();
      const endDate = new Date(m.endDate as Date);
      const diffMs = endDate.getTime() - now.getTime();
      const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      return {
        ...memberObj,
        daysRemaining,
      };
    });

    return {
      members: membersWithDays,
      totalCount: membersWithDays.length,
    };
  },
};
