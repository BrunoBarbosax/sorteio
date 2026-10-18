import type { Db } from '../../db';
import { isUniqueViolation } from '../../db';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { newId, nowIso } from '../../lib/ids';
import { escapeLike, normalizeText } from '../../lib/http';
import { sha256 } from '../../middleware/security';
import { audit } from '../audit/log';

export interface ParticipantInput {
  name: string;
  externalId: string;
}

export interface ParticipantRow {
  id: string;
  name: string;
  external_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const NAME_PATTERN = /^[\p{L}][\p{L}\p{M}\s'.-]{1,79}$/u;
const ID_PATTERN = /^[A-Za-z0-9._-]{3,40}$/;

export function validateParticipantInput(input: ParticipantInput): ParticipantInput {
  const name = normalizeText(input.name);
  const externalId = input.externalId.trim();

  if (!NAME_PATTERN.test(name)) {
    throw badRequest(
      'Nome invalido. Use de 2 a 80 caracteres, apenas letras, espacos, apóstrofos, pontos ou hifens.',
    );
  }
  if (!ID_PATTERN.test(externalId)) {
    throw badRequest(
      'ID invalido. Use de 3 a 40 caracteres: letras, numeros, ponto, hifen ou sublinhado.',
    );
  }
  return { name, externalId };
}

/** Cadastro publico: valida, normaliza e persiste o participante. */
export async function registerParticipant(
  db: Db,
  input: ParticipantInput,
  meta: { ip: string },
): Promise<ParticipantRow> {
  const data = validateParticipantInput(input);
  const id = newId(16);
  const timestamp = nowIso();

  try {
    await db.run(
      `INSERT INTO participants (id, name, external_id, status, created_at, updated_at, created_ip_hash)
       VALUES (?, ?, ?, 'active', ?, ?, ?)`,
      [id, data.name, data.externalId, timestamp, timestamp, sha256(meta.ip)],
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict('Este ID ja esta cadastrado. Verifique o informado ou fale com a organizacao.');
    }
    throw error;
  }

  return {
    id,
    name: data.name,
    external_id: data.externalId,
    status: 'active',
    created_at: timestamp,
    updated_at: timestamp,
  };
}

/** Consulta de status: so devolve dados do proprio ID informado. */
export async function getParticipantStatus(
  db: Db,
  externalId: string,
): Promise<ParticipantRow | undefined> {
  const normalized = externalId.trim();
  if (!ID_PATTERN.test(normalized)) {
    throw badRequest('ID invalido para consulta.');
  }
  return db.get<ParticipantRow>(
    'SELECT id, name, external_id, status, created_at, updated_at FROM participants WHERE UPPER(external_id) = ? LIMIT 1',
    [normalized.toUpperCase()],
  );
}

export interface ListParams {
  q?: string;
  status?: string;
  sort?: 'created_at' | 'name' | 'external_id';
  order?: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export async function listParticipants(
  db: Db,
  params: ListParams,
): Promise<{ items: ParticipantRow[]; total: number }> {
  const clauses: string[] = [];
  const args: unknown[] = [];

  if (params.q) {
    const term = `%${escapeLike(params.q.toLowerCase())}%`;
    clauses.push("(LOWER(name) LIKE ? ESCAPE '\\' OR LOWER(external_id) LIKE ? ESCAPE '\\')");
    args.push(term, term);
  }
  if (params.status && params.status !== 'all') {
    clauses.push('status = ?');
    args.push(params.status);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sortColumn = params.sort || 'created_at';
  const order = params.order === 'asc' ? 'ASC' : 'DESC';

  const totalRow = await db.get<{ count: number }>(
    `SELECT COUNT(*) AS count FROM participants ${where}`,
    args,
  );
  const items = await db.all<ParticipantRow>(
    `SELECT id, name, external_id, status, created_at, updated_at
       FROM participants ${where}
      ORDER BY ${sortColumn} ${order}
      LIMIT ? OFFSET ?`,
    [...args, params.pageSize, (params.page - 1) * params.pageSize],
  );

  return { items, total: Number(totalRow?.count || 0) };
}

export async function updateParticipant(
  db: Db,
  id: string,
  patch: { name?: string; externalId?: string; status?: 'active' | 'removed' },
  admin: { id: string; email: string },
  meta: { ip: string },
): Promise<ParticipantRow> {
  const existing = await db.get<ParticipantRow>('SELECT * FROM participants WHERE id = ?', [id]);
  if (!existing) throw notFound('Participante nao encontrado.');

  const nextName = patch.name !== undefined ? normalizeText(patch.name) : existing.name;
  const nextId = patch.externalId !== undefined ? patch.externalId.trim() : existing.external_id;
  const nextStatus = patch.status ?? existing.status;

  if (!NAME_PATTERN.test(nextName)) throw badRequest('Nome invalido.');
  if (!ID_PATTERN.test(nextId)) throw badRequest('ID invalido.');
  if (!['active', 'removed'].includes(nextStatus)) throw badRequest('Status invalido.');

  const changes = validateParticipantInput({ name: nextName, externalId: nextId });

  try {
    await db.run(
      'UPDATE participants SET name = ?, external_id = ?, status = ?, updated_at = ? WHERE id = ?',
      [changes.name, changes.externalId, nextStatus, nowIso(), id],
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict('Ja existe outro participante com este ID.');
    }
    throw error;
  }

  await audit(db, {
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'participant.update',
    entity: 'participant',
    entityId: id,
    details: {
      before: { name: existing.name, externalId: existing.external_id, status: existing.status },
      after: { name: changes.name, externalId: changes.externalId, status: nextStatus },
    },
    ip: meta.ip,
  });

  const updated = await db.get<ParticipantRow>(
    'SELECT id, name, external_id, status, created_at, updated_at FROM participants WHERE id = ?',
    [id],
  );
  return updated as ParticipantRow;
}

/** Remocao administrativa (registro mantido para auditoria, marcado como removido). */
export async function removeParticipant(
  db: Db,
  id: string,
  admin: { id: string; email: string },
  meta: { ip: string },
): Promise<void> {
  const existing = await db.get<ParticipantRow>('SELECT * FROM participants WHERE id = ?', [id]);
  if (!existing) throw notFound('Participante nao encontrado.');
  if (existing.status === 'removed') throw badRequest('Participante ja esta removido.');

  await db.run('UPDATE participants SET status = ?, updated_at = ? WHERE id = ?', [
    'removed',
    nowIso(),
    id,
  ]);

  await audit(db, {
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'participant.remove',
    entity: 'participant',
    entityId: id,
    details: { name: existing.name, externalId: existing.external_id },
    ip: meta.ip,
  });
}

export async function countActiveParticipants(db: Db): Promise<number> {
  const row = await db.get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM participants WHERE status = 'active'",
  );
  return Number(row?.count || 0);
}

/** Converte linhas em CSV com aspas escapadas (exportacao administrativa). */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const escapeCell = (value: unknown): string => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [headers.map(escapeCell).join(';')];
  for (const row of rows) lines.push(row.map(escapeCell).join(';'));
  return lines.join('\r\n');
}

export async function exportParticipantsCsv(db: Db, status = 'all'): Promise<string> {
  const where = status === 'all' ? '' : 'WHERE status = ?';
  const args = status === 'all' ? [] : [status];
  const rows = await db.all<ParticipantRow>(
    `SELECT name, external_id, status, created_at FROM participants ${where} ORDER BY created_at DESC`,
    args,
  );
  return toCsv(
    ['Nome', 'ID', 'Status', 'Cadastrado em'],
    rows.map((r) => [r.name, r.external_id, r.status, formatBr(r.created_at)]),
  );
}

/** Formata ISO para o padrao brasileiro (dd/mm/aaaa HH:MM:ss). */
export function formatBr(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
