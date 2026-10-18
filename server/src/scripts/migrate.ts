import { createDb } from '../db';
import { migrate } from '../db/migrate';

async function main(): Promise<void> {
  const db = createDb();
  const executed = await migrate(db);
  if (executed.length === 0) {
    console.log('Banco de dados atualizado. Nenhuma migracao pendente.');
  } else {
    console.log('Migracoes aplicadas:', executed.join(', '));
  }
  await db.close();
}

main().catch((error) => {
  console.error('Falha ao aplicar migracoes:', error);
  process.exit(1);
});
