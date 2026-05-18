import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { UserRole } from '../constants/enums';

export interface TokenPayload {
  id: string;
  role: UserRole;
  email: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(
    { id: payload.id, role: payload.role, email: payload.email },
    ENV.ACCESS_TOKEN_SECRET,
    { expiresIn: ENV.ACCESS_TOKEN_EXPIRY as jwt.SignOptions['expiresIn'] }
  );
};

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ id: userId }, ENV.REFRESH_TOKEN_SECRET, {
    expiresIn: ENV.REFRESH_TOKEN_EXPIRY as jwt.SignOptions['expiresIn'],
  });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, ENV.ACCESS_TOKEN_SECRET) as TokenPayload;
};

export const verifyRefreshToken = (token: string): { id: string } => {
  return jwt.verify(token, ENV.REFRESH_TOKEN_SECRET) as { id: string };
};

export interface PasswordResetTokenPayload {
  id: string;
  email: string;
  purpose: 'password_reset';
}

export const generatePasswordResetToken = (userId: string, email: string): string => {
  return jwt.sign(
    { id: userId, email, purpose: 'password_reset' },
    ENV.ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' }
  );
};

export const verifyPasswordResetToken = (token: string): PasswordResetTokenPayload => {
  const decoded = jwt.verify(token, ENV.ACCESS_TOKEN_SECRET) as PasswordResetTokenPayload;

  if (decoded.purpose !== 'password_reset') {
    throw new jwt.JsonWebTokenError('Invalid token purpose');
  }

  return decoded;
};
