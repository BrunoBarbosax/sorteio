import { Router } from 'express';
import { z } from 'zod';
import { handler, parseWith } from '../../lib/http';
import { clientKey, rateLimit } from '../../middleware/rateLimit';
import { requireAdmin } from '../../middleware/auth';
import { listParticipants } from '../participants/service';
import {
  DRAW_STYLES,
  MIN_DURATION_SECONDS,
  createDraw,
  executeDraw,
  exportDrawsCsv,
  getDrawDetail,
  listDraws,
} from './service';

const createSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do sorteio.').max(80),
  description: z.string().trim().max(400).optional().nullable(),
  winnerCount: z.coerce
    .number({ message: 'Informe a quantidade de ganhadores.' })
    .int('A quantidade deve ser um numero inteiro.')
    .min(1, 'Sorteie pelo menos 1 ganhador.')
    .max(1000, 'No maximo 1000 ganhadores por rodada.'),
  durationSeconds: z.coerce
    .number({ message: 'Informe a duracao da animacao.' })
    .int('A duracao deve ser um numero inteiro de segundos.')
    .min(MIN_DURATION_SECONDS, `A duracao minima da animacao e de ${MIN_DURATION_SECONDS} segundos.`)
    .max(3600, 'No maximo 3600 segundos.'),
  style: z.enum(DRAW_STYLES).default('classic'),
  soundEnabled: z.coerce.boolean().default(true),
  publicResults: z.coerce.boolean().default(true),
  publicShowIds: z.coerce.boolean().default(true),
  executeNow: z.coerce.boolean().default(false),
});

export function drawsRouter(): Router {
  const router = Router();

  /* Participantes disponiveis para montar a apresentacao (somente admin). */
  router.get(
    '/pool',
    requireAdmin(),
    handler(async (req, res) => {
      const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
      const result = await listParticipants(req.db, {
        status: 'active',
        page: 1,
        pageSize: limit,
        sort: 'created_at',
        order: 'asc',
      });
      res.json({
        items: result.items.map((p) => ({ name: p.name, externalId: p.external_id })),
        total: result.total,
      });
    }),
  );

  router.post(
    '/',
    requireAdmin(),
    rateLimit({ name: 'draw-create', windowMs: 60_000, max: 20 }),
    handler(async (req, res) => {
      if (!req.admin) return;
      const input = parseWith(createSchema, req.body);
      const result = await createDraw(
        req.db,
        {
          name: input.name,
          description: input.description || undefined,
          winnerCount: input.winnerCount,
          durationSeconds: input.durationSeconds,
          style: input.style,
          soundEnabled: input.soundEnabled,
          publicResults: input.publicResults,
          publicShowIds: input.publicShowIds,
          executeNow: input.executeNow,
        },
        req.admin,
        { ip: clientKey(req) },
      );

      res.status(result.executed ? 201 : 201).json({
        ok: true,
        executed: result.executed,
        draw: await getDrawDetail(req.db, result.draw.id),
      });
    }),
  );

  router.get(
    '/',
    requireAdmin(),
    handler(async (req, res) => {
      const params = {
        q: req.query.q ? String(req.query.q).slice(0, 80) : undefined,
        from: req.query.from ? String(req.query.from) : undefined,
        to: req.query.to ? String(req.query.to) : undefined,
        page: Math.max(1, Number(req.query.page) || 1),
        pageSize: Math.min(100, Math.max(1, Number(req.query.pageSize) || 20)),
      };
      const result = await listDraws(req.db, params);
      res.json({ items: result.items, total: result.total, page: params.page, pageSize: params.pageSize });
    }),
  );

  router.get(
    '/export.csv',
    requireAdmin(),
    handler(async (req, res) => {
      const csv = await exportDrawsCsv(req.db);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="historico-sorteios-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(`\uFEFF${csv}`);
    }),
  );

  router.get(
    '/:id',
    requireAdmin(),
    handler(async (req, res) => {
      const detail = await getDrawDetail(req.db, String(req.params.id));
      res.json({ draw: detail });
    }),
  );

  router.post(
    '/:id/execute',
    requireAdmin(),
    rateLimit({ name: 'draw-execute', windowMs: 60_000, max: 10 }),
    handler(async (req, res) => {
      if (!req.admin) return;
      const result = await executeDraw(req.db, String(req.params.id), req.admin, {
        ip: clientKey(req),
      });
      res.json({
        ok: true,
        draw: await getDrawDetail(req.db, result.draw.id),
        winners: result.winners.map((w) => ({
          name: w.name,
          externalId: w.external_id,
          position: w.position,
        })),
        visualPool: result.visualPool,
      });
    }),
  );

  return router;
}
