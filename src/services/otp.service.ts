import bcrypt from 'bcrypt';
import { Otp } from '../models/otp.model';
import { OtpType } from '../constants/enums';
import { ENV } from '../config/env';
import { emailService } from './email.service';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import { logger } from '../utils/logger';

const LOG_TAG = 'OTP';

const generateOtpCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const getExpiryDate = (): Date => {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + ENV.OTP_EXPIRY_MINUTES);
  return expiresAt;
};

export const otpService = {
  async createAndSendOtp(email: string, type: OtpType) {
    const normalizedEmail = email.toLowerCase().trim();
    const otp = generateOtpCode();
    const expiresAt = getExpiryDate();

    logger.info(LOG_TAG, 'Creating OTP', {
      email: logger.maskEmail(normalizedEmail),
      type,
      expiresAt: expiresAt.toISOString(),
      expiryMinutes: ENV.OTP_EXPIRY_MINUTES,
    });

    try {
      const otpHash = await bcrypt.hash(otp, ENV.BCRYPT_SALT_ROUNDS);

      const invalidated = await Otp.updateMany(
        { email: normalizedEmail, type, isUsed: false },
        { isUsed: true }
      );

      logger.debug(LOG_TAG, 'Previous OTPs invalidated', {
        email: logger.maskEmail(normalizedEmail),
        count: invalidated.modifiedCount,
      });

      await Otp.create({
        email: normalizedEmail,
        otpHash,
        type,
        expiresAt,
      });

      logger.info(LOG_TAG, 'OTP saved to database', {
        email: logger.maskEmail(normalizedEmail),
        type,
      });

      const purpose = type === OtpType.EMAIL_VERIFICATION ? 'verification' : 'reset';

      await emailService.sendOtpEmail(normalizedEmail, otp, purpose);

      if (ENV.NODE_ENV === 'development') {
        logger.warn(LOG_TAG, 'DEV ONLY — OTP for testing (do not use in production)', {
          email: normalizedEmail,
          type,
          otp,
        });
      }

      logger.info(LOG_TAG, 'OTP flow completed successfully', {
        email: logger.maskEmail(normalizedEmail),
        type,
      });

      return { expiresAt };
    } catch (error) {
      logger.error(LOG_TAG, 'OTP create/send failed', {
        email: logger.maskEmail(normalizedEmail),
        type,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  },

  async verifyOtp(email: string, otp: string, type: OtpType): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();

    logger.info(LOG_TAG, 'Verifying OTP', {
      email: logger.maskEmail(normalizedEmail),
      type,
    });

    const otpRecord = await Otp.findOne({
      email: normalizedEmail,
      type,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    }).select('+otpHash');

    if (!otpRecord) {
      logger.warn(LOG_TAG, 'OTP not found or expired', {
        email: logger.maskEmail(normalizedEmail),
        type,
      });
      throw new ApiError(400, MESSAGES.OTP_INVALID);
    }

    const isValid = await bcrypt.compare(otp, otpRecord.otpHash);
    if (!isValid) {
      logger.warn(LOG_TAG, 'OTP mismatch', {
        email: logger.maskEmail(normalizedEmail),
        type,
      });
      throw new ApiError(400, MESSAGES.OTP_INVALID);
    }

    otpRecord.isUsed = true;
    await otpRecord.save();

    logger.info(LOG_TAG, 'OTP verified successfully', {
      email: logger.maskEmail(normalizedEmail),
      type,
    });

    return true;
  },
};
