import { User } from '../models/user.model';
import { Subscription } from '../models/subscription.model';
import {
  LibrarySubscriptionStatus,
  SubscriptionPaymentStatus,
} from '../constants/enums';

export const FREE_TRIAL_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface FreeTrialInfo {
  totalDays: number;
  daysRemaining: number;
  daysUsed: number;
  startedAt: string;
  expiresAt: string;
  isActive: boolean;
  isExpired: boolean;
  /** Set when user has an active paid subscription. */
  supersededBySubscription?: boolean;
}

export const buildFreeTrialInfo = (
  startedAt?: Date | null,
  fallbackCreatedAt?: Date | null
): FreeTrialInfo | null => {
  const start = startedAt ?? fallbackCreatedAt;
  if (!start) {
    return null;
  }

  const started = new Date(start);
  const expiresAt = new Date(started.getTime() + FREE_TRIAL_DAYS * MS_PER_DAY);
  const remainingMs = expiresAt.getTime() - Date.now();
  const daysRemaining = Math.max(0, Math.ceil(remainingMs / MS_PER_DAY));
  const daysUsed = Math.min(FREE_TRIAL_DAYS, FREE_TRIAL_DAYS - daysRemaining);

  return {
    totalDays: FREE_TRIAL_DAYS,
    daysRemaining,
    daysUsed,
    startedAt: started.toISOString(),
    expiresAt: expiresAt.toISOString(),
    isActive: daysRemaining > 0,
    isExpired: daysRemaining === 0,
  };
};

export const getFreeTrialForUserId = async (userId: string): Promise<FreeTrialInfo | null> => {
  const user = await User.findById(userId).select('freeTrialStartedAt createdAt');
  if (!user) {
    return null;
  }

  const trial = buildFreeTrialInfo(user.freeTrialStartedAt, user.createdAt);
  if (!trial) {
    return null;
  }

  const hasPaidSubscription = await Subscription.exists({
    userId,
    status: LibrarySubscriptionStatus.ACTIVE,
    paymentStatus: SubscriptionPaymentStatus.PAID,
    endDate: { $gt: new Date() },
  });

  if (hasPaidSubscription) {
    return {
      ...trial,
      daysRemaining: 0,
      daysUsed: FREE_TRIAL_DAYS,
      isActive: false,
      isExpired: true,
      supersededBySubscription: true,
    };
  }

  return trial;
};

/** Marks free trial as ended when the user purchases a subscription. */
export const endFreeTrialForUser = async (userId: string): Promise<void> => {
  const expiredStart = new Date(Date.now() - (FREE_TRIAL_DAYS + 1) * MS_PER_DAY);
  await User.findByIdAndUpdate(userId, { $set: { freeTrialStartedAt: expiredStart } });
};
