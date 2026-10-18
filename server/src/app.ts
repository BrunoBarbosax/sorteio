import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import type { Db } from './db';
import { env } from './env';
import { withDb, requireAdmin } from './middleware/auth';
import { csrfProtection, originCheck } from './middleware/security';
import { errorHandler, notFoundHandler } from './middleware/error';
import { rateLimit } from './middleware/rateLimit';
import { authRouter } from './modules/auth/router';
import { adminRouter } from './modules/admin/router';
import { participantsAdminRouter, participantsPublicRouter } from './modules/participants/router';
import { drawsRouter } from './modules/draws/router';
import { publicRouter } from './modules/public/router';

export function createApp(db: Db): express.Express {
  const app = express();

  app.set('trust proxy', env.trustProxy ? 1 : false);
  app.disable('x-powered-by');

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          // O frontend utiliza estilos inline (animacoes) e a folha de fontes do Google.
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(withDb(db));
  app.use(originCheck());

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, service: 'gorjeta77-lukas', time: new Date().toISOString() });
  });

  // Verificacao de banco de dados para monitoramento da hospedagem.
  app.get(
    '/healthz/db',
    requireAdmin(),
    (async (req: express.Request, res: express.Response) => {
      const row = await req.db.get<{ count: number }>('SELECT COUNT(*) AS count FROM participants');
      res.json({ ok: true, participants: Number(row?.count || 0) });
    }) as unknown as express.RequestHandler,
  );

  app.use(
    '/api/auth',
    csrfProtection(),
    rateLimit({ name: 'auth-global', windowMs: 60_000, max: 60 }),
    authRouter(),
  );

  const adminProtection = [
    csrfProtection(),
    rateLimit({ name: 'admin-global', windowMs: 60_000, max: 400 }),
  ];
  app.use('/api/admin', ...adminProtection, adminRouter());
  app.use('/api/admin/participants', ...adminProtection, participantsAdminRouter());
  app.use('/api/admin/draws', ...adminProtection, drawsRouter());

  app.use(
    '/api/public',
    rateLimit({ name: 'public-global', windowMs: 60_000, max: 300 }),
    participantsPublicRouter(),
    publicRouter(),
  );

  app.use('/api', notFoundHandler);

  // Producao: serve o frontend compilado (web/dist) pelo mesmo processo.
  const webDist = path.resolve(__dirname, '../../web/dist');
  if (fs.existsSync(webDist)) {
    app.use(
      express.static(webDist, {
        index: false,
        maxAge: env.isProduction ? '7d' : 0,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
