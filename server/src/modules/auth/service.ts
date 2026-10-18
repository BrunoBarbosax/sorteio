import bcrypt from 'bcryptjs';
import type { Db } from '../../db';
import { unauthorized, forbidden, conflict } from '../../lib/errors';
import { newId, newToken, nowIso, plusHoursIso } from '../../lib/ids';
import { env } from '../../env';
import { sha256 } from '../../middleware/security';
import { audit } from '../audit/log';

const FAILED_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const failedAttempts = new Map<string, { count: number; resetAt: number }>();

function attemptKey(email: string, ip: string): string {
  return `${email.toLowerCase()}|${ip}`;
}

function checkAttempts(email: string, ip: string): void {
  const key = attemptKey(email, ip);
  const bucket = failedAttempts.get(key);
  if (!bucket || bucket.resetAt <= Date.now()) return;
  if (bucket.count >= MAX_FAILED_ATTEMPTS) {
    const retryIn = Math.ceil((bucket.resetAt - Date.now()) / 60000);
    throw forbidden(
      `Muitas tentativas de login. Aguarde aproximadamente ${retryIn} minuto(s) e tente novamente.`,
    );
  }
}

function registerFailure(email: string, ip: string): void {
  const key = attemptKey(email, ip);
  const now = Date.now();
  const bucket = failedAttempts.get(key);
  if (!bucket || bucket.resetAt <= now) {
    failedAttempts.set(key, { count: 1, resetAt: now + FAILED_ATTEMPT_WINDOW_MS });
    return;
  }
  bucket.count += 1;
}

function clearFailures(email: string, ip: string): void {
  failedAttempts.delete(attemptKey(email, ip));
}

export async function login(
  db: Db,
  input: { email: string; password: string },
  meta: { ip: string },
): Promise<{ token: string; admin: { id: string; email: string; name: string; role: string } }> {
  checkAttempts(input.email, meta.ip);

  const admin = await db.get<{ id: string; email: string; name: string; password_hash: string; role: string }>(
    'SELECT id, email, name, password_hash, role FROM admins WHERE LOWER(email) = ? LIMIT 1',
    [input.email.toLowerCase()],
  );

  // Comparacao sempre executada para reduzir diferencas de tempo (enumeracao).
  const hash = admin?.password_hash || '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
  const valid = await bcrypt.compare(input.password, hash);

  if (!admin || !valid) {
    registerFailure(input.email, meta.ip);
    await audit(db, {
      adminEmail: input.email,
      action: 'auth.login_failed',
      entity: 'admin',
      ip: meta.ip,
    });
    throw unauthorized('E-mail ou senha incorretos.');
  }

  clearFailures(input.email, meta.ip);

  const token = newToken(32);
  const sessionId = newId(20);
  await db.run(
    `INSERT INTO sessions (id, token_hash, admin_id, created_at, expires_at, last_seen_at, ip_hash, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      sha256(token),
      admin.id,
      nowIso(),
      plusHoursIso(env.sessionTtlHours),
      nowIso(),
      sha256(meta.ip),
      null,
    ],
  );
  await db.run('UPDATE admins SET last_login_at = ? WHERE id = ?', [nowIso(), admin.id]);

  await audit(db, {
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'auth.login',
    entity: 'admin',
    entityId: admin.id,
    ip: meta.ip,
  });

  return {
    token,
    admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
  };
}

export async function logout(db: Db, token: string, meta: { ip: string; admin?: { id: string; email: string } }): Promise<void> {
  await db.run('DELETE FROM sessions WHERE token_hash = ?', [sha256(token)]);
  if (meta.admin) {
    await audit(db, {
      adminId: meta.admin.id,
      adminEmail: meta.admin.email,
      action: 'auth.logout',
      entity: 'admin',
      entityId: meta.admin.id,
      ip: meta.ip,
    });
  }
}

export async function createAdmin(
  db: Db,
  input: { email: string; password: string; name: string; role?: string },
): Promise<{ id: string }> {
  const existing = await db.get('SELECT id FROM admins WHERE LOWER(email) = ? LIMIT 1', [
    input.email.toLowerCase(),
  ]);
  if (existing) throw conflict('Ja existe um administrador com este e-mail.');
  const id = newId(20);
  const hash = await bcrypt.hash(input.password, env.bcryptRounds);
  await db.run(
    `INSERT INTO admins (id, email, name, password_hash, role, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.email.toLowerCase(), input.name, hash, input.role || 'admin', nowIso()],
  );
  return { id };
}

export async function changeOwnPassword(
  db: Db,
  admin: { id: string; email: string },
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  const row = await db.get<{ password_hash: string }>('SELECT password_hash FROM admins WHERE id = ?', [
    admin.id,
  ]);
  if (!row) throw unauthorized();
  const valid = await bcrypt.compare(input.currentPassword, row.password_hash);
  if (!valid) throw unauthorized('Senha atual incorreta.');
  const hash = await bcrypt.hash(input.newPassword, env.bcryptRounds);
  await db.run('UPDATE admins SET password_hash = ? WHERE id = ?', [hash, admin.id]);
  // Encerra as demais sessoes do administrador apos trocar a senha.
  await db.run('DELETE FROM sessions WHERE admin_id = ?', [admin.id]);
  await audit(db, {
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'admin.password_changed',
    entity: 'admin',
    entityId: admin.id,
  });
}

export async function listAuditLogs(
  db: Db,
  params: { page: number; pageSize: number; action?: string },
): Promise<{ items: unknown[]; total: number }> {
  const offset = (params.page - 1) * params.pageSize;
  const where = params.action ? 'WHERE action = ?' : '';
  const args = params.action ? [params.action] : [];
  const totalRow = await db.get<{ count: number }>(
    `SELECT COUNT(*) AS count FROM audit_logs ${where}`,
    args,
  );
  const items = await db.all(
    `SELECT id, admin_id, admin_email, action, entity, entity_id, details, created_at
       FROM audit_logs ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`,
    [...args, params.pageSize, offset],
  );
  return { items, total: Number(totalRow?.count || 0) };
}
