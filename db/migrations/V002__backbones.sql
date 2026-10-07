-- V002: Budget "backbones" — a backbone is a set of percentage rules (must total 100%)
-- that every expense must be linked to. Presets have user_id IS NULL (global templates,
-- cloned per user); user-created backbones have user_id set and at most one active at a time.
-- percentages are stored in basis points (percent_bp): 10000 = 100%.

CREATE TABLE backbones (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id                   INTEGER REFERENCES users(id) ON DELETE CASCADE,
  slug                      TEXT,                                   -- stable key for presets, e.g. '50-30-20'
  name                      TEXT    NOT NULL,
  description               TEXT,
  source                    TEXT    NOT NULL DEFAULT 'custom' CHECK (source IN ('preset', 'custom')),
  food_leftover_category_id INTEGER REFERENCES backbone_categories(id), -- where food overspill is booked (required for custom, set before save)
  is_active                 INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  created_at                TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at                TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- At most one active backbone per user (partial index ignores preset rows).
CREATE UNIQUE INDEX uq_backbones_one_active
  ON backbones(user_id)
  WHERE user_id IS NOT NULL AND is_active = 1;

CREATE UNIQUE INDEX uq_backbones_preset_slug
  ON backbones(slug)
  WHERE slug IS NOT NULL;

CREATE INDEX idx_backbones_user ON backbones(user_id);

CREATE TABLE backbone_categories (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  backbone_id      INTEGER NOT NULL REFERENCES backbones(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  kind             TEXT    NOT NULL CHECK (kind IN ('needs', 'wants', 'savings', 'debt', 'other')),
  percent_bp       INTEGER NOT NULL CHECK (percent_bp > 0 AND percent_bp <= 10000),
  default_for_food INTEGER NOT NULL DEFAULT 0 CHECK (default_for_food IN (0, 1)), -- new food entries default here
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_categories_backbone ON backbone_categories(backbone_id);
