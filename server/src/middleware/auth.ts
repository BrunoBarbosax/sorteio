import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Db } from '../db';
import { forbidden, unauthorized } from '../lib/errors';
import { sha256, SESSION_COOKIE } from './security';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminUser;
      db: Db;
    }
  }
}

/** Middleware que injeta a conexao com o banco em cada requisicao. */
export function withDb(db: Db): RequestHandler {
  return (req, _res, next) => {
    req.db = db;
    next();
  };
}

/** Exige sessao administrativa valida (cookie httpOnly + registro no banco). */
export function requireAdmin(): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.[SESSION_COOKIE];
      if (!token) return next(unauthorized());

      const row = await req.db.get<{
        admin_id: string;
        expires_at: string;
        email: string;
        name: string;
        role: string;
      }>(
        `SELECT s.admin_id, s.expires_at, a.email, a.name, a.role
           FROM sessions s
           JOIN admins a ON a.id = s.admin_id
          WHERE s.token_hash = ?
          LIMIT 1`,
        [sha256(String(token))],
      );

      if (!row) return next(unauthorized());
      if (new Date(row.expires_at).getTime() <= Date.now()) {
        await req.db.run('DELETE FROM sessions WHERE token_hash = ?', [sha256(String(token))]);
        return next(unauthorized('Sessao expirada. Faca login novamente.'));
      }

      req.admin = {
        id: row.admin_id,
        email: row.email,
        name: row.name,
        role: row.role,
      };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

/** Acesso restrito a contas com papel administrativo. */
export function requireRole(...roles: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.admin) return next(unauthorized());
    if (!roles.includes(req.admin.role)) return next(forbidden('Permissao insuficiente.'));
    next();
  };
}
