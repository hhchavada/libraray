import { LibraryLifecycleStatus, LibrarySubscriptionStatus, SubscriptionPaymentStatus } from '../constants/enums';

const GRACE_DAYS = 3;

export interface SubscriptionSnapshot {
  hasPaidSubscription: boolean;
  endDate?: Date | null;
  status?: string;
}

export const resolveLibraryLifecycleStatus = (
  snapshot: SubscriptionSnapshot,
  now = new Date()
): LibraryLifecycleStatus => {
  if (!snapshot.hasPaidSubscription) {
    return LibraryLifecycleStatus.DEMO;
  }

  if (!snapshot.endDate) {
    return LibraryLifecycleStatus.DEMO;
  }

  const end = new Date(snapshot.endDate);
  if (end >= now) {
    return LibraryLifecycleStatus.ACTIVE;
  }

  const graceEnd = new Date(end);
  graceEnd.setDate(graceEnd.getDate() + GRACE_DAYS);

  if (now <= graceEnd) {
    return LibraryLifecycleStatus.GRACE_PERIOD;
  }

  return LibraryLifecycleStatus.TERMINATED;
};

export const isPaidSubscription = (sub: {
  paymentStatus: string;
  status: string;
}): boolean =>
  sub.paymentStatus === SubscriptionPaymentStatus.PAID &&
  sub.status !== LibrarySubscriptionStatus.CANCELLED;
