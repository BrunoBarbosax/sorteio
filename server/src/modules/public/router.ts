import { Router } from 'express';
import { env } from '../../env';
import { handler } from '../../lib/http';
import { rateLimit } from '../../middleware/rateLimit';
import { countActiveParticipants, formatBr } from '../participants/service';
import { getPublicDraw, listPublicDraws } from '../draws/service';

/**
 * Rotas publicas: cadastro, consulta de status e resultados dos sorteios.
 * Nenhuma listagem completa de participantes e exposta publicamente.
 */
export function publicRouter(): Router {
  const router = Router();

  router.get(
    '/info',
    handler(async (req, res) => {
      const participantCount = await countActiveParticipants(req.db);
      const draws = await listPublicDraws(req.db, 1);
      const pending = await req.db.get<{ count: number }>(
        "SELECT COUNT(*) AS count FROM draws WHERE status = 'pending'",
      );
      res.json({
        branding: 'Gorjeta 77 Lukas',
        participantCount,
        pendingDraws: Number(pending?.count || 0),
        lastResult: draws[0] || null,
        serverTime: formatBr(new Date().toISOString()),
        publicOrigin: env.publicOrigin || '',
      });
    }),
  );

  router.get(
    '/draws',
    rateLimit({ name: 'public-draws', windowMs: 60_000, max: 60 }),
    handler(async (req, res) => {
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
      const items = await listPublicDraws(req.db, limit);
      res.json({ items });
    }),
  );

  router.get(
    '/draws/:slug',
    rateLimit({ name: 'public-draw', windowMs: 60_000, max: 120 }),
    handler(async (req, res) => {
      const draw = await getPublicDraw(req.db, String(req.params.slug));
      res.json({ draw });
    }),
  );

  return router;
}
