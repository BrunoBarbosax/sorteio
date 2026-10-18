import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { env } from '../env';
import { tooMany } from '../lib/errors';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const CLEANUP_MS = 60_000;

const timer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, CLEANUP_MS);
timer.unref?.();

export function clientKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Limitacao de requisicoes por janela fixa (em memoria).
 * Em producao multi-instancia recomenda-se um armazenamento compartilhado;
 * para uma unica instancia (cenario do projeto) isso e suficiente.
 */
export function rateLimit(options: {
  windowMs: number;
  max: number;
  name: string;
  keyFn?: (req: Request) => string;
  message?: string;
}): RequestHandler {
  const { windowMs, max, name, keyFn, message } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    if (env.rateLimitDisabled) return next();

    const key = `${name}:${keyFn ? keyFn(req) : clientKey(req)}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    const remaining = Math.max(0, max - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return next(tooMany(message));
    }
    return next();
  };
}

/** Zera o contador de um identificador (apos login valido, por exemplo). */
export function resetRateLimit(name: string, key: string): void {
  buckets.delete(`${name}:${key}`);
}

/** Somente para testes automatizados. */
export function clearRateLimits(): void {
  buckets.clear();
}
