/**
 * Cria (ou atualiza a senha de) a conta administradora inicial.
 *
 * Uso:
 *   ADMIN_EMAIL=seu@email ADMIN_PASSWORD=SuaSenhaForte123! npm run admin:create
 * ou
 *   npm run admin:create -- --email seu@email --password SuaSenhaForte123!
 *
 * Em producao, defina ADMIN_EMAIL/ADMIN_PASSWORD como variaveis de ambiente
 * na hospedagem, execute o comando uma vez e remova a senha das variaveis.
 */
import bcrypt from 'bcryptjs';
import { createDb } from '../db';
import { migrate } from '../db/migrate';
import { env } from '../env';
import { newId, nowIso } from '../lib/ids';

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return undefined;
}

async function main(): Promise<void> {
  const email = (argValue('--email') || env.adminEmail || '').trim().toLowerCase();
  const password = argValue('--password') || env.adminPassword;
  const name = argValue('--name') || env.adminName || 'Administrador';

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('Defina ADMIN_EMAIL valido (ou use --email).');
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error('Defina ADMIN_PASSWORD com pelo menos 8 caracteres (ou use --password).');
    process.exit(1);
  }

  const db = createDb();
  await migrate(db);

  const existing = await db.get<{ id: string }>('SELECT id FROM admins WHERE LOWER(email) = ?', [
    email,
  ]);
  const hash = await bcrypt.hash(password, env.bcryptRounds);

  if (existing) {
    await db.run('UPDATE admins SET name = ?, password_hash = ? WHERE id = ?', [name, hash, existing.id]);
    console.log(`Administrador ${email} atualizado (nova senha definida).`);
  } else {
    await db.run(
      'INSERT INTO admins (id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [newId(20), email, name, hash, 'admin', nowIso()],
    );
    console.log(`Administrador ${email} criado com sucesso.`);
  }

  await db.close();
}

main().catch((error) => {
  console.error('Falha ao configurar administrador:', error instanceof Error ? error.message : error);
  process.exit(1);
});
