import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { MESSAGES } from '../constants/messages';
import { ENV } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { getAuthUserId } from '../utils/auth.util';

const REFRESH_TOKEN_COOKIE = 'refreshToken';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.registerUser(req.body);
    res.status(201).json(
      new ApiResponse(201, MESSAGES.USER_REGISTERED, {
        user,
        message: MESSAGES.OTP_SENT,
      })
    );
  }),

  verifyEmail: asyncHandler(async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    const user = await authService.verifyEmail(email, otp);
    res.status(200).json(new ApiResponse(200, MESSAGES.OTP_VERIFIED, user));
  }),

  resendVerificationOtp: asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    await authService.resendVerificationOtp(email);
    res.status(200).json(new ApiResponse(200, MESSAGES.OTP_RESENT, null));
  }),

  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    res.status(200).json(new ApiResponse(200, MESSAGES.OTP_SENT, result));
  }),

  verifyForgotPasswordOtp: asyncHandler(async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    const result = await authService.verifyForgotPasswordOtp(email, otp);
    res.status(200).json(new ApiResponse(200, MESSAGES.FORGOT_PASSWORD_OTP_VERIFIED, result));
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const { resetToken, password } = req.body;
    const user = await authService.resetPassword(resetToken, password);
    res.status(200).json(new ApiResponse(200, MESSAGES.PASSWORD_RESET_SUCCESS, user));
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await authService.loginUser(email, password);

    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure: ENV.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: COOKIE_MAX_AGE,
    });

    res.status(200).json(new ApiResponse(200, MESSAGES.LOGIN_SUCCESS, { user, accessToken }));
  }),

  refreshToken: asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.refreshToken || req.body.refreshToken;

    if (!token) {
      throw new ApiError(401, MESSAGES.INVALID_REFRESH_TOKEN);
    }

    const { accessToken } = await authService.refreshAccessToken(token);
    res.status(200).json(new ApiResponse(200, MESSAGES.TOKEN_REFRESHED, { accessToken }));
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    await authService.logoutUser(getAuthUserId(req));

    res.clearCookie(REFRESH_TOKEN_COOKIE);
    res.status(200).json(new ApiResponse(200, MESSAGES.LOGOUT_SUCCESS, null));
  }),
};
