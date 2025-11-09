import type { NextFunction, Request, Response } from 'express';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';

import { getEnv } from '../env';

export interface RateLimitConfig {
  perSecond?: number;
  perDay?: number;
  keyGenerator?: (req: Request) => string;
}

export function createRateLimitMiddleware(config: RateLimitConfig = {}) {
  const env = getEnv();
  const perSecondLimit = config.perSecond ?? env.rateLimitPerSecond;
  const perDayLimit = config.perDay ?? env.rateLimitDaily;
  const keyGenerator = config.keyGenerator ?? ((req: Request) => req.ip ?? 'anonymous');

  const perSecondLimiter = new RateLimiterMemory({ points: perSecondLimit, duration: 1 });
  const perDayLimiter = new RateLimiterMemory({ points: perDayLimit, duration: 86_400 });

  return async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const key = keyGenerator(req);

    try {
      await Promise.all([perSecondLimiter.consume(key), perDayLimiter.consume(key)]);
      next();
    } catch (error) {
      if (error instanceof RateLimiterRes) {
        res.status(429).json({
          error: 'rate_limited',
          retryAfterSeconds: Math.ceil(error.msBeforeNext / 1000),
        });
        return;
      }

      next(error as Error);
    }
  };
}
