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
  // legacy values
  monthly: MembershipPlan.ONE_MONTH,
  quarterly: MembershipPlan.THREE_MONTHS,
  half_yearly: MembershipPlan.SIX_MONTHS,
  yearly: MembershipPlan.ONE_YEAR,
};

export const normalizeMembershipPlan = (value: string): MembershipPlan | null => {
  const key = value.trim().toLowerCase().replace(/\s+/g, '_');
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
}

export enum OtpType {
  EMAIL_VERIFICATION = 'email_verification',
  FORGOT_PASSWORD = 'forgot_password',
}
