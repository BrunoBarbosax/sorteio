import type { Db } from '../../db';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { newId, nowIso } from '../../lib/ids';
import { escapeLike } from '../../lib/http';
import { audit } from '../audit/log';
import { formatBr } from '../participants/service';
import { secureShuffle } from './rng';

export const DRAW_STYLES = ['classic', 'neon', 'gala'] as const;
export type DrawStyle = (typeof DRAW_STYLES)[number];

export interface DrawCreateInput {
  name: string;
  description?: string;
  winnerCount: number;
  durationSeconds: number;
  style: DrawStyle;
  soundEnabled: boolean;
  publicResults: boolean;
  publicShowIds: boolean;
  executeNow: boolean;
}

export interface DrawRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  winner_count: number;
  duration_seconds: number;
  style: string;
  sound_enabled: number;
  public_results: number;
  public_show_ids: number;
  status: string;
  eligible_count: number | null;
  eligible_snapshot: string | null;
  admin_id: string | null;
  admin_name: string | null;
  created_at: string;
  executed_at: string | null;
}

export interface WinnerRow {
  id: string;
  draw_id: string;
  participant_id: string | null;
  name: string;
  external_id: string;
  position: number;
  created_at: string;
}

export const MIN_DURATION_SECONDS = 30;

/** trava em memoria para impedir execucoes simultaneas no mesmo processo */
let executionLock: Promise<unknown> = Promise.resolve();

function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'sorteio'}-${newId(6).toLowerCase()}`;
}

export function validateDrawInput(input: DrawCreateInput): void {
  if (!Number.isInteger(input.winnerCount) || input.winnerCount < 1 || input.winnerCount > 1000) {
    throw badRequest('Quantidade de ganhadores deve ser um numero inteiro entre 1 e 1000.');
  }
  if (
    !Number.isInteger(input.durationSeconds) ||
    input.durationSeconds < MIN_DURATION_SECONDS ||
    input.durationSeconds > 3600
  ) {
    throw badRequest(
      `A duracao da animacao deve ser de pelo menos ${MIN_DURATION_SECONDS} segundos (ate 3600).`,
    );
  }
  if (!DRAW_STYLES.includes(input.style)) {
    throw badRequest('Estilo visual invalido.');
  }
}

async function eligibleParticipants(db: Db): Promise<Array<{ id: string; name: string; external_id: string }>> {
  return db.all<{ id: string; name: string; external_id: string }>(
    "SELECT id, name, external_id FROM participants WHERE status = 'active' ORDER BY created_at ASC",
  );
}

export function serializeDraw(row: DrawRow, extra: Record<string, unknown> = {}) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    winnerCount: row.winner_count,
    durationSeconds: row.duration_seconds,
    style: row.style,
    soundEnabled: row.sound_enabled === 1,
    publicResults: row.public_results === 1,
    publicShowIds: row.public_show_ids === 1,
    status: row.status,
    eligibleCount: row.eligible_count,
    adminName: row.admin_name,
    createdAt: formatBr(row.created_at),
    createdAtIso: row.created_at,
    executedAt: row.executed_at ? formatBr(row.executed_at) : null,
    ...extra,
  };
}

export async function createDraw(
  db: Db,
  input: DrawCreateInput,
  admin: { id: string; email: string; name: string },
  meta: { ip: string },
): Promise<{ draw: DrawRow; executed: boolean }> {
  validateDrawInput(input);

  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80) {
    throw badRequest('Nome do sorteio deve ter de 2 a 80 caracteres.');
  }

  const eligible = await eligibleParticipants(db);
  if (input.executeNow && eligible.length < input.winnerCount) {
    throw badRequest(
      `Participantes elegiveis insuficientes: ha ${eligible.length} cadastrado(s) e o sorteio pede ${input.winnerCount} ganhador(es). Cadastre mais participantes antes de sortear.`,
      { eligibleCount: eligible.length, winnerCount: input.winnerCount },
    );
  }

  const id = newId(20);
  const timestamp = nowIso();

  await db.run(
    `INSERT INTO draws (
       id, slug, name, description, winner_count, duration_seconds, style,
       sound_enabled, public_results, public_show_ids, status, admin_id, admin_name, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [
      id,
      slugify(name),
      name,
      input.description?.trim() || null,
      input.winnerCount,
      input.durationSeconds,
      input.style,
      input.soundEnabled ? 1 : 0,
      input.publicResults ? 1 : 0,
      input.publicShowIds ? 1 : 0,
      admin.id,
      admin.name,
      timestamp,
    ],
  );

  await audit(db, {
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'draw.create',
    entity: 'draw',
    entityId: id,
    details: {
      name,
      winnerCount: input.winnerCount,
      durationSeconds: input.durationSeconds,
      style: input.style,
      executeNow: input.executeNow,
    },
    ip: meta.ip,
  });

  const draw = await getDrawRow(db, id);
  if (!draw) throw notFound('Falha ao criar o sorteio.');

  if (!input.executeNow) return { draw, executed: false };
  const result = await executeDraw(db, id, admin, meta);
  return { draw: result.draw, executed: true };
}

export interface ExecutionResult {
  draw: DrawRow;
  winners: WinnerRow[];
  eligibleCount: number;
  /** Lista embaralhada usada apenas como efeito visual na animacao. */
  visualPool: Array<{ name: string; externalId: string; isWinner: boolean }>;
}

/**
 * Executa o sorteio: seleciona os ganhadores no backend, persiste tudo
 * e so entao devolve os dados para a apresentacao animada.
 */
export async function executeDraw(
  db: Db,
  drawId: string,
  admin: { id: string; email: string; name: string },
  meta: { ip: string },
): Promise<ExecutionResult> {
  const run = async (): Promise<ExecutionResult> =>
    db.transaction(async (tx) => {
      const draw = await getDrawRow(tx, drawId);
      if (!draw) throw notFound('Sorteio nao encontrado.');
      if (draw.status === 'completed') {
        throw conflict('Este sorteio ja foi executado. O resultado esta registrado no historico.');
      }

      const eligible = await eligibleParticipants(tx);
      if (eligible.length < draw.winner_count) {
        throw badRequest(
          `Participantes elegiveis insuficientes: ha ${eligible.length} cadastrado(s) e o sorteio pede ${draw.winner_count} ganhador(es).`,
          { eligibleCount: eligible.length, winnerCount: draw.winner_count },
        );
      }

      // Selecao aleatoria criptografica, sem repeticao dentro da rodada.
      const winners = secureShuffle(eligible, draw.winner_count);
      const timestamp = nowIso();

      await tx.run(
        `UPDATE draws
            SET status = 'completed', eligible_count = ?, eligible_snapshot = ?,
                executed_at = ?, admin_id = ?, admin_name = ?
          WHERE id = ? AND status = 'pending'`,
        [
          eligible.length,
          JSON.stringify(eligible.map((p) => ({ id: p.id, name: p.name, externalId: p.external_id }))),
          timestamp,
          admin.id,
          admin.name,
          drawId,
        ],
      );

      const winnerRows: WinnerRow[] = [];
      for (let i = 0; i < winners.length; i += 1) {
        const winner = winners[i];
        const row: WinnerRow = {
          id: newId(18),
          draw_id: drawId,
          participant_id: winner.id,
          name: winner.name,
          external_id: winner.external_id,
          position: i + 1,
          created_at: timestamp,
        };
        await tx.run(
          `INSERT INTO draw_winners (id, draw_id, participant_id, name, external_id, position, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [row.id, row.draw_id, row.participant_id, row.name, row.external_id, row.position, row.created_at],
        );
        winnerRows.push(row);
      }

      const winnerIds = new Set(winners.map((w) => w.id));
      const visualPool = eligible.map((p) => ({
        name: p.name,
        externalId: p.external_id,
        isWinner: winnerIds.has(p.id),
      }));

      const updated = await getDrawRow(tx, drawId);
      if (!updated) throw notFound('Sorteio nao encontrado.');

      return { draw: updated, winners: winnerRows, eligibleCount: eligible.length, visualPool };
    });

  // Serializa execucoes no processo para evitar corrida acidental.
  const queued = executionLock.then(run, run);
  executionLock = queued.then(
    () => undefined,
    () => undefined,
  );
  const result = await queued;

  await audit(db, {
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'draw.execute',
    entity: 'draw',
    entityId: drawId,
    details: {
      eligibleCount: result.eligibleCount,
      winnerCount: result.winners.length,
      winners: result.winners.map((w) => ({ name: w.name, externalId: w.external_id })),
    },
    ip: meta.ip,
  });

  return result;
}

export async function getDrawRow(db: Db, id: string): Promise<DrawRow | undefined> {
  return db.get<DrawRow>('SELECT * FROM draws WHERE id = ? LIMIT 1', [id]);
}

export async function getWinners(db: Db, drawId: string): Promise<WinnerRow[]> {
  return db.all<WinnerRow>(
    'SELECT * FROM draw_winners WHERE draw_id = ? ORDER BY position ASC',
    [drawId],
  );
}

export async function listDraws(
  db: Db,
  params: { q?: string; page: number; pageSize: number; from?: string; to?: string },
): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
  const clauses: string[] = [];
  const args: unknown[] = [];
  if (params.q) {
    clauses.push("LOWER(name) LIKE ? ESCAPE '\\'");
    args.push(`%${escapeLike(params.q.toLowerCase())}%`);
  }
  if (params.from) {
    clauses.push('created_at >= ?');
    args.push(params.from);
  }
  if (params.to) {
    clauses.push('created_at <= ?');
    args.push(params.to);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const totalRow = await db.get<{ count: number }>(
    `SELECT COUNT(*) AS count FROM draws ${where}`,
    args,
  );
  const rows = await db.all<DrawRow>(
    `SELECT * FROM draws ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...args, params.pageSize, (params.page - 1) * params.pageSize],
  );

  const items: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    const winners = await getWinners(db, row.id);
    items.push(
      serializeDraw(row, {
        winners: winners.map((w) => ({
          name: w.name,
          externalId: w.external_id,
          position: w.position,
        })),
      }),
    );
  }
  return { items, total: Number(totalRow?.count || 0) };
}

export async function getDrawDetail(db: Db, id: string): Promise<Record<string, unknown>> {
  const draw = await getDrawRow(db, id);
  if (!draw) throw notFound('Sorteio nao encontrado.');
  const winners = await getWinners(db, id);
  let visualPool: Array<{ name: string; externalId: string; isWinner: boolean }> | null = null;
  if (draw.eligible_snapshot) {
    try {
      const parsed = JSON.parse(draw.eligible_snapshot) as Array<{
        id: string;
        name: string;
        externalId: string;
      }>;
      const winnerIds = new Set(winners.map((w) => w.participant_id));
      visualPool = parsed.map((p) => ({
        name: p.name,
        externalId: p.externalId,
        isWinner: winnerIds.has(p.id),
      }));
    } catch {
      visualPool = null;
    }
  }
  return serializeDraw(draw, {
    winners: winners.map((w) => ({
      id: w.id,
      name: w.name,
      externalId: w.external_id,
      position: w.position,
    })),
    visualPool,
  });
}

export async function listPublicDraws(db: Db, limit = 12): Promise<Array<Record<string, unknown>>> {
  const rows = await db.all<DrawRow>(
    "SELECT * FROM draws WHERE public_results = 1 AND status = 'completed' ORDER BY executed_at DESC LIMIT ?",
    [limit],
  );
  const result: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    const winners = await getWinners(db, row.id);
    result.push(
      serializeDraw(row, {
        winners: winners.map((w) => ({
          name: w.name,
          externalId: row.public_show_ids === 1 ? w.external_id : null,
          position: w.position,
        })),
      }),
    );
  }
  return result;
}

export async function getPublicDraw(db: Db, slug: string): Promise<Record<string, unknown>> {
  const row = await db.get<DrawRow>(
    "SELECT * FROM draws WHERE slug = ? AND public_results = 1 AND status = 'completed' LIMIT 1",
    [slug],
  );
  if (!row) throw notFound('Resultado nao encontrado ou ainda nao disponivel publicamente.');
  const winners = await getWinners(db, row.id);
  const payload = serializeDraw(row, {
    winners: winners.map((w) => ({
      name: w.name,
      externalId: row.public_show_ids === 1 ? w.external_id : null,
      position: w.position,
    })),
  });
  return payload;
}

export async function exportDrawsCsv(db: Db): Promise<string> {
  const rows = await db.all<DrawRow>('SELECT * FROM draws ORDER BY created_at DESC');
  const lines: string[] = ['Sorteio;Data;Ganhadores;Elegiveis;Duracao (s);Status;Administrador;Resultados'];
  for (const row of rows) {
    const winners = await getWinners(db, row.id);
    const names = winners.map((w) => `${w.name} (${w.external_id})`).join(' | ');
    const cells = [
      row.name,
      row.executed_at ? formatBr(row.executed_at) : formatBr(row.created_at),
      String(winners.length),
      row.eligible_count === null ? '' : String(row.eligible_count),
      String(row.duration_seconds),
      row.status === 'completed' ? 'Concluido' : 'Pendente',
      row.admin_name || '',
      names,
    ];
    lines.push(
      cells
        .map((c) => (/[",;\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c))
        .join(';'),
    );
  }
  return lines.join('\r\n');
}
