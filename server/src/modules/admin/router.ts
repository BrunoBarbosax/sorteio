import { Router } from 'express';
import { handler } from '../../lib/http';
import { requireAdmin } from '../../middleware/auth';
import { countActiveParticipants, formatBr } from '../participants/service';
import { getDrawRow, getWinners, serializeDraw } from '../draws/service';

/** Dados do dashboard administrativo. */
export function adminRouter(): Router {
  const router = Router();

  router.get(
    '/stats',
    requireAdmin(),
    handler(async (req, res) => {
      const db = req.db;
      const totalParticipants = await countActiveParticipants(db);
      const removedRow = await db.get<{ count: number }>(
        "SELECT COUNT(*) AS count FROM participants WHERE status = 'removed'",
      );
      const drawsRow = await db.get<{ count: number; completed: number }>(
        `SELECT COUNT(*) AS count,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
           FROM draws`,
      );
      const winnersRow = await db.get<{ count: number }>(
        'SELECT COUNT(*) AS count FROM draw_winners',
      );
      const lastDrawRow = await db.get<{ id: string }>(
        "SELECT id FROM draws WHERE status = 'completed' ORDER BY executed_at DESC LIMIT 1",
      );
      const pendingRow = await db.get<{ id: string }>(
        "SELECT id FROM draws WHERE status = 'pending' ORDER BY created_at DESC LIMIT 1",
      );

      const lastDraw = lastDrawRow ? await getDrawRow(db, lastDrawRow.id) : undefined;
      const pendingDraw = pendingRow ? await getDrawRow(db, pendingRow.id) : undefined;
      const lastWinners = lastDrawRow ? await getWinners(db, lastDrawRow.id) : [];

      res.json({
        totalParticipants,
        removedParticipants: Number(removedRow?.count || 0),
        totalDraws: Number(drawsRow?.count || 0),
        completedDraws: Number(drawsRow?.completed || 0),
        totalWinners: Number(winnersRow?.count || 0),
        lastDraw: lastDraw
          ? serializeDraw(lastDraw, {
              winners: lastWinners.map((w) => ({
                name: w.name,
                externalId: w.external_id,
                position: w.position,
              })),
            })
          : null,
        pendingDraw: pendingDraw ? serializeDraw(pendingDraw) : null,
        serverTime: formatBr(new Date().toISOString()),
      });
    }),
  );

  return router;
}
