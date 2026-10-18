/** Semeia participantes de demonstracao no banco local (dev apenas). */
import { createDb } from '../db';
import { migrate } from '../db/migrate';
import { newId, nowIso } from '../lib/ids';

const NOMES: Array<[string, string]> = [
  ['Thiago Rocha', '1011'],
  ['Patricia Gomes', '1012'],
  ['Lucas Andrade', '1013'],
  ['Fernanda Dias', '1014'],
  ['Marcelo Teixeira', '1015'],
];

async function main() {
  const db = createDb();
  await migrate(db);
  for (const [name, externalId] of NOMES) {
    const exists = await db.get('SELECT id FROM participants WHERE UPPER(external_id) = ?', [
      externalId.toUpperCase(),
    ]);
    if (exists) continue;
    await db.run(
      `INSERT INTO participants (id, name, external_id, status, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?)`,
      [newId(16), name, externalId, nowIso(), nowIso()],
    );
    console.log('cadastrado:', name);
  }
  await db.close();
}

main();
