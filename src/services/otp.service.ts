import bcrypt from 'bcrypt';
import { Otp } from '../models/otp.model';
import { OtpType } from '../constants/enums';
import { ENV } from '../config/env';
import { emailService } from './email.service';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';

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
    const otpHash = await bcrypt.hash(otp, ENV.BCRYPT_SALT_ROUNDS);
    const expiresAt = getExpiryDate();

    await Otp.updateMany(
      { email: normalizedEmail, type, isUsed: false },
      { isUsed: true }
    );

    await Otp.create({
      email: normalizedEmail,
      otpHash,
      type,
      expiresAt,
    });

    const purpose = type === OtpType.EMAIL_VERIFICATION ? 'verification' : 'reset';
    await emailService.sendOtpEmail(normalizedEmail, otp, purpose);

    return { expiresAt };
  },

  async verifyOtp(email: string, otp: string, type: OtpType): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();

    const otpRecord = await Otp.findOne({
      email: normalizedEmail,
      type,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    }).select('+otpHash');

    if (!otpRecord) {
      throw new ApiError(400, MESSAGES.OTP_INVALID);
    }

    const isValid = await bcrypt.compare(otp, otpRecord.otpHash);
    if (!isValid) {
      throw new ApiError(400, MESSAGES.OTP_INVALID);
    }

    otpRecord.isUsed = true;
    await otpRecord.save();

    return true;
  },
};
