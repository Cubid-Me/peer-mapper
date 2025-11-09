import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import pino from 'pino';

import { getEnv } from '../env';

export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
  };
}

let warnedMissingSecret = false;

export function requireAuth(logger: pino.Logger = pino({ name: 'require-auth' })) {
  return function enforceAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const env = getEnv();
    const jwtSecret = env.supabase.jwtSecret;

    if (!jwtSecret) {
      if (!warnedMissingSecret) {
        logger.warn('SUPABASE_JWT_SECRET not configured; skipping auth enforcement');
        warnedMissingSecret = true;
      }
      next();
      return;
    }

    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    try {
      const payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
      const userId = extractUserId(payload);
      if (!userId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      req.auth = { userId };
      next();
    } catch (error) {
      logger.debug({ err: error }, 'Supabase JWT verification failed');
      res.status(401).json({ error: 'unauthorized' });
    }
  };
}

function extractUserId(payload: jwt.JwtPayload): string | null {
  if (typeof payload.sub === 'string' && payload.sub.length > 0) {
    return payload.sub;
  }
  if (typeof payload.user_id === 'string' && payload.user_id.length > 0) {
    return payload.user_id;
  }
  return null;
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader === 'string') {
    const cookies = cookieHeader.split(';').map((value) => value.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith('sb-access-token=')) {
        return decodeURIComponent(cookie.slice('sb-access-token='.length));
      }
    }
  }

  return null;
}
