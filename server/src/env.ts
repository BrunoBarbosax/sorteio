import 'dotenv/config';
import path from 'node:path';

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
}

function int(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const databaseUrl = process.env.DATABASE_URL || '';
const dbClient =
  (process.env.DB_CLIENT || (databaseUrl.startsWith('postgres') ? 'postgres' : 'sqlite')).toLowerCase() as
    | 'sqlite'
    | 'postgres';

if (dbClient === 'postgres' && !databaseUrl) {
  throw new Error('DB_CLIENT=postgres exige a variavel DATABASE_URL com a string de conexao.');
}

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: int(process.env.PORT, 4000),
  dbClient,
  sqlitePath: path.resolve(process.cwd(), process.env.SQLITE_PATH || './data/gorjeta77.db'),
  databaseUrl,
  trustProxy: bool(process.env.TRUST_PROXY, false),
  sessionTtlHours: int(process.env.SESSION_TTL_HOURS, 12),
  rateLimitDisabled: bool(process.env.RATE_LIMIT_DISABLED, false),
  publicOrigin: process.env.PUBLIC_ORIGIN || '',
  adminEmail: process.env.ADMIN_EMAIL || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  adminName: process.env.ADMIN_NAME || 'Administrador',
  bcryptRounds: int(process.env.BCRYPT_ROUNDS, 12),
};

export type Env = typeof env;
