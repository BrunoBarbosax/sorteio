# ============================================================
# GORJETA 77 LUKAS - imagem de producao (backend + frontend)
# Build multi-etapa: compila o backend (tsc) e o frontend (vite)
# e roda o servidor Node servindo a API e o site estatico.
# ============================================================

FROM node:22-bookworm-slim AS build
WORKDIR /app

# backend
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --no-audit --no-fund
COPY server ./server
RUN cd server && npm run build

# frontend
COPY web/package.json web/package-lock.json* ./web/
RUN cd web && npm install --no-audit --no-fund
COPY web ./web
RUN cd web && npm run build

# ------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev --no-audit --no-fund

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/migrations ./server/migrations
COPY --from=build /app/web/dist ./web/dist

# usuario sem privilegios
RUN useradd --create-home --shell /usr/sbin/nologin app \
  && mkdir -p /app/server/data \
  && chown -R app:app /app
USER app

WORKDIR /app/server
EXPOSE 4000

# migracoes + administrador (se ADMIN_EMAIL/ADMIN_PASSWORD definidos) + servidor
CMD ["sh", "-c", "node dist/scripts/migrate.js && if [ -n \"$ADMIN_EMAIL\" ] && [ -n \"$ADMIN_PASSWORD\" ]; then node dist/scripts/create-admin.js; fi && node dist/index.js"]
