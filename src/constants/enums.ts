export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
}

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  LIBRARY_OWNER = 'library_owner',
}

export enum MemberType {
  PERMANENT = 'permanent',
  DEMO = 'demo',
  WITHOUT_SEAT = 'without_seat',
}

export enum MemberStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  INACTIVE = 'inactive',
}

export enum ShiftType {
  MORNING = 'morning',
  EVENING = 'evening',
  FULL_DAY = 'full_day',
}

export enum SeatStatus {
  AVAILABLE = 'available',
  BOOKED = 'booked',
  LOCKED = 'locked',
}

export enum PaymentStatus {
  PAID = 'paid',
  PARTIAL = 'partial',
  UNPAID = 'unpaid',
}

export enum PaymentMode {
  CASH = 'cash',
  ONLINE = 'online',
  UPI = 'upi',
}

export enum MembershipPlan {
  ONE_MONTH = '1_month',
  TWO_MONTHS = '2_months',
  THREE_MONTHS = '3_months',
  SIX_MONTHS = '6_months',
  ONE_YEAR = '1_year',
}

/** Months multiplier for totalFee = feesAfterDiscount × months */
export const MEMBERSHIP_PLAN_MONTHS: Record<MembershipPlan, number> = {
  [MembershipPlan.ONE_MONTH]: 1,
  [MembershipPlan.TWO_MONTHS]: 2,
  [MembershipPlan.THREE_MONTHS]: 3,
  [MembershipPlan.SIX_MONTHS]: 6,
  [MembershipPlan.ONE_YEAR]: 12,
};

const MEMBERSHIP_PLAN_ALIASES: Record<string, MembershipPlan> = {
  '1_month': MembershipPlan.ONE_MONTH,
  '1_months': MembershipPlan.ONE_MONTH,
  '1month': MembershipPlan.ONE_MONTH,
  '2_months': MembershipPlan.TWO_MONTHS,
  '2_month': MembershipPlan.TWO_MONTHS,
  '2months': MembershipPlan.TWO_MONTHS,
  '3_months': MembershipPlan.THREE_MONTHS,
  '3_month': MembershipPlan.THREE_MONTHS,
  '3months': MembershipPlan.THREE_MONTHS,
  '6_months': MembershipPlan.SIX_MONTHS,
  '6_month': MembershipPlan.SIX_MONTHS,
  '6months': MembershipPlan.SIX_MONTHS,
  '1_year': MembershipPlan.ONE_YEAR,
  '1_years': MembershipPlan.ONE_YEAR,
  '1year': MembershipPlan.ONE_YEAR,
  // Excel / display labels
  '1-month': MembershipPlan.ONE_MONTH,
  '2-months': MembershipPlan.TWO_MONTHS,
  '2-month': MembershipPlan.TWO_MONTHS,
  '3-months': MembershipPlan.THREE_MONTHS,
  '3-month': MembershipPlan.THREE_MONTHS,
  '6-months': MembershipPlan.SIX_MONTHS,
  '6-month': MembershipPlan.SIX_MONTHS,
  '1-year': MembershipPlan.ONE_YEAR,
  monthly: MembershipPlan.ONE_MONTH,
  '2 months': MembershipPlan.TWO_MONTHS,
  quarterly: MembershipPlan.THREE_MONTHS,
  half_yearly: MembershipPlan.SIX_MONTHS,
  halfyearly: MembershipPlan.SIX_MONTHS,
  'half-yearly': MembershipPlan.SIX_MONTHS,
  'half yearly': MembershipPlan.SIX_MONTHS,
  yearly: MembershipPlan.ONE_YEAR,
};

export const normalizeMembershipPlan = (value: string): MembershipPlan | null => {
  const trimmed = value.trim().toLowerCase();
  if (MEMBERSHIP_PLAN_ALIASES[trimmed]) {
    return MEMBERSHIP_PLAN_ALIASES[trimmed];
  }

  const key = trimmed.replace(/\s+/g, '_').replace(/-/g, '_');
  if (MEMBERSHIP_PLAN_ALIASES[key]) {
    return MEMBERSHIP_PLAN_ALIASES[key];
  }
  if (Object.values(MembershipPlan).includes(key as MembershipPlan)) {
    return key as MembershipPlan;
  }
  return null;
};

export enum ExpenseCategory {
  RENT = 'rent',
  ELECTRICITY = 'electricity',
  INTERNET = 'internet',
  MAINTENANCE = 'maintenance',
  SALARY = 'salary',
  OTHER = 'other',
}

export enum ReportType {
  ALL = 'all',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
}

export enum ReportSortOrder {
  OLDEST_FIRST = 'oldest_first',
  NEWEST_FIRST = 'newest_first',
}

/** Library seat-tier for SaaS subscription plans. */
export enum PlanCategory {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  MEGA = 'mega',
}

export enum PlanDurationType {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  HALF_YEARLY = 'half_yearly',
  YEARLY = 'yearly',
}

export enum LibrarySubscriptionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum SubscriptionPaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
}

export enum RevenueDateFilter {
  TODAY = 'today',
  THIS_WEEK = 'this_week',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
}

export enum AdminDateFilter {
  TODAY = 'today',
  THIS_WEEK = 'this_week',
  THIS_MONTH = 'this_month',
  THIS_YEAR = 'this_year',
  CUSTOM_RANGE = 'custom_range',
}

export enum LibraryLifecycleStatus {
  DEMO = 'demo',
  ACTIVE = 'active',
  GRACE_PERIOD = 'grace_period',
  TERMINATED = 'terminated',
}

export enum OtpType {
  EMAIL_VERIFICATION = 'email_verification',
  FORGOT_PASSWORD = 'forgot_password',
}
