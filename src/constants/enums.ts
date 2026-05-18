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
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  HALF_YEARLY = 'half_yearly',
  YEARLY = 'yearly',
}

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

export enum SubscriptionPlanType {
  BASIC = 'basic',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum SubscriptionStatus {
  CREATED = 'created',
  AUTHENTICATED = 'authenticated',
  ACTIVE = 'active',
  PENDING = 'pending',
  HALTED = 'halted',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
}

export enum RazorpayWebhookEvent {
  SUBSCRIPTION_ACTIVATED = 'subscription.activated',
  SUBSCRIPTION_CHARGED = 'subscription.charged',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  SUBSCRIPTION_HALTED = 'subscription.halted',
  SUBSCRIPTION_COMPLETED = 'subscription.completed',
  PAYMENT_CAPTURED = 'payment.captured',
  PAYMENT_FAILED = 'payment.failed',
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
