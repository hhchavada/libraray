import { MemberStatus } from '../constants/enums';

const IST_TIMEZONE = 'Asia/Kolkata';

/** Calendar date at local midnight (IST) — ignores time-of-day / UTC offset issues. */
export const normalizeMemberDate = (input: Date | string): Date => {
  const d = new Date(input);
  const ymd = d.toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

export const startOfTodayIST = (): Date => normalizeMemberDate(new Date());

/** Add whole calendar months; keeps same day-of-month when possible (Jan 17 → Feb 17). */
export const addCalendarMonths = (date: Date, months: number): Date => {
  const base = normalizeMemberDate(date);
  const day = base.getDate();
  base.setMonth(base.getMonth() + months);
  if (base.getDate() < day) {
    base.setDate(0);
  }
  return base;
};

export const computeMemberEndDate = (startDate: Date, planMonths: number): Date =>
  addCalendarMonths(startDate, planMonths);

/** Membership expires on the endDate calendar day (IST), not the day after. */
export const isMembershipExpired = (endDate?: Date | null): boolean => {
  if (!endDate) return false;
  const today = startOfTodayIST();
  const end = normalizeMemberDate(endDate);
  return today.getTime() >= end.getTime();
};

export const initialMemberStatus = (endDate?: Date | null): MemberStatus =>
  isMembershipExpired(endDate) ? MemberStatus.EXPIRED : MemberStatus.ACTIVE;

export const resolveMemberStatusOnUpdate = (
  endDate: Date | undefined,
  currentStatus: MemberStatus
): MemberStatus => {
  if (currentStatus === MemberStatus.INACTIVE) {
    return MemberStatus.INACTIVE;
  }
  if (isMembershipExpired(endDate)) {
    return MemberStatus.EXPIRED;
  }
  if (currentStatus === MemberStatus.EXPIRED) {
    return MemberStatus.ACTIVE;
  }
  return currentStatus;
};

export const daysUntilMemberExpiry = (endDate: Date): number => {
  const today = startOfTodayIST();
  const end = normalizeMemberDate(endDate);
  return Math.max(0, Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
};

/** @deprecated Use startOfTodayIST */
export const startOfDay = startOfTodayIST;
