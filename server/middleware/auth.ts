import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    subscriptionTier: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'zity-chef-secret-key-change-in-production';

export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // If auth is optional or user is guest, assign anonymous guest ID
    req.user = {
      id: 'guest-user-00000000-0000-0000-0000-000000000000',
      email: 'guest@zitychef.mn',
      subscriptionTier: 'free',
    };
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      // Fallback to guest if token is invalid or expired
      req.user = {
        id: 'guest-user-00000000-0000-0000-0000-000000000000',
        email: 'guest@zitychef.mn',
        subscriptionTier: 'free',
      };
      return next();
    }
    req.user = decoded as AuthenticatedRequest['user'];
    next();
  });
}

export function generateToken(user: { id: string; email: string; subscriptionTier: string }) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}
