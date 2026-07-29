import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../supabase.js';

export const GUEST_ID = 'guest-user-00000000-0000-0000-0000-000000000000';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    subscriptionTier: string;
    isAnonymous?: boolean;
  };
  /** Raw Supabase access token, forwarded to RLS-scoped DB clients. */
  accessToken?: string;
}

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';

function assignGuest(req: AuthenticatedRequest) {
  req.user = {
    id: GUEST_ID,
    email: 'guest@zitychef.mn',
    subscriptionTier: 'free',
    isAnonymous: true,
  };
  req.accessToken = undefined;
}

/**
 * Authenticates a request using its Supabase access token.
 *
 * Verification strategy (first available wins):
 *   1. Local HS256 verify with SUPABASE_JWT_SECRET (fast, no network) — the
 *      default for Supabase projects using the shared JWT secret.
 *   2. Remote validation via supabaseAdmin.auth.getUser(token).
 *
 * If no token is present, or it cannot be verified, the request is treated as
 * an anonymous guest (data is served from the in-memory fallback store, never
 * from another user's rows).
 */
export async function authenticateToken(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    assignGuest(req);
    return next();
  }

  // 1️⃣ Local verification with the project JWT secret.
  if (SUPABASE_JWT_SECRET) {
    try {
      const payload = jwt.verify(token, SUPABASE_JWT_SECRET) as jwt.JwtPayload;
      if (payload.sub) {
        req.user = {
          id: payload.sub,
          email: (payload.email as string) || '',
          subscriptionTier: 'free',
          isAnonymous: payload.is_anonymous === true || payload.role === 'anon',
        };
        req.accessToken = token;
        return next();
      }
    } catch {
      // fall through to remote validation / guest
    }
  }

  // 2️⃣ Remote validation via Supabase Auth.
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data.user) {
        req.user = {
          id: data.user.id,
          email: data.user.email || '',
          subscriptionTier: 'free',
          isAnonymous: data.user.is_anonymous === true,
        };
        req.accessToken = token;
        return next();
      }
    } catch {
      // fall through to guest
    }
  }

  assignGuest(req);
  return next();
}
