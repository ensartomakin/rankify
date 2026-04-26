-- T-Soft mağaza bilgileri (şifreli)
CREATE TABLE IF NOT EXISTS tsoft_credentials (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER      NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  api_url      VARCHAR(512) NOT NULL,
  store_code   VARCHAR(128) NOT NULL,
  api_user     VARCHAR(255) NOT NULL,
  api_pass_enc TEXT         NOT NULL,  -- AES-256-GCM şifreli
  api_token    TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE tsoft_credentials ADD COLUMN IF NOT EXISTS api_token TEXT;

-- Otomatik sıralama zamanlaması (kullanıcı bazlı)
-- day_hours: { "1": [5,9], "5": [17] } — gün numarası → saat listesi
CREATE TABLE IF NOT EXISTS schedule_settings (
  user_id    INTEGER   PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  is_enabled BOOLEAN   NOT NULL DEFAULT FALSE,
  day_hours  JSONB     NOT NULL DEFAULT '{}'
);
ALTER TABLE schedule_settings ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE schedule_settings ADD COLUMN IF NOT EXISTS day_hours JSONB NOT NULL DEFAULT '{}';

DROP TRIGGER IF EXISTS trg_tsoft_credentials_updated_at ON tsoft_credentials;
CREATE TRIGGER trg_tsoft_credentials_updated_at
  BEFORE UPDATE ON tsoft_credentials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Kullanıcılar
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(128),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Kategori sıralama konfigürasyonları
CREATE TABLE IF NOT EXISTS ranking_configs (
  id                     SERIAL PRIMARY KEY,
  user_id                INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id            VARCHAR(64)   NOT NULL,
  category_name          VARCHAR(255),
  availability_threshold NUMERIC(4, 3) NOT NULL DEFAULT 0.6,
  criteria               JSONB         NOT NULL,
  is_active              BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category_id)
);

-- Sıralama çalışma logları
CREATE TABLE IF NOT EXISTS audit_logs (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id        VARCHAR(64)  NOT NULL,
  triggered_by       VARCHAR(32)  NOT NULL DEFAULT 'cron',
  total_products     INTEGER,
  qualified_count    INTEGER,
  disqualified_count INTEGER,
  duration_ms        INTEGER,
  status             VARCHAR(16)  NOT NULL DEFAULT 'success',
  error_message      TEXT,
  ran_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ranking_configs_user  ON ranking_configs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user        ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ran_at      ON audit_logs (ran_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ranking_configs_updated_at ON ranking_configs;
CREATE TRIGGER trg_ranking_configs_updated_at
  BEFORE UPDATE ON ranking_configs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
