import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../env';
import { handler, parseWith } from '../../lib/http';
import { clientKey, rateLimit, resetRateLimit } from '../../middleware/rateLimit';
import { requireAdmin } from '../../middleware/auth';
import {
  SESSION_COOKIE,
  clearSessionCookie,
  setCsrfCookie,
  setSessionCookie,
} from '../../middleware/security';
import { login, logout, changeOwnPassword, listAuditLogs } from './service';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Informe o e-mail.').max(160).email('E-mail invalido.'),
  password: z.string().min(1, 'Informe a senha.').max(200),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual.').max(200),
  newPassword: z
    .string()
    .min(8, 'A nova senha deve ter pelo menos 8 caracteres.')
    .max(200)
    .regex(/[A-Za-z]/, 'A nova senha deve conter letras.')
    .regex(/[0-9]/, 'A nova senha deve conter numeros.'),
});

export function authRouter(): Router {
  const router = Router();

  router.post(
    '/login',
    rateLimit({
      name: 'login',
      windowMs: 15 * 60 * 1000,
      max: 8,
      keyFn: (req) => `${clientKey(req)}|${String(req.body?.email || '').toLowerCase()}`,
      message: 'Muitas tentativas de login. Aguarde alguns minutos.',
    }),
    handler(async (req, res) => {
      const input = parseWith(loginSchema, req.body);
      const ip = clientKey(req);
      const result = await login(req.db, input, { ip });
      setSessionCookie(res, result.token);
      const csrfToken = setCsrfCookie(res);
      resetRateLimit('login', `${ip}|${input.email.toLowerCase()}`);
      res.json({ admin: result.admin, csrfToken });
    }),
  );

  router.post(
    '/logout',
    handler(async (req, res) => {
      const token = req.cookies?.[SESSION_COOKIE];
      if (token) {
        await logout(req.db, String(token), { ip: clientKey(req), admin: req.admin });
      }
      clearSessionCookie(res);
      res.json({ ok: true });
    }),
  );

  router.get(
    '/session',
    handler(async (req, res) => {
      // O cookie CSRF e emitido mesmo para visitantes nao autenticados,
      // permitindo o login com protecao double-submit.
      const csrfToken = setCsrfCookie(res);
      await new Promise<void>((resolve) => {
        requireAdmin()(req, res, (err?: unknown) => {
          if (err) {
            res.json({ authenticated: false, admin: null, csrfToken });
          } else {
            res.json({ authenticated: true, admin: req.admin, csrfToken });
          }
          resolve();
        });
      });
    }),
  );

  router.post(
    '/password',
    requireAdmin(),
    rateLimit({ name: 'password', windowMs: 15 * 60 * 1000, max: 5 }),
    handler(async (req, res) => {
      const input = parseWith(passwordSchema, req.body);
      if (!req.admin) return;
      await changeOwnPassword(req.db, req.admin, input);
      clearSessionCookie(res);
      res.json({ ok: true, message: 'Senha alterada. Faca login novamente.' });
    }),
  );

  router.get(
    '/audit',
    requireAdmin(),
    handler(async (req, res) => {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 30));
      const action = req.query.action ? String(req.query.action) : undefined;
      const result = await listAuditLogs(req.db, { page, pageSize, action });
      res.json({ ...result, page, pageSize });
    }),
  );

  void env;
  return router;
}
