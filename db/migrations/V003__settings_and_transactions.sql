-- V003: Per-user settings, transactions, and food-leftover postings
-- Rule: every expense name is always linked to one backbone child (category).
-- Food entries are regular expenses flagged is_food=1 so they feed the daily food tracker
-- while still counting against their linked category budget (no double counting: each
-- transaction is stored once and summed once per view).

CREATE TABLE user_settings (
  user_id             INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  monthly_income      INTEGER NOT NULL DEFAULT 0 CHECK (monthly_income >= 0),
  monthly_food_budget INTEGER NOT NULL DEFAULT 0 CHECK (monthly_food_budget >= 0),
  daily_food_ref      INTEGER CHECK (daily_food_ref IS NULL OR daily_food_ref >= 0), -- NULL = computed (monthly_food_budget / days in month)
  currency            TEXT    NOT NULL DEFAULT 'IDR',
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES backbone_categories(id), -- required: expense -> backbone child
  kind        TEXT    NOT NULL DEFAULT 'expense' CHECK (kind IN ('expense', 'food_leftover')),
  name        TEXT    NOT NULL,
  amount      INTEGER NOT NULL CHECK (amount > 0),
  is_food     INTEGER NOT NULL DEFAULT 0 CHECK (is_food IN (0, 1)),
  spent_on    TEXT    NOT NULL,                                       -- 'YYYY-MM-DD'
  note        TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_tx_user_date    ON transactions(user_id, spent_on DESC);
CREATE INDEX idx_tx_user_category ON transactions(user_id, category_id);
CREATE INDEX idx_tx_user_food    ON transactions(user_id, is_food, spent_on DESC);

-- Food overspill postings: when food spend exceeds the written rule, the overspilled
-- amount is posted once to the backbone category chosen on the backbone
-- (food_leftover_category_id). Each posting records the incremental amount booked.
CREATE TABLE food_leftovers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month          TEXT    NOT NULL,                                  -- 'YYYY-MM'
  amount         INTEGER NOT NULL CHECK (amount > 0),
  category_id    INTEGER NOT NULL REFERENCES backbone_categories(id),
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_leftover_user_month ON food_leftovers(user_id, month);
