import { createApp } from './app';
import { createDb } from './db';
import { migrate } from './db/migrate';
import { env } from './env';

async function main(): Promise<void> {
  const db = createDb();
  const executed = await migrate(db);
  if (executed.length) {
    console.log('[migracoes] aplicadas:', executed.join(', '));
  }

  const app = createApp(db);
  const server = app.listen(env.port, () => {
    console.log(`Gorjeta 77 Lukas API rodando na porta ${env.port} (${env.nodeEnv})`);
  });

  const shutdown = (signal: string) => {
    console.log(`[encerrando] sinal ${signal}`);
    server.close(() => {
      db.close().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[fatal] falha ao iniciar o servidor:', error);
  process.exit(1);
});
