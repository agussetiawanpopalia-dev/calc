-- V008: Switch auth from phone to email as primary identifier
-- This is a breaking schema change — recreates auth tables with email as the key.

-- 1. Drop dependent view first
DROP VIEW IF EXISTS v_admin_user_stats;

-- 2. Create new users table with email as primary unique key
CREATE TABLE users_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,           -- e.g. user@example.com
  phone         TEXT    UNIQUE,                    -- E.164, optional
  display_name  TEXT,
  role          TEXT    NOT NULL DEFAULT 'user'    CHECK (role IN ('user', 'admin')),
  status        TEXT    NOT NULL DEFAULT 'active'  CHECK (status IN ('active', 'suspended')),
  locale        TEXT    NOT NULL DEFAULT 'en'      CHECK (locale IN ('en', 'id')),
  onboarded_at  TEXT,
  last_login_at TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 3. Copy existing data (email is already populated from V007 for onboarded users)
-- For pre-V007 users without email, we can't migrate them — they'll need to sign up again.
-- This is acceptable for a pre-launch / dev database.
INSERT INTO users_new (id, email, phone, display_name, role, status, locale, onboarded_at, last_login_at, created_at, updated_at)
SELECT id, email, phone, display_name, role, status, locale, onboarded_at, last_login_at, created_at, updated_at
FROM users
WHERE email IS NOT NULL;

-- 4. Create new otp_codes table keyed by email
CREATE TABLE otp_codes_new (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT    NOT NULL,
  code         TEXT    NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  expires_at   TEXT    NOT NULL,
  consumed_at  TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 5. Migrate OTP codes (only for users that have email)
INSERT INTO otp_codes_new (id, email, code, attempts, max_attempts, expires_at, consumed_at, created_at)
SELECT o.id, u.email, o.code, o.attempts, o.max_attempts, o.expires_at, o.consumed_at, o.created_at
FROM otp_codes o
JOIN users u ON u.phone = o.phone
WHERE u.email IS NOT NULL;

-- 6. Drop old tables and rename new ones
DROP TABLE otp_codes;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
ALTER TABLE otp_codes_new RENAME TO otp_codes;

-- 7. Recreate indexes
CREATE INDEX idx_otp_email_created ON otp_codes(email, created_at DESC);
CREATE INDEX idx_users_email ON users(email);

-- 8. Recreate admin view
CREATE VIEW v_admin_user_stats AS
SELECT
  (SELECT COUNT(*) FROM users)                                            AS total_users,
  (SELECT COUNT(*) FROM users WHERE status = 'active')                    AS active_users,
  (SELECT COUNT(*) FROM users WHERE onboarded_at IS NOT NULL)             AS onboarded_users,
  (SELECT COUNT(*) FROM users WHERE date(created_at) = date('now'))       AS registered_today,
  (SELECT COUNT(*) FROM users WHERE date(created_at) >= date('now', '-7 days'))  AS registered_7d,
  (SELECT COUNT(*) FROM user_activity WHERE activity_date = date('now'))         AS dau_today,
  (SELECT COUNT(*) FROM user_activity WHERE activity_date >= date('now', '-7 days'))  AS wau_7d,
  (SELECT COUNT(*) FROM user_activity WHERE activity_date >= date('now', '-30 days')) AS mau_30d;

-- 9. Sessions table unchanged (references users.id)