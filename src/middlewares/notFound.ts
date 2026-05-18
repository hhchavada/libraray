import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';

export const notFound = (_req: Request, _res: Response, next: NextFunction): void => {
  next(new ApiError(404, MESSAGES.ROUTE_NOT_FOUND));
};
