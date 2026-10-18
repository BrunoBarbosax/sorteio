-- ============================================================
-- GORJETA 77 LUKAS - migracao inicial
-- Compativel com SQLite (desenvolvimento) e PostgreSQL (producao)
-- ============================================================

CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_admins_email ON admins (email);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  admin_id TEXT NOT NULL REFERENCES admins (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_sessions_token ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS ix_sessions_admin ON sessions (admin_id);

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  external_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_ip_hash TEXT
);

-- Unicidade do ID do participante, sem diferenciar maiusculas/minusculas
CREATE UNIQUE INDEX IF NOT EXISTS ux_participants_external_id ON participants (UPPER(external_id));
CREATE INDEX IF NOT EXISTS ix_participants_status ON participants (status);
CREATE INDEX IF NOT EXISTS ix_participants_created_at ON participants (created_at);
CREATE INDEX IF NOT EXISTS ix_participants_name ON participants (name);

CREATE TABLE IF NOT EXISTS draws (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  winner_count INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  style TEXT NOT NULL DEFAULT 'classic',
  sound_enabled INTEGER NOT NULL DEFAULT 1,
  public_results INTEGER NOT NULL DEFAULT 1,
  public_show_ids INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  eligible_count INTEGER,
  eligible_snapshot TEXT,
  admin_id TEXT REFERENCES admins (id) ON DELETE SET NULL,
  admin_name TEXT,
  created_at TEXT NOT NULL,
  executed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_draws_slug ON draws (slug);
CREATE INDEX IF NOT EXISTS ix_draws_status ON draws (status);
CREATE INDEX IF NOT EXISTS ix_draws_created_at ON draws (created_at);

CREATE TABLE IF NOT EXISTS draw_winners (
  id TEXT PRIMARY KEY,
  draw_id TEXT NOT NULL REFERENCES draws (id) ON DELETE CASCADE,
  participant_id TEXT,
  name TEXT NOT NULL,
  external_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_draw_winners_draw ON draw_winners (draw_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  admin_email TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  details TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs (action);
