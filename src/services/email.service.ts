import nodemailer from 'nodemailer';
import { ENV } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';

const transporter = nodemailer.createTransport({
  host: ENV.SMTP_HOST,
  port: ENV.SMTP_PORT,
  secure: false,
  auth: {
    user: ENV.SMTP_USER,
    pass: ENV.SMTP_PASS,
  },
});

const buildOtpContent = (otp: string, purpose: 'verification' | 'reset') => {
  const isVerification = purpose === 'verification';
  const subject = isVerification
    ? 'Verify your email - Library Management System'
    : 'Reset your password - Library Management System';

  const title = isVerification ? 'Email Verification' : 'Password Reset';
  const description = isVerification
    ? 'Thank you for registering. Use the OTP below to verify your email:'
    : 'You requested to reset your password. Use the OTP below:';

  const text = isVerification
    ? `Your email verification OTP is: ${otp}. Valid for ${ENV.OTP_EXPIRY_MINUTES} minutes.`
    : `Your password reset OTP is: ${otp}. Valid for ${ENV.OTP_EXPIRY_MINUTES} minutes.`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #2563EB;">${title}</h2>
      <p>${description}</p>
      <div style="background: #f3f4f6; padding: 16px; text-align: center; font-size: 28px; letter-spacing: 8px; font-weight: bold; color: #2563EB;">
        ${otp}
      </div>
      <p style="color: #6b7280; font-size: 14px;">This OTP expires in ${ENV.OTP_EXPIRY_MINUTES} minutes.</p>
    </div>
  `;

  return { subject, text, html };
};

const sendViaBrevoApi = async (
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<void> => {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': ENV.BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: ENV.BREVO_SENDER_NAME,
        email: ENV.BREVO_SENDER_EMAIL,
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Brevo API error:', errorBody);
    throw new ApiError(500, MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const sendViaSmtp = async (
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<void> => {
  if (!ENV.SMTP_USER || !ENV.SMTP_PASS) {
    throw new ApiError(500, MESSAGES.SMTP_NOT_CONFIGURED);
  }

  await transporter.sendMail({
    from: ENV.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
};

export const emailService = {
  async sendOtpEmail(to: string, otp: string, purpose: 'verification' | 'reset') {
    const { subject, text, html } = buildOtpContent(otp, purpose);

    if (ENV.BREVO_API_KEY) {
      await sendViaBrevoApi(to, subject, html, text);
      return;
    }

    if (ENV.SMTP_USER && ENV.SMTP_PASS) {
      await sendViaSmtp(to, subject, html, text);
      return;
    }

    throw new ApiError(500, MESSAGES.BREVO_NOT_CONFIGURED);
  },
};
