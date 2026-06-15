export const MESSAGES = {
  // General
  ROUTE_NOT_FOUND: 'Route not found',
  LOCATIONS_FETCHED: 'Locations fetched successfully',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  VALIDATION_ERROR: 'Validation error',
  INVALID_MEMBER_ID: 'Invalid member id',
  INVALID_SEAT_ID: 'Invalid seat id',
  INVALID_SEAT_REFERENCE: 'Member has an invalid seat reference. Assign a seat again',
  FORBIDDEN: 'Access forbidden',

  // Auth
  USER_REGISTERED: 'User registered successfully',
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  TOKEN_REFRESHED: 'Access token refreshed successfully',
  TOKEN_EXPIRED: 'Token has expired',
  UNAUTHORIZED: 'Unauthorized access',
  INVALID_CREDENTIALS: 'Invalid email or password',
  DUPLICATE_EMAIL: 'Email already exists',
  DUPLICATE_MOBILE: 'Mobile number already exists',
  INVALID_REFRESH_TOKEN: 'Invalid refresh token',
  EMAIL_NOT_VERIFIED: 'Please verify your email with OTP before logging in',
  OTP_SENT: 'OTP sent to your email successfully',
  OTP_VERIFIED: 'OTP verified successfully',
  OTP_INVALID: 'Invalid or expired OTP',
  OTP_RESENT: 'OTP resent successfully',
  PASSWORD_RESET_SUCCESS: 'Password reset successfully',
  FORGOT_PASSWORD_OTP_VERIFIED: 'Forgot password OTP verified successfully',
  INVALID_RESET_TOKEN: 'Invalid or expired password reset token',
  FORGOT_PASSWORD_OTP_SENT: 'If the email exists, an OTP has been sent',
  EMAIL_ALREADY_VERIFIED: 'Email is already verified',
  SMTP_NOT_CONFIGURED: 'Email service is not configured',
  BREVO_NOT_CONFIGURED: 'Brevo API key is not configured',

  // User
  USER_NOT_FOUND: 'User not found',
  USER_INACTIVE: 'User account is inactive',

  // Library
  LIBRARY_CREATED: 'Library created successfully',
  LIBRARY_UPDATED: 'Library updated successfully',
  LIBRARY_NOT_FOUND: 'Library not found',
  LIBRARY_ALREADY_EXISTS: 'Library already exists for this owner',
  LIBRARY_FETCHED: 'Library fetched successfully',
  LIBRARY_STATS_FETCHED: 'Library stats fetched successfully',
  LIBRARY_QR_FETCHED: 'Library QR code fetched successfully',
  LIBRARY_QR_GENERATED: 'Library QR code generated successfully',
  LIBRARY_QR_NOT_FOUND: 'Library QR code image not found',
  SELECTED_SEATS_REQUIRED: 'Selected seats are required when custom seat map is enabled',
  INVALID_SELECTED_SEATS: 'Selected seats must be unique positive numbers',
  INVALID_SEAT_GRID: 'Invalid seat grid row/column. Both must be numbers between 0 and 25',
  DUPLICATE_SEAT_CELL: 'Two seats cannot use the same grid cell',
  SEAT_MAP_GRID_REQUIRED: 'seatMapRows and seatMapColumns are required for custom seat map',
  INVALID_QR_CODE: 'Invalid QR code',
  SCAN_LIBRARY_FETCHED: 'Library details fetched successfully',
  SCAN_REGISTRATION_SUCCESS: 'Student registered successfully via QR scan',

  // Member
  MEMBER_CREATED: 'Member created successfully',
  MEMBER_UPDATED: 'Member updated successfully',
  MEMBER_DELETED: 'Member deleted successfully',
  MEMBER_NOT_FOUND: 'Member not found',
  MEMBER_ID_GENERATED: 'Member ID generated successfully',
  MEMBERS_FETCHED: 'Members fetched successfully',
  MEMBER_FETCHED: 'Member fetched successfully',
  MEMBER_RENEWED: 'Member membership renewed successfully',
  MEMBER_RENEW_NOT_ALLOWED: 'Demo members cannot renew a membership plan',
  MEMBER_CONVERTED_TO_PERMANENT: 'Demo member converted to permanent successfully',
  MEMBER_CONVERT_NOT_DEMO: 'Only demo members can be converted to permanent',
  END_DATE_AFTER_START: 'endDate must be after member startDate',
  DISCOUNT_EXCEEDS_FEE: 'Discount cannot be greater than fee per month',
  INVALID_MEMBERSHIP_PLAN:
    'Invalid membership plan. Use: 1_month, 2_months, 3_months, 6_months, or 1_year',
  EXPIRED_MEMBERS_UPDATED: 'Expired members updated successfully',
  MEMBERS_EXPIRING_SOON_FETCHED: 'Expiring soon members fetched successfully',
  MEMBER_MARKED_AS_PAID: 'Payment recorded and due amount updated successfully',
  MEMBER_NO_DUE: 'Member has no due amount to pay',
  MEMBER_PAYMENT_EXCEEDS_DUE: 'Payment amount exceeds due amount',

  // Seat
  SEAT_NOT_AVAILABLE: 'Seat is not available',
  SEAT_ASSIGNED: 'Seat assigned successfully',
  SEAT_CHANGED: 'Seat changed successfully',
  MEMBER_ALREADY_HAS_SEAT: 'Member already has a seat assigned. Use change seat instead',
  MEMBER_HAS_NO_SEAT: 'Member does not have a seat to change',
  SAME_SEAT_SELECTED: 'Member is already assigned to this seat',
  SEAT_LIBRARY_MISMATCH: 'Seat does not belong to this library',
  SEAT_RELEASED: 'Seat released successfully',
  SEAT_ALREADY_BOOKED: 'Seat is already booked',
  SEAT_LOCKED: 'Seat locked successfully',
  SEATS_FETCHED: 'Seats fetched successfully',
  SEAT_NOT_FOUND: 'Seat not found',

  // Payment
  PAYMENT_RECORDED: 'Payment recorded successfully',
  DUE_CALCULATED: 'Due amount calculated successfully',

  // Dashboard
  DASHBOARD_STATS_FETCHED: 'Dashboard stats fetched successfully',

  // Admin
  ADMIN_DASHBOARD_FETCHED: 'Admin dashboard data fetched successfully',
  ADMIN_LIBRARY_FETCHED: 'Library details fetched successfully',
  ADMIN_ANALYTICS_FETCHED: 'Admin analytics fetched successfully',
  ADMIN_TRANSACTIONS_FETCHED: 'Admin transactions fetched successfully',
  ADMIN_EXPORT_GENERATED: 'Export generated successfully',
  MEMBER_IMPORT_COMPLETED: 'Member import completed',
  MEMBER_IMPORT_FILE_REQUIRED: 'Excel file is required',
  EXECUTIVE_CREATED: 'Sales executive created successfully',
  EXECUTIVES_FETCHED: 'Sales executives fetched successfully',

  // Revenue
  REVENUE_FETCHED: 'Revenue data fetched successfully',

  // Expense
  EXPENSE_CREATED: 'Expense created successfully',
  EXPENSE_UPDATED: 'Expense updated successfully',
  EXPENSE_DELETED: 'Expense deleted successfully',
  EXPENSE_NOT_FOUND: 'Expense not found',
  EXPENSE_FETCHED: 'Expense fetched successfully',
  EXPENSES_FETCHED: 'Expenses fetched successfully',
  EXPENSE_SUMMARY_FETCHED: 'Expense summary fetched successfully',

  // Report
  REPORT_GENERATED: 'Report generated successfully',
  REPORT_EXPORTED: 'Report exported successfully',

  // Subscription
  SUBSCRIPTION_ORDER_CREATED: 'Razorpay recurring subscription created successfully',
  SUBSCRIPTION_ACTIVATED: 'Subscription activated successfully',
  SUBSCRIPTION_CANCELLED: 'Subscription cancelled successfully',
  SUBSCRIPTION_NOT_FOUND: 'Subscription not found',
  SUBSCRIPTION_ORDER_NOT_FOUND: 'Subscription order not found',
  SUBSCRIPTION_REPLACE_CONFIRMATION_REQUIRED:
    'You already have an active subscription. Set confirmReplace to true to switch plans.',
  SUBSCRIPTION_ALREADY_RECURRING:
    'You already have an active auto-renewing subscription on this plan. Payment will be deducted automatically.',
  SUBSCRIPTION_PAYMENT_FAILED: 'Subscription payment failed',
  SUBSCRIPTION_INVALID_SIGNATURE: 'Invalid payment signature',
  SUBSCRIPTION_DUPLICATE_PAYMENT: 'This payment has already been processed',
  SUBSCRIPTION_PLANS_FETCHED: 'Subscription plans fetched successfully',
  SUBSCRIPTION_FETCHED: 'Subscription fetched successfully',
  SUBSCRIPTION_HISTORY_FETCHED: 'Subscription history fetched successfully',
  SUBSCRIPTION_PLAN_NOT_FOUND: 'Subscription plan not found',
  SUBSCRIPTION_PLAN_CREATED: 'Subscription plan created successfully',
  SUBSCRIPTION_PLAN_UPDATED: 'Subscription plan updated successfully',
  SUBSCRIPTION_PLAN_DISABLED: 'Subscription plan disabled successfully',
  SUBSCRIPTION_ADMIN_LIST_FETCHED: 'Subscriptions fetched successfully',
  RAZORPAY_NOT_CONFIGURED: 'Razorpay credentials are not configured',
};
