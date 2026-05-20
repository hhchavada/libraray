import nodemailer from 'nodemailer';
import { ENV } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import { logger } from '../utils/logger';

const LOG_TAG = 'EMAIL';

const hasBrevoApi = (): boolean => Boolean(ENV.BREVO_API_KEY?.trim());
const hasSmtp = (): boolean => Boolean(ENV.SMTP_USER?.trim() && ENV.SMTP_PASS?.trim());

const transporter = nodemailer.createTransport({
  host: ENV.SMTP_HOST,
  port: ENV.SMTP_PORT,
  secure: false,
  auth: {
    user: ENV.SMTP_USER,
    pass: ENV.SMTP_PASS,
  },
});

export const logEmailConfiguration = (): void => {
  logger.info(LOG_TAG, 'Email configuration check', {
    nodeEnv: ENV.NODE_ENV,
    brevoApiKey: logger.maskSecret(ENV.BREVO_API_KEY),
    brevoSenderEmail: ENV.BREVO_SENDER_EMAIL || 'NOT_SET',
    brevoSenderName: ENV.BREVO_SENDER_NAME,
    smtpHost: ENV.SMTP_HOST,
    smtpPort: ENV.SMTP_PORT,
    smtpUser: ENV.SMTP_USER ? logger.maskSecret(ENV.SMTP_USER) : 'NOT_SET',
    smtpPass: ENV.SMTP_PASS ? 'SET' : 'NOT_SET',
    smtpFrom: ENV.SMTP_FROM || 'NOT_SET',
    activeProvider: hasBrevoApi() ? 'BREVO_API' : hasSmtp() ? 'SMTP' : 'NONE',
  });

  if (!hasBrevoApi() && !hasSmtp()) {
    logger.error(LOG_TAG, 'No email provider configured! Set BREVO_API_KEY or SMTP_USER + SMTP_PASS in .env');
  }

  const sender = ENV.BREVO_SENDER_EMAIL?.trim() || '';
  if (sender.includes('@smtp-brevo.com')) {
    logger.error(
      LOG_TAG,
      'BREVO_SENDER_EMAIL must be your verified email (e.g. harshchavada174@gmail.com), NOT @smtp-brevo.com login'
    );
  }

  if (ENV.SMTP_USER?.includes('@gmail.com') && sender && !ENV.SMTP_USER.includes('@smtp-brevo.com')) {
    logger.warn(
      LOG_TAG,
      'SMTP_USER should be your Brevo SMTP login (xxx@smtp-brevo.com), not Gmail. Gmail is only for BREVO_SENDER_EMAIL / SMTP_FROM'
    );
  }
};

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
  logger.info(LOG_TAG, 'Sending via Brevo API', {
    to: logger.maskEmail(to),
    from: ENV.BREVO_SENDER_EMAIL,
    subject,
  });

  const payload = {
    sender: {
      name: ENV.BREVO_SENDER_NAME,
      email: ENV.BREVO_SENDER_EMAIL,
    },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    textContent: text,
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': ENV.BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();

  if (!response.ok) {
    let parsedError: unknown = responseText;
    try {
      parsedError = JSON.parse(responseText);
    } catch {
      // keep raw text
    }

    logger.error(LOG_TAG, 'Brevo API failed', {
      status: response.status,
      statusText: response.statusText,
      error: parsedError,
      hint:
        response.status === 401
          ? 'Invalid BREVO_API_KEY'
          : response.status === 400
            ? 'Check BREVO_SENDER_EMAIL is verified in Brevo dashboard'
            : 'See Brevo error above',
    });

    throw new ApiError(500, MESSAGES.INTERNAL_SERVER_ERROR);
  }

  let messageId: string | undefined;
  try {
    const body = JSON.parse(responseText) as { messageId?: string };
    messageId = body.messageId;
  } catch {
    messageId = undefined;
  }

  logger.info(LOG_TAG, 'Brevo API email sent successfully', {
    to: logger.maskEmail(to),
    messageId: messageId || 'unknown',
    status: response.status,
  });
};

const sendViaSmtp = async (
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<void> => {
  if (!hasSmtp()) {
    logger.error(LOG_TAG, 'SMTP credentials missing', {
      smtpUser: ENV.SMTP_USER ? 'SET' : 'NOT_SET',
      smtpPass: ENV.SMTP_PASS ? 'SET' : 'NOT_SET',
    });
    throw new ApiError(500, MESSAGES.SMTP_NOT_CONFIGURED);
  }

  logger.info(LOG_TAG, 'Sending via SMTP', {
    to: logger.maskEmail(to),
    host: ENV.SMTP_HOST,
    port: ENV.SMTP_PORT,
    from: ENV.SMTP_FROM,
    subject,
  });

  try {
    const info = await transporter.sendMail({
      from: ENV.SMTP_FROM,
      to,
      subject,
      text,
      html,
    });

    logger.info(LOG_TAG, 'SMTP email sent successfully', {
      to: logger.maskEmail(to),
      messageId: info.messageId,
      response: info.response,
    });
  } catch (error) {
    logger.error(LOG_TAG, 'SMTP send failed', {
      to: logger.maskEmail(to),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};

export const emailService = {
  logEmailConfiguration,

  async sendOtpEmail(to: string, otp: string, purpose: 'verification' | 'reset') {
    logger.info(LOG_TAG, 'OTP email request received', {
      to: logger.maskEmail(to),
      purpose,
      provider: hasBrevoApi() ? 'BREVO_API' : hasSmtp() ? 'SMTP' : 'NONE',
    });

    const { subject, text, html } = buildOtpContent(otp, purpose);

    try {
      if (hasBrevoApi()) {
        await sendViaBrevoApi(to, subject, html, text);
        return;
      }

      if (hasSmtp()) {
        await sendViaSmtp(to, subject, html, text);
        return;
      }

      logger.error(LOG_TAG, 'Cannot send OTP — no email provider configured');
      throw new ApiError(500, MESSAGES.BREVO_NOT_CONFIGURED);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error(LOG_TAG, 'Unexpected error while sending OTP email', {
        to: logger.maskEmail(to),
        purpose,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new ApiError(500, MESSAGES.INTERNAL_SERVER_ERROR);
    }
  },
};
