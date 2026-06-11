import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, IUserDocument } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import { ENV } from '../config/env';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generatePasswordResetToken,
  verifyPasswordResetToken,
} from '../utils/token';
import { UserRole, OtpType } from '../constants/enums';
import { otpService } from './otp.service';
import { logger } from '../utils/logger';
import { buildFreeTrialInfo } from '../utils/freeTrial.util';

const LOG_TAG = 'AUTH';

export interface RegisterUserData {
  fullName: string;
  email: string;
  mobileNumber: string;
  password: string;
}

const sanitizeUser = (user: IUserDocument) => {
  const userObj = user.toObject();
  delete userObj.password;
  delete userObj.refreshToken;
  userObj.freeTrial = buildFreeTrialInfo(userObj.freeTrialStartedAt, userObj.createdAt);
  return userObj;
};

const issueAuthTokens = async (user: IUserDocument) => {
  if (!user.isActive) {
    throw new ApiError(403, MESSAGES.USER_INACTIVE);
  }

  const accessToken = generateAccessToken({
    id: user._id.toString(),
    role: user.role,
    email: user.email,
  });

  const refreshToken = generateRefreshToken(user._id.toString());

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
};

export const authService = {
  async registerUser(data: RegisterUserData) {
    const existingEmail = await User.findOne({ email: data.email.toLowerCase() });
    if (existingEmail) {
      throw new ApiError(409, MESSAGES.DUPLICATE_EMAIL);
    }

    const existingMobile = await User.findOne({ mobileNumber: data.mobileNumber });
    if (existingMobile) {
      throw new ApiError(409, MESSAGES.DUPLICATE_MOBILE);
    }

    const hashedPassword = await bcrypt.hash(data.password, ENV.BCRYPT_SALT_ROUNDS);

    const user = await User.create({
      fullName: data.fullName,
      email: data.email,
      mobileNumber: data.mobileNumber,
      password: hashedPassword,
      role: UserRole.LIBRARY_OWNER,
      isEmailVerified: false,
      freeTrialStartedAt: new Date(),
    });

    logger.info(LOG_TAG, 'Register success — sending verification OTP', {
      email: logger.maskEmail(user.email),
    });

    await otpService.createAndSendOtp(user.email, OtpType.EMAIL_VERIFICATION);

    return sanitizeUser(user);
  },

  async verifyEmail(email: string, otp: string) {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+refreshToken');
    if (!user) {
      throw new ApiError(404, MESSAGES.USER_NOT_FOUND);
    }

    if (!user.isEmailVerified) {
      await otpService.verifyOtp(email, otp, OtpType.EMAIL_VERIFICATION);
      user.isEmailVerified = true;
      await user.save();
    }

    return issueAuthTokens(user);
  },

  async resendVerificationOtp(email: string) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new ApiError(404, MESSAGES.USER_NOT_FOUND);
    }

    if (user.isEmailVerified) {
      throw new ApiError(400, MESSAGES.EMAIL_ALREADY_VERIFIED);
    }

    logger.info(LOG_TAG, 'Resend verification OTP requested', {
      email: logger.maskEmail(user.email),
    });

    await otpService.createAndSendOtp(user.email, OtpType.EMAIL_VERIFICATION);
  },

  async forgotPassword(email: string) {
    const normalizedEmail = email.toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    logger.info(LOG_TAG, 'Forgot password requested', {
      email: logger.maskEmail(normalizedEmail),
      userFound: Boolean(user),
    });

    if (user) {
      await otpService.createAndSendOtp(user.email, OtpType.FORGOT_PASSWORD);
    }

    return { message: MESSAGES.FORGOT_PASSWORD_OTP_SENT };
  },

  async verifyForgotPasswordOtp(email: string, otp: string) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new ApiError(404, MESSAGES.USER_NOT_FOUND);
    }

    await otpService.verifyOtp(email, otp, OtpType.FORGOT_PASSWORD);

    const resetToken = generatePasswordResetToken(user._id.toString(), user.email);

    return { resetToken };
  },

  async resetPassword(resetToken: string, newPassword: string) {
    try {
      const decoded = verifyPasswordResetToken(resetToken);

      const user = await User.findById(decoded.id).select('+password');
      if (!user || user.email !== decoded.email) {
        throw new ApiError(404, MESSAGES.USER_NOT_FOUND);
      }

      user.password = await bcrypt.hash(newPassword, ENV.BCRYPT_SALT_ROUNDS);
      await user.save();

      return sanitizeUser(user);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(401, MESSAGES.TOKEN_EXPIRED);
      }
      throw new ApiError(401, MESSAGES.INVALID_RESET_TOKEN);
    }
  },

  async loginUser(email: string, password: string) {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password +refreshToken');

    if (!user) {
      throw new ApiError(401, MESSAGES.INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      throw new ApiError(403, MESSAGES.USER_INACTIVE);
    }

    if (!user.isEmailVerified && user.role !== UserRole.SUPER_ADMIN) {
      throw new ApiError(403, MESSAGES.EMAIL_NOT_VERIFIED);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new ApiError(401, MESSAGES.INVALID_CREDENTIALS);
    }

    return issueAuthTokens(user);
  },

  async refreshAccessToken(refreshToken: string) {
    try {
      const decoded = verifyRefreshToken(refreshToken);

      const user = await User.findById(decoded.id).select('+refreshToken');
      if (!user || user.refreshToken !== refreshToken) {
        throw new ApiError(401, MESSAGES.INVALID_REFRESH_TOKEN);
      }

      if (!user.isActive) {
        throw new ApiError(403, MESSAGES.USER_INACTIVE);
      }

      const accessToken = generateAccessToken({
        id: user._id.toString(),
        role: user.role,
        email: user.email,
      });

      return { accessToken };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(401, MESSAGES.TOKEN_EXPIRED);
      }
      throw new ApiError(401, MESSAGES.INVALID_REFRESH_TOKEN);
    }
  },

  async logoutUser(userId: string) {
    await User.findByIdAndUpdate(userId, { $unset: { refreshToken: 1 } });
  },
};
