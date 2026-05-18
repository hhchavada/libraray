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

  // Mongoose validation error
  if (err instanceof mongoose.Error.ValidationError) {
    const message = Object.values(err.errors).map((val) => val.message).join(', ');
    error = new ApiError(400, message);
  }

  // Mongoose cast error (invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    error = new ApiError(400, MESSAGES.VALIDATION_ERROR);
  }

  // Mongoose duplicate key error (code 11000)
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyPattern)[0];
    let message: string = MESSAGES.VALIDATION_ERROR;
    if (field === 'email') {
      message = MESSAGES.DUPLICATE_EMAIL;
    } else if (field === 'mobileNumber') {
      message = MESSAGES.DUPLICATE_MOBILE;
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
