-- V006: Daily food budget + intra-month carry-over + automatic overspend re-booking
-- (requirement 5 daily-budget onboarding, requirement 6 overspend handling)
--
-- Replaces the monthly food budget + optional daily reference with ONE daily food
-- budget. Unspent daily allowance carries into the next day within the same month
-- (it compounds: a quiet day adds its full budget to tomorrow's allowance).
-- When a day out-spends its available budget, the over-budget part is re-booked
-- at view time from the day's food-linked categories to the backbone's overspend
-- target (Wants for presets). No separate posting ledger is needed anymore.

ALTER TABLE user_settings ADD COLUMN daily_food_budget INTEGER NOT NULL DEFAULT 0 CHECK (daily_food_budget >= 0);

-- Backfill: an explicit daily reference wins; otherwise monthly / 30 (rounded).
UPDATE user_settings
SET daily_food_budget =
      COALESCE(
        daily_food_ref,
        CASE WHEN monthly_food_budget > 0 THEN (monthly_food_budget + 15) / 30 ELSE 0 END
      );

-- The manual posting ledger is gone; overspend is computed per view.
DROP TABLE food_leftovers;

-- Legacy posted food-leftover transactions would double-count food now, so clear them.
DELETE FROM transactions WHERE kind = 'food_leftover';

-- The target column now absorbs daily overspend; rename it to say so.
ALTER TABLE backbones RENAME COLUMN food_leftover_category_id TO food_overspend_category_id;

-- Presets default their overspend target to the Wants bucket when they have one
-- (50/30/20, 60/20/20). Presets without a Wants bucket (70/20/10, 80/20) keep
-- their existing savings target.
UPDATE backbones
SET food_overspend_category_id = COALESCE(
      (SELECT c.id FROM backbone_categories c
        WHERE c.backbone_id = backbones.id AND c.kind = 'wants' LIMIT 1),
      food_overspend_category_id
    ),
    updated_at = datetime('now')
WHERE source = 'preset';