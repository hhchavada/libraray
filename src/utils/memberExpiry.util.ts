import { MemberStatus } from '../constants/enums';

export const startOfDay = (date: Date = new Date()): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Membership is expired after the endDate calendar day has passed. */
export const isMembershipExpired = (endDate?: Date | null): boolean => {
  if (!endDate) return false;
  return startOfDay() > startOfDay(new Date(endDate));
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
