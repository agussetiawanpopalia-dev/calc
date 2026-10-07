-- V005: Seed budget backbone presets (global templates, cloned per user on selection)
-- Food-leftover target for every preset is the 'savings' category: savings is the
-- bucket that absorbs deviation from the plan (requirement 6, predetermined backbones).
-- Users always get a chance to review it; custom backbones must choose their own.

INSERT INTO backbones (user_id, slug, name, description, source, is_active) VALUES
  (NULL, '50-30-20', '50 / 30 / 20',
   'Elizabeth Warren''s "All Your Worth": half of income to needs, a third to wants, a fifth to savings. The most cited personal-finance split.',
   'preset', 0),
  (NULL, '70-20-10', '70 / 20 / 10',
   'Needs-heavy split for high fixed costs: 70% needs, 20% savings, 10% debt repayment or giving. Common "stabilise first" advice.',
   'preset', 0),
  (NULL, '60-20-20', '60 / 20 / 20',
   'Stricter savings variant popular in personal-finance communities: 60% needs, 20% savings, 20% wants.',
   'preset', 0),
  (NULL, '80-20', '80 / 20 (pay yourself first)',
   'Pay yourself first: move 20% to savings before anything else, spend the remaining 80% however fits your life.',
   'preset', 0);

-- Categories (order matches insert order above; percent_bp sums to 10000 per backbone)
INSERT INTO backbone_categories (backbone_id, name, kind, percent_bp, default_for_food, sort_order)
SELECT b.id, 'Needs', 'needs', 5000, 1, 0 FROM backbones b WHERE b.slug = '50-30-20';
INSERT INTO backbone_categories (backbone_id, name, kind, percent_bp, default_for_food, sort_order)
SELECT b.id, 'Wants', 'wants', 3000, 0, 1 FROM backbones b WHERE b.slug = '50-30-20';
INSERT INTO backbone_categories (backbone_id, name, kind, percent_bp, default_for_food, sort_order)
SELECT b.id, 'Savings', 'savings', 2000, 0, 2 FROM backbones b WHERE b.slug = '50-30-20';

INSERT INTO backbone_categories (backbone_id, name, kind, percent_bp, default_for_food, sort_order)
SELECT b.id, 'Needs', 'needs', 7000, 1, 0 FROM backbones b WHERE b.slug = '70-20-10';
INSERT INTO backbone_categories (backbone_id, name, kind, percent_bp, default_for_food, sort_order)
SELECT b.id, 'Savings', 'savings', 2000, 0, 1 FROM backbones b WHERE b.slug = '70-20-10';
INSERT INTO backbone_categories (backbone_id, name, kind, percent_bp, default_for_food, sort_order)
SELECT b.id, 'Debt & Giving', 'debt', 1000, 0, 2 FROM backbones b WHERE b.slug = '70-20-10';

INSERT INTO backbone_categories (backbone_id, name, kind, percent_bp, default_for_food, sort_order)
SELECT b.id, 'Needs', 'needs', 6000, 1, 0 FROM backbones b WHERE b.slug = '60-20-20';
INSERT INTO backbone_categories (backbone_id, name, kind, percent_bp, default_for_food, sort_order)
SELECT b.id, 'Savings', 'savings', 2000, 0, 1 FROM backbones b WHERE b.slug = '60-20-20';
INSERT INTO backbone_categories (backbone_id, name, kind, percent_bp, default_for_food, sort_order)
SELECT b.id, 'Wants', 'wants', 2000, 0, 2 FROM backbones b WHERE b.slug = '60-20-20';

INSERT INTO backbone_categories (backbone_id, name, kind, percent_bp, default_for_food, sort_order)
SELECT b.id, 'Living Expenses', 'needs', 8000, 1, 0 FROM backbones b WHERE b.slug = '80-20';
INSERT INTO backbone_categories (backbone_id, name, kind, percent_bp, default_for_food, sort_order)
SELECT b.id, 'Savings', 'savings', 2000, 0, 1 FROM backbones b WHERE b.slug = '80-20';

-- Preset food-leftover target = savings (best fit for predetermined backbones)
UPDATE backbones
SET food_leftover_category_id = (
      SELECT c.id FROM backbone_categories c
      WHERE c.backbone_id = backbones.id AND c.kind = 'savings'
      LIMIT 1
    ),
    updated_at = datetime('now')
WHERE source = 'preset';
