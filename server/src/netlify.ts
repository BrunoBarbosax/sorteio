/**
 * Entrada serverless para Netlify Functions.
 *
 * Empacota a API Express inteira (createApp) em uma unica funcao HTTP:
 * - roda as migracoes do banco na primeira invocacao (cold start)
 * - cria o administrador inicial se ADMIN_EMAIL/ADMIN_PASSWORD existirem
 * - normaliza o caminho quando o rewrite de /api/* aponta para esta funcao
 *
 * Banco de dados: obrigatoriamente PostgreSQL (SQLite nao persiste na Netlify).
 */
import fs from 'node:fs';
import path from 'node:path';
import serverless from 'serverless-http';
import bcrypt from 'bcryptjs';
import { createApp } from './app';
import { createDb, type Db } from './db';
import { migrate } from './db/migrate';
import { env } from './env';
import { newId, nowIso } from './lib/ids';

interface NetlifyEvent {
  path?: string;
  [key: string]: unknown;
}

/** Prefixo visto pela funcao quando o rewrite redireciona /api/* para ca. */
const FN_PREFIX = '/.netlify/functions/api';

/** Devolve o caminho original da API (Express monta tudo em /api...). */
function normalizePath(raw: string | undefined): string {
  const requestPath = typeof raw === 'string' && raw ? raw : '/';
  if (requestPath === FN_PREFIX || requestPath.startsWith(`${FN_PREFIX}/`)) {
    const rest = requestPath.slice(FN_PREFIX.length) || '/';
    return rest.startsWith('/api') ? rest : `/api${rest}`;
  }
  return requestPath;
}

type NetlifyHandler = (event: NetlifyEvent, context: unknown) => Promise<unknown>;

/**
 * Localiza a pasta de migracoes (.sql): na Netlify ela e copiada para a raiz
 * do deploy (`server-migrations/`); localmente fica em `server/migrations`.
 */
function resolveMigrationsDir(): string {
  const candidates = [
    // deploy manual: pasta netlify-dist arrastada na Netlify
    path.resolve(__dirname, '../../server-migrations'),
    // build via Git: included_files preserva a pasta do repositorio
    path.resolve(__dirname, '../../netlify-dist/server-migrations'),
    path.resolve(__dirname, '../../migrations'),
    path.resolve(process.cwd(), 'migrations'),
    path.resolve(process.cwd(), 'server', 'migrations'),
    path.resolve(process.cwd(), 'netlify-dist', 'server-migrations'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  throw new Error('Pasta de migracoes (migrations/*.sql) nao encontrada.');
}

let appReady: Promise<NetlifyHandler> | null = null;

async function bootstrap(): Promise<NetlifyHandler> {
  const db: Db = createDb();
  const applied = await migrate(db, resolveMigrationsDir());
  if (applied.length) console.log('[netlify] migracoes aplicadas:', applied.join(', '));

  // Administrador inicial: criado uma unica vez, na primeira invocacao.
  const email = env.adminEmail.trim().toLowerCase();
  if (email && env.adminPassword) {
    const existing = await db.get<{ id: string }>(
      'SELECT id FROM admins WHERE LOWER(email) = ?',
      [email],
    );
    if (!existing) {
      const hash = await bcrypt.hash(env.adminPassword, env.bcryptRounds);
      await db.run(
        'INSERT INTO admins (id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [newId(20), email, env.adminName, hash, 'admin', nowIso()],
      );
      console.log(`[netlify] administrador ${email} criado.`);
    }
  }

  const app = createApp(db);
  const fn = serverless(app);
  return async (event, context) =>
    fn({ ...event, path: normalizePath(event.path) } as Parameters<typeof fn>[0], context);
}

export const handler = async (event: NetlifyEvent, context: unknown): Promise<unknown> => {
  if (!appReady) {
    appReady = bootstrap().catch((error) => {
      appReady = null; // libera nova tentativa na proxima invocacao
      throw error;
    });
  }
  const run = await appReady;
  return run(event, context);
};
