import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { createDb, type Db } from '../src/db';
import { migrate } from '../src/db/migrate';
import { newId, nowIso } from '../src/lib/ids';
import { clearRateLimits } from '../src/middleware/rateLimit';

export interface TestContext {
  app: Express;
  db: Db;
}

export async function createTestContext(sqlitePath = ':memory:'): Promise<TestContext> {
  process.env.NODE_ENV = 'test';
  process.env.RATE_LIMIT_DISABLED = process.env.RATE_LIMIT_DISABLED || '1';
  process.env.SQLITE_PATH = sqlitePath;
  clearRateLimits();
  const db = createDb();
  await migrate(db);
  const app = createApp(db);
  return { app, db };
}

export async function seedAdmin(db: Db, email = 'admin@teste.com', password = 'SenhaForte123!'): Promise<void> {
  const hash = bcrypt.hashSync(password, 6);
  await db.run(
    'INSERT INTO admins (id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [newId(20), email, 'Administrador Teste', hash, 'admin', nowIso()],
  );
}

export interface AdminSession {
  agent: ReturnType<typeof request.agent>;
  csrfToken: string;
}

/** Realiza login administrativo e devolve um agente com cookies + token CSRF. */
export async function adminLogin(
  app: Express,
  email = 'admin@teste.com',
  password = 'SenhaForte123!',
): Promise<AdminSession> {
  const agent = request.agent(app);
  const sessionRes = await agent.get('/api/auth/session');
  const csrfToken = String(sessionRes.body.csrfToken || '');
  const loginRes = await agent
    .post('/api/auth/login')
    .set('x-csrf-token', csrfToken)
    .send({ email, password });
  if (loginRes.status !== 200) {
    throw new Error(`Login falhou: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
  }
  return { agent, csrfToken: String(loginRes.body.csrfToken || csrfToken) };
}

/** Cadastra um participante via API publica. */
export async function registerParticipant(
  app: Express,
  name: string,
  externalId: string,
): Promise<request.Response> {
  return request(app).post('/api/public/participants').send({ name, externalId });
}

export async function seedParticipants(db: Db, count: number): Promise<Array<{ id: string; name: string; externalId: string }>> {
  const items: Array<{ id: string; name: string; externalId: string }> = [];
  for (let i = 1; i <= count; i += 1) {
    const id = newId(16);
    const name = `Participante ${i}`;
    const externalId = `ID${String(i).padStart(4, '0')}`;
    const timestamp = nowIso();
    await db.run(
      `INSERT INTO participants (id, name, external_id, status, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?)`,
      [id, name, externalId, timestamp, timestamp],
    );
    items.push({ id, name, externalId });
  }
  return items;
}
