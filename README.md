# 🏆 GORJETA 77 LUKAS

Sistema completo de **cadastro público de participantes + sorteios com revelação cinematográfica**, pronto para rodar 24 horas na internet.

- **Página pública**: qualquer pessoa acessa o link, cadastra **nome + ID** e entra automaticamente na lista de elegíveis.
- **Painel administrativo protegido** (`/admin`): login com sessão segura, dashboard, gerenciamento de participantes, criação e execução de sorteios, histórico e auditoria.
- **Sorteio confiável**: seleção aleatória criptográfica no backend, **gravada no banco antes da animação**, sem repetição dentro da rodada.
- **Animação cinematográfica**: abertura, suspense com nomes embaralhados, contagem regressiva e revelação individual dos ganhadores — em tela cheia, com partículas, luzes e áudio sintetizado (Web Audio).
- **Resultados públicos**: cada sorteio autorizado ganha um endereço próprio `https://seudominio.com/sorteio/<slug>`.

---

## 📁 Estrutura do projeto

```
gorjeta-77-lukas/
├── server/                  # Backend (Node.js + Express + TypeScript)
│   ├── migrations/          # Migrações SQL (SQLite e PostgreSQL)
│   ├── src/
│   │   ├── app.ts           # Montagem do Express (rotas, segurança, estáticos)
│   │   ├── index.ts         # Boot: migra + sobe o servidor
│   │   ├── env.ts           # Variáveis de ambiente
│   │   ├── db/              # Camada de banco (SQLite nativo ou Postgres)
│   │   ├── middleware/      # Auth, CSRF, rate limit, erros
│   │   ├── modules/         # auth, participants, draws, public, admin, audit
│   │   └── scripts/         # migrate.ts, create-admin.ts
│   └── test/                # Testes automatizados (Vitest + Supertest)
├── web/                     # Frontend (React + Vite + TypeScript)
│   └── src/
│       ├── pages/           # Home, resultado público, privacidade
│       ├── pages/admin/     # Painel administrativo
│       ├── components/      # DrawShow (animação), Logo, Particles, Toast...
│       └── lib/             # cliente HTTP, tipos, formatação pt-BR
├── Dockerfile               # Imagem de produção (API + site)
├── docker-compose.yml       # App + PostgreSQL local
└── .env.example             # Modelo de configuração
```

---

## ▶️ Executar localmente (desenvolvimento)

Requisitos: **Node.js 20.11+** (recomendado 22 ou 24).

```bash
# 1) instalar dependências
npm run install:all

# 2) configurar variáveis (opcional no modo SQLite)
cp .env.example server/.env

# 3) criar o banco local (SQLite em server/data/gorjeta77.db)
npm run db:migrate --prefix server

# 4) criar o administrador inicial
ADMIN_EMAIL=admin@seusorteio.com ADMIN_PASSWORD='SuaSenhaForte123!' npm run admin:create --prefix server

# 5) subir backend (porta 4000) e frontend (porta 5173)
npm run dev:server     # terminal 1
npm run dev:web        # terminal 2
```

- Site público: http://localhost:5173
- Painel: http://localhost:5173/admin
- API/health: http://localhost:4000/healthz

> O Vite encaminha `/api` para o backend automaticamente (proxy configurado em `web/vite.config.ts`).

### Testes automatizados

```bash
npm test               # roda os testes do backend (31 testes)
```

Cobertura: cadastro público, validações, ID duplicado, persistência após reinício, proteção do painel, login/logout, CSRF, rate limit, duração mínima de 30s, quantidades variadas de ganhadores, ausência de repetição, sorteio com mais ganhadores que participantes, histórico, resultados públicos, CSV e auditoria.

### Compilação de produção local

```bash
npm run build          # compila server/dist e web/dist
npm start              # sobe o Express servindo API + site em http://localhost:4000
```

---

## 🚀 Publicar na internet

O projeto foi preparado para qualquer hospedagem **Node.js + (SQLite ou PostgreSQL)**.

### Opção A — Render.com (recomendada para começar)

1. Suba o código para um repositório GitHub.
2. No Render: **New → Web Service**, conecte o repositório.
3. Build Command: `npm install --prefix server && npm run build --prefix server && npm install --prefix web && npm run build --prefix web`
4. Start Command: `npm run db:migrate --prefix server && npm run admin:create --prefix server && npm start --prefix server`
5. Environment Variables:
   - `NODE_ENV=production`
   - `DB_CLIENT=postgres`
   - `DATABASE_URL` = *New → Database* (crie um Postgres no Render e copie a Internal URL)
   - `TRUST_PROXY=1`
   - `SESSION_TTL_HOURS=12`
   - `ADMIN_EMAIL` e `ADMIN_PASSWORD` (defina, execute o deploy e **remova a senha** em seguida)
6. Plano: o **Free** do Render suspensa o serviço após inatividade (~15 min sem acesso) e é adequado apenas para testes. Para uso contínuo 24 h use **Starter/Basic** (a partir de ~US$ 5–7/mês).

### Opção B — Railway / Fly.io / Cyclic

Mesma lógica: um serviço **Web** (Node) + um **PostgreSQL gerenciado**, com as mesmas variáveis. Railway cobra pelo uso (plano Hobby ~US$ 5/mês). Fly.io permite máquinas compartilhadas baratas (~US$ 2–4/mês).

### Opção C — VPS próprio (Hostinger, Contabo, DigitalOcean, AWS Lightsail)

```bash
# no servidor (Ubuntu 22.04+)
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
git clone https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git /opt/gorjeta77
cd /opt/gorjeta77
cp .env.example .env            # edite: ADMIN_EMAIL, ADMIN_PASSWORD, senhas do Postgres
docker compose up -d --build
```

- Aplicação em `http://SEU_IP:4000`.
- Para HTTPS e domínio, instale o **Caddy** (automático) ou **Nginx + Certbot**:

```bash
# exemplo com Caddy (aponte para a porta 4000)
sudo apt install -y caddy
echo "seudominio.com.br { reverse_proxy localhost:4000 }" | sudo tee /etc/caddy/Caddyfile
sudo systemctl reload caddy     # o HTTPS é emitido automaticamente
```

Após configurar o domínio, defina `PUBLIC_ORIGIN=https://seudominio.com.br`.

### Migração SQLite → PostgreSQL

Desenvolvimento usa SQLite (`DB_CLIENT=sqlite`) sem nenhuma mudança de código: em produção basta `DB_CLIENT=postgres` + `DATABASE_URL`. As migrações (`server/migrations/*.sql`) são escritas em SQL compatível com os dois.

Para migrar dados já cadastrados localmente:

```bash
# 1) exporte os participantes pelo painel (CSV) ou direto do banco
# 2) no servidor de produção, rode as migrações e cadastre novamente via API/painel
DB_CLIENT=postgres DATABASE_URL=... npm run db:migrate --prefix server
```

### Verificar se está tudo funcionando

```bash
curl https://seudominio.com.br/healthz         # {"ok":true,...}
curl https://seudominio.com.br/api/public/info # {"branding":"Gorjeta 77 Lukas",...}
# banco de dados (requer sessão de administrador):
curl -b cookies.txt https://seudominio.com.br/healthz/db
```

### Atualizar sem perder cadastros

- Os dados vivem no **banco** (SQLite em volume persistente ou Postgres gerenciado), nunca no código.
- Atualização padrão: `git pull && docker compose up -d --build` (migrações rodam no boot).
- No Render/Railway: basta fazer push — o deploy automático roda build + migrações.

### Backup e restauração

```bash
# Postgres (dia a dia)
docker compose exec db pg_dump -U gorjeta gorjeta77 > backup-$(date +%F).sql
# restauração
cat backup-2026-01-31.sql | docker compose exec -T db psql -U gorjeta gorjeta77

# SQLite (desenvolvimento)
cp server/data/gorjeta77.db backup-gorjeta77.db
```

Agende o backup (cron/ provedor) e guarde o arquivo fora do servidor.

---

## 🔐 Segurança implementada

| Área | Medida |
| --- | --- |
| Senhas | bcrypt (custo 12), nunca expostas em logs ou respostas |
| Sessões | token opaco em cookie `httpOnly` + `SameSite=Lax`, hash SHA-256 no banco, expiração configurável |
| CSRF | double-submit token (`gj_csrf` + header `X-CSRF-Token`) e verificação de `Origin` |
| SQL | todas as consultas com parâmetros (sem concatenação) — imune a SQL Injection |
| XSS | React (escapa por padrão) + CSP via Helmet |
| Bots/spam | rate limit por IP nas rotas públicas e administrativas, bloqueio temporário de tentativas de login |
| Sorteio | `crypto.randomInt` (CSPRNG) + Fisher-Yates sem reposição; resultado gravado **antes** da animação; trava contra execução simultânea |
| Auditoria | toda ação administrativa registrada (quem, o quê, quando) |
| Privacidade | coleta mínima (nome + ID), sem listagem pública de participantes, IPs armazenados apenas como hash |

> O sistema não promete inviolabilidade absoluta — nenhum sistema faz isso. O que está implementado são práticas reconhecidas (hash de senha, sessão opaca, CSPRNG, auditoria, HTTPS) que tornam a manipulação tecnicamente inviável para um participante comum.

---

## 🔑 Primeiro administrador

```bash
ADMIN_EMAIL=seu@email ADMIN_PASSWORD='SenhaForte123!' npm run admin:create --prefix server
```

- Pode ser executado pelo campo de env da hospedagem (Render/Railway) no primeiro deploy.
- Depois de criar, **remova `ADMIN_PASSWORD` das variáveis de ambiente**.
- Esqueceu a senha? Rode o comando novamente com a nova senha — ele atualiza a conta existente.

---

## ⚙️ Variáveis de ambiente

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `NODE_ENV` | development | `production` em produção |
| `PORT` | 4000 | porta do servidor |
| `DB_CLIENT` | sqlite | `sqlite` ou `postgres` |
| `SQLITE_PATH` | ./data/gorjeta77.db | arquivo SQLite (dev) |
| `DATABASE_URL` | — | string de conexão Postgres (produção) |
| `TRUST_PROXY` | 0 | `1` atrás de proxy (Render, Nginx) |
| `SESSION_TTL_HOURS` | 12 | duração da sessão administrativa |
| `PUBLIC_ORIGIN` | — | URL pública do site (links/origem) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | — | usados pelo `admin:create` |
| `RATE_LIMIT_DISABLED` | 0 | `1` só em testes automatizados |

---

## 🧭 Guia rápido do administrador

1. Entre em `/admin` com e-mail e senha.
2. **Dashboard** → veja totais, último sorteio e pendências.
3. **Participantes** → pesquise, edite, remova ou exporte em CSV.
4. **Criar sorteio** → nome, **quantidade de ganhadores** (digite qualquer inteiro), **duração da animação (mínimo 30s)**, estilo, som, visibilidade pública e "executar imediatamente".
5. Ao executar, o resultado é sorteado e gravado — aí a **apresentação cinematográfica** começa em tela cheia (suspense → contagem → revelação → tela final).
6. **Histórico** → consulte rodadas, filtre por período, exporte CSV e reassista à apresentação.
7. **Auditoria** → confira todas as ações administrativas.

---

## 📄 Licença e marca

Código do projeto: uso do proprietário do projeto. "Gorjeta 77 Lukas" é a marca/exibição deste sorteio.
