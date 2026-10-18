// O driver SQLite (node:sqlite) e carregado de forma LAZY: em ambientes
// serverless (Netlify) apenas o PostgreSQL e usado, e um import estatico de
// node:sqlite quebrava o carregamento do bundle da funcao.
type SqliteStatement = {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): { changes: bigint | number };
};
type SqliteDatabase = {
  prepare(sql: string): SqliteStatement;
  exec(sql: string): void;
  close(): void;
};
type SqliteModule = { DatabaseSync: new (path: string) => SqliteDatabase };

function loadSqliteDatabase(filePath: string): SqliteDatabase {
  const sqlite = require('node:sqlite') as SqliteModule;
  return new sqlite.DatabaseSync(filePath);
}
import fs from 'node:fs';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { env } from '../env';

export type Row = Record<string, unknown>;

export interface RunResult {
  changes: number;
}

export interface Db {
  readonly dialect: 'sqlite' | 'postgres';
  all<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T =Row>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<RunResult>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Converte os `?` em parametros posicionais do PostgreSQL ($1, $2, ...). */
function toPgSql(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function normalizeParams(params: unknown[] | undefined): unknown[] {
  if (!params) return [];
  return params.map((p) => (p === undefined ? null : p));
}

/* ------------------------------------------------------------------ */
/* SQLite (node:sqlite - nativo do Node.js, sem dependencia nativa)    */
/* ------------------------------------------------------------------ */

class SqliteDb implements Db {
  readonly dialect = 'sqlite' as const;
  private db: SqliteDatabase;
  private stmts = new Map<string, SqliteStatement>();
  private mutex: Promise<unknown> = Promise.resolve();

  constructor(filePath: string) {
    if (filePath !== ':memory:') {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }
    this.db = loadSqliteDatabase(filePath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
  }

  private prepare(sql: string) {
    let stmt = this.stmts.get(sql);
    if (!stmt) {
      stmt = this.db.prepare(sql);
      this.stmts.set(sql, stmt);
    }
    return stmt;
  }

  async all<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.prepare(sql).all(...(normalizeParams(params) as never[])) as unknown as T[];
  }

  async get<T = Row>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const row = this.prepare(sql).get(...(normalizeParams(params) as never[]));
    return row as T | undefined;
  }

  async run(sql: string, params: unknown[] = []): Promise<RunResult> {
    const result = this.prepare(sql).run(...(normalizeParams(params) as never[]));
    return { changes: Number(result.changes) };
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  /**
   * O SQLite e sincrono e compartilha uma unica conexao, entao transacoes
   * concorrentes sao serializadas por um mutex em memoria.
   */
  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        const result = await fn(this);
        this.db.exec('COMMIT');
        return result;
      } catch (error) {
        try {
          this.db.exec('ROLLBACK');
        } catch {
          /* rollback ja realizado */
        }
        throw error;
      }
    };
    const queued = this.mutex.then(run, run);
    this.mutex = queued.catch(() => undefined);
    return queued;
  }

  async close(): Promise<void> {
    this.stmts.clear();
    this.db.close();
  }
}

/* ------------------------------------------------------------------ */
/* PostgreSQL (producao)                                               */
/* ------------------------------------------------------------------ */

class PgTx implements Db {
  readonly dialect = 'postgres' as const;
  constructor(private client: PoolClient) {}

  async all<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
    const res = await this.client.query(toPgSql(sql), normalizeParams(params));
    return res.rows as T[];
  }

  async get<T = Row>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const res = await this.client.query(toPgSql(sql), normalizeParams(params));
    return res.rows[0] as T | undefined;
  }

  async run(sql: string, params: unknown[] = []): Promise<RunResult> {
    const res = await this.client.query(toPgSql(sql), normalizeParams(params));
    return { changes: res.rowCount ?? 0 };
  }

  async exec(sql: string): Promise<void> {
    await this.client.query(sql);
  }

  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    await this.client.query('BEGIN');
    try {
      const result = await fn(this);
      await this.client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await this.client.query('ROLLBACK');
      } catch {
        /* rollback ja realizado */
      }
      throw error;
    }
  }

  async close(): Promise<void> {
    /* a conexao devolve ao pool no PgDb.transaction */
  }
}

class PgDb implements Db {
  readonly dialect = 'postgres' as const;
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      ssl: /sslmode=require|render\.com|railway\.app/i.test(connectionString)
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }

  async all<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
    const res = await this.pool.query(toPgSql(sql), normalizeParams(params));
    return res.rows as T[];
  }

  async get<T = Row>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const res = await this.pool.query(toPgSql(sql), normalizeParams(params));
    return res.rows[0] as T | undefined;
  }

  async run(sql: string, params: unknown[] = []): Promise<RunResult> {
    const res = await this.pool.query(toPgSql(sql), normalizeParams(params));
    return { changes: res.rowCount ?? 0 };
  }

  async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const tx = new PgTx(client);
    try {
      await client.query('BEGIN');
      const result = await fn(tx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* rollback ja realizado */
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createDb(): Db {
  if (env.dbClient === 'postgres') return new PgDb(env.databaseUrl);
  // Em teste, o caminho e escolhido em tempo de execucao (banco em memoria
  // ou arquivo temporario), permitindo reinicializacoes simuladas.
  if (process.env.NODE_ENV === 'test') {
    return new SqliteDb(process.env.SQLITE_PATH || ':memory:');
  }
  return new SqliteDb(env.sqlitePath);
}

/** Verdadeiro quando o erro e violacao de unicidade (ID duplicado). */
export function isUniqueViolation(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  if (!err) return false;
  if (err.code === '23505') return true;
  return typeof err.message === 'string' && /UNIQUE constraint failed/i.test(err.message);
}
