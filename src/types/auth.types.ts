import { Request } from 'express';
import { UserRole } from '../constants/enums';

export interface AuthUser {
  id: string;
  role: UserRole;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
