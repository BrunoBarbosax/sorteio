import fs from 'node:fs';
import path from 'node:path';
import type { Db } from './index';

export interface MigrationFile {
  name: string;
  sql: string;
}

/**
 * Aplica as migracoes pendentes de forma idempotente.
 * Cada migracao e executada uma unica vez, registrada na tabela `schema_migrations`.
 *
 * Por padrao le os arquivos .sql de `migrations/` (dev e servidor tradicional).
 * Na Netlify o pacote da funcao nao inclui arquivos soltos do repositorio,
 * por isso o bundle embute as migracoes e as passa via `inlineFiles`.
 */
export async function migrate(
  db: Db,
  migrationsDir?: string,
  inlineFiles?: MigrationFile[],
): Promise<string[]> {
  const dir = migrationsDir || path.resolve(__dirname, '../../migrations');

  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);

  const appliedRows = await db.all<{ id: string }>('SELECT id FROM schema_migrations');
  const applied = new Set(appliedRows.map((r) => r.id));

  let files: MigrationFile[];
  if (inlineFiles && inlineFiles.length && !fs.existsSync(dir)) {
    files = inlineFiles;
  } else {
    files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((name) => ({
        name,
        sql: fs.readFileSync(path.join(dir, name), 'utf8'),
      }));
  }

  const executed: string[] = [];
  for (const file of files) {
    if (applied.has(file.name)) continue;
    await db.exec(file.sql);
    await db.run('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)', [
      file.name,
      new Date().toISOString(),
    ]);
    executed.push(file.name);
  }
  return executed;
}
