import 'dotenv/config';

export const ENV = {
  PORT: process.env.PORT || '5000',
  MONGO_URI: process.env.MONGO_URI!,
  NODE_ENV: process.env.NODE_ENV || 'development',
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET!,
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET!,
  ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  BCRYPT_SALT_ROUNDS: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID!,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET!,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET!,
  BREVO_API_KEY: process.env.BREVO_API_KEY!,
  BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL || process.env.SMTP_FROM!,
  BREVO_SENDER_NAME: process.env.BREVO_SENDER_NAME || 'Library Management System',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || process.env.BREVO_SENDER_EMAIL || '',
  OTP_EXPIRY_MINUTES: Number(process.env.OTP_EXPIRY_MINUTES) || 10,
  APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:5000',
  LIBRARY_QR_BASE_URL:
    process.env.LIBRARY_QR_BASE_URL ||
    `${process.env.APP_BASE_URL || 'http://localhost:5000'}/scan`,
  /** Redirect after Razorpay Payment Link checkout (optional). */
  RAZORPAY_PAYMENT_CALLBACK_URL:
    process.env.RAZORPAY_PAYMENT_CALLBACK_URL ||
    `${process.env.APP_BASE_URL || 'http://localhost:5000'}/api/v1/subscription/payment-callback`,
  /** Cloudinary configuration for image storage */
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME!,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY!,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET!,
};
