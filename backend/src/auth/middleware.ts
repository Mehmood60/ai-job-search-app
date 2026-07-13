import { NextFunction, Request, Response } from 'express';
import { AppError } from '../http/errors';
import { verifyToken } from './service';

// Augment Express Request with the authenticated user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'Missing bearer token', 'NO_TOKEN');
  }
  const { userId, email } = verifyToken(token);
  req.userId = userId;
  req.userEmail = email;
  next();
}
