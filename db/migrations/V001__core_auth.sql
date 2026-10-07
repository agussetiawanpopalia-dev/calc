-- V001: Core auth — users, OTP codes, sessions
-- Conventions: all timestamps are UTC in 'YYYY-MM-DD HH:MM:SS' (sqlite datetime('now')),
-- all money amounts are INTEGER rupiah (IDR has no minor unit), all dates are 'YYYY-MM-DD'.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  phone         TEXT    NOT NULL UNIQUE,           -- E.164, e.g. +6281234567890
  display_name  TEXT,
  role          TEXT    NOT NULL DEFAULT 'user'    CHECK (role IN ('user', 'admin')),
  status        TEXT    NOT NULL DEFAULT 'active'  CHECK (status IN ('active', 'suspended')),
  locale        TEXT    NOT NULL DEFAULT 'en'      CHECK (locale IN ('en', 'id')),
  onboarded_at  TEXT,
  last_login_at TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE otp_codes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  phone        TEXT    NOT NULL,
  code         TEXT    NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  expires_at   TEXT    NOT NULL,
  consumed_at  TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_otp_phone_created ON otp_codes(phone, created_at DESC);

CREATE TABLE sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT    NOT NULL UNIQUE,            -- sha256 of the raw cookie token
  user_agent   TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at   TEXT    NOT NULL,
  revoked_at   TEXT
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
