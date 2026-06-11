import { User } from '../models/user.model';

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
  return buildFreeTrialInfo(user.freeTrialStartedAt, user.createdAt);
};
