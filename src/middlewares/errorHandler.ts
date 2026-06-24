import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { MESSAGES } from '../constants/messages';
import mongoose from 'mongoose';

export const errorHandler = (
  err: Error | ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let error: Error | ApiError = err;

  // Razorpay SDK errors: { statusCode, error: { description } }
  const rzErr = err as { statusCode?: number; error?: { description?: string } };
  if (rzErr.error?.description) {
    error = new ApiError(rzErr.statusCode ?? 400, rzErr.error.description);
  }

  // Mongoose validation error
  if (err instanceof mongoose.Error.ValidationError) {
    const message = Object.values(err.errors).map((val) => val.message).join(', ');
    error = new ApiError(400, message);
  }

  // Mongoose cast error (invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    const path = err.path ?? '';
    const message =
      path === 'seat'
        ? MESSAGES.INVALID_SEAT_REFERENCE
        : path
          ? `Invalid ${path}`
          : MESSAGES.VALIDATION_ERROR;
    error = new ApiError(400, message);
  }

  // Mongoose duplicate key error (code 11000)
  if ((err as any).code === 11000) {
    const keyPattern: Record<string, unknown> = (err as any).keyPattern || {};
    const fields = Object.keys(keyPattern);
    let message: string = MESSAGES.VALIDATION_ERROR;
    if (fields.includes('email')) {
      message = MESSAGES.DUPLICATE_EMAIL;
    } else if (fields.includes('mobileNumber')) {
      message = MESSAGES.DUPLICATE_MOBILE;
    } else if (fields.includes('memberId')) {
      message = 'Member ID conflict, please retry.';
    } else if (fields.includes('razorpayOrderId') || fields.includes('razorpaySubscriptionId')) {
      message = 'Subscription record conflict. Please retry or contact support.';
    }
    error = new ApiError(409, message);
  }

  // If error is not an ApiError, convert it
  if (!(error instanceof ApiError)) {
    const statusCode = (error as any).statusCode || 500;
    const message = error.message || MESSAGES.INTERNAL_SERVER_ERROR;
    error = new ApiError(statusCode, message);
  }

  const apiError = error as ApiError;
  const response = new ApiResponse(apiError.statusCode, apiError.message, null);
  res.status(apiError.statusCode).json(response);
};
