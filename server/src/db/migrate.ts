import fs from 'node:fs';
import path from 'node:path';
import type { Db } from './index';

/**
 * Aplica as migracoes pendentes de forma idempotente.
 * Cada arquivo .sql de `migrations/` e executado uma unica vez,
 * registrado na tabela `schema_migrations`.
 */
export async function migrate(db: Db, migrationsDir?: string): Promise<string[]> {
  const dir = migrationsDir || path.resolve(__dirname, '../../migrations');

  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);

  const appliedRows = await db.all<{ id: string }>('SELECT id FROM schema_migrations');
  const applied = new Set(appliedRows.map((r) => r.id));

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const executed: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await db.exec(sql);
    await db.run('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)', [
      file,
      new Date().toISOString(),
    ]);
    executed.push(file);
  }
  return executed;
}
