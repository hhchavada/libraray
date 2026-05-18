import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import { UserRole } from '../constants/enums';
import { verifyAccessToken } from '../utils/token';
import { getAuthUser, setAuthUser } from '../utils/auth.util';

export const protect = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new ApiError(401, MESSAGES.UNAUTHORIZED));
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    setAuthUser(req, {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email,
    });
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new ApiError(401, MESSAGES.TOKEN_EXPIRED));
      return;
    }
    next(new ApiError(401, MESSAGES.UNAUTHORIZED));
  }
};

export const authorizeRoles =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const user = getAuthUser(req);
    if (!roles.includes(user.role)) {
      next(new ApiError(403, MESSAGES.FORBIDDEN));
      return;
    }
    next();
  };
