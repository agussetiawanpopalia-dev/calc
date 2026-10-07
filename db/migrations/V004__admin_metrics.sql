-- V004: Admin & analytics DDL (requirement 10)
-- WEB BACKLOG: these tables/views are ready but no admin UI is built in v1.
-- They back the future admin dashboard: total registered, active (DAU/WAU/MAU),
-- registrations over time, and an audit trail.

CREATE TABLE audit_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action        TEXT    NOT NULL,                 -- e.g. 'user.login', 'backbone.update'
  entity        TEXT,
  entity_id     TEXT,
  metadata      TEXT,                             -- JSON payload
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_actor_created ON audit_logs(actor_user_id, created_at DESC);

CREATE TABLE user_activity (
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_date TEXT    NOT NULL,                 -- 'YYYY-MM-DD'
  events        INTEGER NOT NULL DEFAULT 0,
  last_seen_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, activity_date)
);

CREATE INDEX idx_activity_date ON user_activity(activity_date);

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
