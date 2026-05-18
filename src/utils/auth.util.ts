import { Request } from 'express';
import { AuthUser } from '../types/auth.types';
import { ApiError } from './ApiError';
import { MESSAGES } from '../constants/messages';

type RequestWithUser = Request & { user?: AuthUser };

export const setAuthUser = (req: Request, user: AuthUser): void => {
  (req as RequestWithUser).user = user;
};

export const getAuthUser = (req: Request): AuthUser => {
  const user = (req as RequestWithUser).user;

  if (!user) {
    throw new ApiError(401, MESSAGES.UNAUTHORIZED);
  }

  return user;
};

export const getAuthUserId = (req: Request): string => getAuthUser(req).id;
