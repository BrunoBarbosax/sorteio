import { Router } from 'express';
import { z } from 'zod';
import { handler, parseWith } from '../../lib/http';
import { clientKey, rateLimit } from '../../middleware/rateLimit';
import { requireAdmin } from '../../middleware/auth';
import {
  exportParticipantsCsv,
  formatBr,
  getParticipantStatus,
  listParticipants,
  registerParticipant,
  removeParticipant,
  updateParticipant,
} from './service';

const registerSchema = z.object({
  name: z.string().min(1, 'Informe o seu nome.').max(120),
  externalId: z.string().min(1, 'Informe o seu ID.').max(60),
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  externalId: z.string().min(1).max(60).optional(),
  status: z.enum(['active', 'removed']).optional(),
});

/** Rotas publicas de cadastro e consulta de status. */
export function participantsPublicRouter(): Router {
  const router = Router();

  router.post(
    '/participants',
    rateLimit({
      name: 'register',
      windowMs: 10 * 60 * 1000,
      max: 5,
      message: 'Muitos cadastros a partir deste dispositivo. Aguarde alguns minutos.',
    }),
    rateLimit({ name: 'register-hour', windowMs: 60 * 60 * 1000, max: 20 }),
    handler(async (req, res) => {
      const input = parseWith(registerSchema, req.body);
      const participant = await registerParticipant(req.db, input, { ip: clientKey(req) });
      res.status(201).json({
        ok: true,
        message: 'Cadastro realizado com sucesso! Voce ja esta participando dos sorteios.',
        participant: {
          name: participant.name,
          externalId: participant.external_id,
          status: participant.status,
          registeredAt: formatBr(participant.created_at),
        },
      });
    }),
  );

  router.get(
    '/participants/status',
    rateLimit({ name: 'status', windowMs: 10 * 60 * 1000, max: 40 }),
    handler(async (req, res) => {
      const externalId = String(req.query.externalId || '');
      const participant = await getParticipantStatus(req.db, externalId);
      if (!participant) {
        res.status(404).json({
          found: false,
          message: 'Nenhum cadastro encontrado com este ID.',
        });
        return;
      }
      res.json({
        found: true,
        participant: {
          name: participant.name,
          externalId: participant.external_id,
          status: participant.status,
          registeredAt: formatBr(participant.created_at),
        },
      });
    }),
  );

  return router;
}

/** Gerenciamento administrativo de participantes (exige sessao valida). */
export function participantsAdminRouter(): Router {
  const router = Router();

  router.get(
    '/',
    requireAdmin(),
    handler(async (req, res) => {
      const params = {
        q: req.query.q ? String(req.query.q).slice(0, 80) : undefined,
        status: req.query.status ? String(req.query.status) : 'all',
        sort: (['created_at', 'name', 'external_id'].includes(String(req.query.sort))
          ? String(req.query.sort)
          : 'created_at') as 'created_at' | 'name' | 'external_id',
        order: (req.query.order === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
        page: Math.max(1, Number(req.query.page) || 1),
        pageSize: Math.min(200, Math.max(1, Number(req.query.pageSize) || 20)),
      };
      const result = await listParticipants(req.db, params);
      res.json({
        items: result.items.map((p) => ({
          id: p.id,
          name: p.name,
          externalId: p.external_id,
          status: p.status,
          createdAt: formatBr(p.created_at),
          createdAtIso: p.created_at,
        })),
        total: result.total,
        page: params.page,
        pageSize: params.pageSize,
      });
    }),
  );

  router.get(
    '/export.csv',
    requireAdmin(),
    handler(async (req, res) => {
      const status = String(req.query.status || 'all');
      const csv = await exportParticipantsCsv(req.db, status);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="participantes-gorjeta77-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(`\uFEFF${csv}`);
    }),
  );

  router.patch(
    '/:id',
    requireAdmin(),
    handler(async (req, res) => {
      if (!req.admin) return;
      const input = parseWith(updateSchema, req.body);
      const updated = await updateParticipant(req.db, String(req.params.id), input, req.admin, {
        ip: clientKey(req),
      });
      res.json({
        ok: true,
        participant: {
          id: updated.id,
          name: updated.name,
          externalId: updated.external_id,
          status: updated.status,
          createdAt: formatBr(updated.created_at),
        },
      });
    }),
  );

  router.delete(
    '/:id',
    requireAdmin(),
    handler(async (req, res) => {
      if (!req.admin) return;
      await removeParticipant(req.db, String(req.params.id), req.admin, { ip: clientKey(req) });
      res.json({ ok: true, message: 'Cadastro removido dos sorteios.' });
    }),
  );

  return router;
}
