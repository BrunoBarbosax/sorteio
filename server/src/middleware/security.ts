import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { env } from '../env';
import { forbidden } from '../lib/errors';

export const SESSION_COOKIE = 'gj_session';
export const CSRF_COOKIE = 'gj_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verificacao de origem para requisicoes que alteram dados.
 * Bloqueia chamadas cross-site; requisicoes sem cabecalho Origin
 * (ferramentas de linha de comando) continuam bloqueadas pelo SameSite do cookie.
 */
export function originCheck(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    const host = req.get('host');
    if (origin && host) {
      try {
        if (new URL(origin).host !== host) {
          return next(forbidden('Origem da requisicao invalida.'));
        }
      } catch {
        return next(forbidden('Origem da requisicao invalida.'));
      }
    }
    return next();
  };
}

/**
 * Protecao CSRF por double-submit token + verificacao de origem.
 * O token e devolvido no cookie `gj_csrf` (legivel pelo frontend) e deve ser
 * repetido no cabecalho `x-csrf-token` em toda requisicao administrativa.
 */
export function csrfProtection(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    const origin = req.get('origin');
    const host = req.get('host');
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return next(forbidden('Origem da requisicao invalida.'));
        }
      } catch {
        return next(forbidden('Origem da requisicao invalida.'));
      }
    }

    const cookieToken = req.cookies?.[CSRF_COOKIE];
    const headerToken = req.get(CSRF_HEADER) || '';
    if (!cookieToken || !headerToken || !safeEqual(String(cookieToken), headerToken)) {
      return next(forbidden('Token de seguranca invalido. Recarregue a pagina e tente novamente.'));
    }
    return next();
  };
}

export function setCsrfCookie(res: Response): string {
  const token = require('node:crypto').randomBytes(24).toString('base64url');
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/',
    maxAge: env.sessionTtlHours * 3600 * 1000,
  });
  return token;
}

export function clearCsrfCookie(res: Response): void {
  res.clearCookie(CSRF_COOKIE, { path: '/' });
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/',
    maxAge: env.sessionTtlHours * 3600 * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}
