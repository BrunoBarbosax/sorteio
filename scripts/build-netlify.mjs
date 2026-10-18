#!/usr/bin/env node
/**
 * Monta a pasta `netlify-dist` pronta para DEPLOY MANUAL (arrastar no Netlify).
 *
 *   node scripts/build-netlify.mjs
 *
 * Conteudo gerado:
 *   netlify-dist/
 *     index.html + assets/          site estatico (frontend compilado)
 *     netlify/functions/api.mjs     API completa empacotada (esbuild)
 *     _redirects                    /api/* -> funcao + fallback SPA
 *     netlify.toml                  config da funcao + Node 22
 *     LEIA-ME-DEPLOY.txt            passo a passo de publicacao
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'netlify-dist');
const esbuildOut = path.join(out, 'netlify', 'functions', 'api.mjs');

console.log('1/4  Compilando o frontend (web)...');
execSync('npm run build', { cwd: path.join(root, 'web'), stdio: 'inherit' });

console.log('2/4  Empacotando a API em uma funcao unica (esbuild)...');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'netlify', 'functions'), { recursive: true });
await esbuild.build({
  entryPoints: [path.join(root, 'server', 'src', 'netlify.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  minify: true,
  outfile: esbuildOut,
  external: ['pg-native'],
  // Pacotes CommonJS dentro do bundle ESM continuam usando require() dinamico,
  // e o codigo do servidor usa __dirname (resolvido aqui para o arquivo da funcao).
  banner: {
    js: [
      "import { createRequire as __cr } from 'node:module';",
      "import { fileURLToPath as __ftp } from 'node:url';",
      "import { dirname as __dp } from 'node:path';",
      'const require = __cr(import.meta.url);',
      'const __filename = __ftp(import.meta.url);',
      'const __dirname = __dp(__filename);',
    ].join('\n'),
  },
  logLevel: 'info',
});

console.log('2b/4  Copiando as migracoes (.sql) junto da funcao...');
fs.cpSync(path.join(root, 'server', 'migrations'), path.join(out, 'server-migrations'), {
  recursive: true,
});

console.log('3/4  Copiando o site estatico...');
fs.cpSync(path.join(root, 'web', 'dist'), out, { recursive: true });

console.log('4/4  Escrevendo configuracoes (_redirects, netlify.toml, LEIA-ME)...');
fs.writeFileSync(
  path.join(out, '_redirects'),
  ['# API vira funcao serverless', '/api/*    /.netlify/functions/api/:splat    200', '', '# SPA (React Router)', '/*        /index.html                        200', ''].join('\n'),
);

fs.writeFileSync(
  path.join(out, 'netlify.toml'),
  [
    '# Config aplicada na Netlify (deploy manual inclui a pasta netlify/functions)',
    '[build]',
    '  publish = "."',
    '  functions = "netlify/functions"',
    '',
    '[build.environment]',
    '  NODE_VERSION = "22"',
    '',
  ].join('\n'),
);

fs.writeFileSync(
  path.join(out, 'LEIA-ME-DEPLOY.txt'),
  [
    '====================================================================',
    ' GORJETA 77 LUKAS - PUBLICAR NA NETLIFY (deploy arrastando a pasta)',
    '====================================================================',
    '',
    'REQUISITOS: uma conta gratuita na Netlify e outra no Neon (banco Postgres).',
    '',
    'PASSO 1 - Banco de dados gratis (Neon)',
    '  1. Acesse https://neon.tech e crie uma conta gratuita.',
    '  2. Crie um projeto (plano Free) e escolha a regiao mais perto.',
    '  3. Copie a string de conexao "pooled" (comeca com postgresql:// e',
    '     termina com sslmode=require&channel_binding=require).',
    '',
    'PASSO 2 - Deploy do site (arrastar)',
    '  1. Acesse https://app.netlify.com/drop (ou: Add new site > Deploy manually).',
    '  2. Arraste ESTA PASTA (netlify-dist) inteira para a area de upload.',
    '  3. Aguarde o deploy terminar; anote o endereco gerado (ex.: nome.netlify.app).',
    '',
    'PASSO 3 - Variaveis de ambiente',
    '  No painel da Netlify: Site configuration > Environment variables > Add a variable:',
    '',
    '    DATABASE_URL     = (a string do Neon, com sslmode=require)',
    '    DB_CLIENT        = postgres',
    '    NODE_ENV         = production',
    '    TRUST_PROXY      = 1',
    '    PUBLIC_ORIGIN    = https://SEU-SITE.netlify.app',
    '    ADMIN_EMAIL      = seu-email-de-administrador',
    '    ADMIN_PASSWORD   = UmaSenhaForte123!',
    '    ADMIN_NAME       = Administrador',
    '',
    'PASSO 4 - Reimplantar para aplicar as variaveis',
    '  Deploys > Trigger deploy > Deploy site.',
    '',
    'PASSO 5 - Testar',
    '  1. Abra https://SEU-SITE.netlify.app/api/public/info  (deve mostrar JSON)',
    '  2. Cadastre um participante na pagina inicial.',
    '  3. Entre no painel https://SEU-SITE.netlify.app/admin com ADMIN_EMAIL/ADMIN_PASSWORD.',
    '',
    'SEGURANCA',
    '  - Depois do primeiro login, voce pode remover ADMIN_PASSWORD das variaveis',
    '    de ambiente (o administrador ja fica salvo no banco Postgres).',
    '  - NUNCA commite o .env ou essa senha no codigo-fonte.',
    '',
    'LIMITES DO PLANO GRATUITO (Netlify)',
    '  - Funcoes: 125.000 invocacoes/mes, timeout de 10s (suficiente para esta API).',
    '  - O banco Postgres (Neon) tem armazenamento generoso no Free.',
    '',
  ].join('\n'),
);

console.log('');
console.log(`Pronto! Pasta de deploy gerada em: ${out}`);
console.log('Arraste essa pasta em https://app.netlify.com/drop e siga o LEIA-ME-DEPLOY.txt');
