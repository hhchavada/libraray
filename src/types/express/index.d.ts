import type { AuthUser } from '../auth.types';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}
