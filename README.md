# Money Calculator

A calm, iOS-style web calculator for monthly money planning: percentage **backbones**,
mandatory category-linked expenses, daily food tracking with **intra-month carry-over**
and automatic overspend re-booking, phone-number OTP login, and full persistence in a
featherweight SQLite database.

Inspired by the reference spreadsheet (OCT2026 tab) — the sheet informed the domain model,
but the rules live in code and in your own backbone.

## Quick start

```bash
npm install
npm run dev          # migrations run automatically via predev
```

Open http://localhost:3000, sign in with any phone number, and read the OTP from:

- the API response (`devOtp` field), or
- the dev server log: `[otp] +628123456789 -> 123456 (expires in 10m)`

Production build:

```bash
npm run build        # prebuild runs migrations
PORT=3100 npm start
```

Deploying to Vercel: connect the Turso integration so `TURSO_DATABASE_URL` and
`TURSO_AUTH_TOKEN` are injected, then apply the migrations to that database once
with `MIGRATE_ALLOW_REMOTE=1 npm run db:migrate` (see Database & migrations).

## How the product works (mapped to the requirements)

| # | Requirement | Where it lives |
|---|-------------|----------------|
| 1 | Phone OTP register/login, all progress in DB | `src/app/api/auth/*`, `src/lib/auth.ts`, `sessions` table |
| 2 | Spreadsheet is reference only | Domain model in `src/lib/budget.ts`; no sheet coupling |
| 3 | Preset backbones (economic-study based) + custom, must total 100% | `V005__seed_preset_backbones.sql` (50/30/20, 70/20/10, 60/20/20, 80/20) + `validateSpec()` |
| 4 | Every expense links to one backbone child category | `POST /api/expenses` validates ownership against the user's active backbone |
| 5 | Daily food is a key input but must not dominate the dashboard | One **daily** food budget (`user_settings.daily_food_budget`); unused allowance carries into tomorrow and compounds. Compact food card on `/dashboard`; full tracker on `/food` |
| 6 | Food overspend → re-booked to a backbone category | A day over its available allowance is re-booked at view time from that day's food categories to the plan's overspend target (Wants for presets, user-chosen via `foodOverspendCategoryIndex` for custom plans). No posting ledger — see `computeFoodChain()` / `applyOverspendRebooking()` |
| 7 | Mobile responsive | Mobile-first layout, floating glass tab bar, safe-area aware |
| 8 | Lightest possible DB (~10 users first draft) | libSQL/Turso over HTTP in production, plain SQLite file locally — no database process to configure |
| 9 | All DDL in codebase, Flyway-style | `db/migrations/V*__*.sql` + checksum-validated runner |
| 10 | Admin vs regular users; admin dashboard DDL prepared, UI in backlog | `roles` column, `npm run db:promote-admin`, `V004__admin_metrics.sql` (view + audit tables) |

## Domain rules

- **Money** is stored as `INTEGER` rupiah — no floats, ever.
- **Percentages** are basis points (`10000 = 100%`), enforced to total exactly 100%.
- **Dates** are `YYYY-MM-DD` strings; the browser always sends its own "today"
  (`?date=` / `?month=`), so the server never guesses timezones.
- **Backbones**: one active per user. Switching to a preset clones it into your own row
  (yours to edit afterwards). Expenses keep pointing at your category rows; a category
  that has linked expenses **cannot be removed** until those expenses are reassigned.
- **Food is a daily budget** (`user_settings.dailyFoodBudget`). Unused allowance carries into
  the next day within the same month and **compounds**: a quiet day adds the full daily
  budget to tomorrow's allowance. No daily budget set (`0`) ⇒ no carry chain.
- **Food overspend** (a day that out-spends its available budget) is re-booked at view time
  from that day's food-linked categories (walked in `id` order) to the plan's overspend
  target. Food entries are ordinary `transactions` with `is_food=1`, so totals always equal
  actual money spent — there is no posting ledger and no `food_leftover` rows.

## Database & migrations

- Locally, data lives in a SQLite file at `data/money.db` (git-ignored). Override
  with `DATABASE_PATH`.
- In production, the app talks to a remote **Turso** database over HTTP. Set
  `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` (the Vercel Turso integration does
  this for you — see [vercel.com/marketplace/tursocloud](https://vercel.com/marketplace/tursocloud))
  and the same code switches from the local file to the remote database, with no
  other change. The env vars always win over the file.
- All DDL lives in `db/migrations/VNNN__name.sql` and is applied by
  `scripts/migrate.ts` (also run automatically by `predev` / `prebuild`).
- The runner is Flyway-style: applied files are recorded in `_migrations` with a
  **checksum**; editing an already-applied migration fails fast with an
  "immutable history" error — write a new `V00N__…` file instead.
- The runner **skips remote targets unless `MIGRATE_ALLOW_REMOTE=1`**, and skips
  altogether during the Vercel build, so `prebuild` can never hit production by
  accident. Apply production migrations explicitly, once and after every new
  migration:

```bash
npm run db:migrate                 # local file
MIGRATE_ALLOW_REMOTE=1 npm run db:migrate   # against TURSO_DATABASE_URL
npm run db:promote-admin -- 0812…  # grant admin (CLI; admin web UI is backlog)
```

> Turso enforces `PRAGMA foreign_keys` **per connection** and it is off by
> default; over stateless HTTP it can't be made to persist, so on a remote
> database the `REFERENCES … ON DELETE CASCADE` constraints are not enforced.
> The app enforces the live ones itself (expense→category ownership, and the
> "cannot delete a category that still has expenses" rule). The local file
> connection does run with `foreign_keys = ON`.

## OTP modes

`OTP_MODE` env var (default: `dev`):

- `dev` — the 6-digit code is returned in the API response and logged. Good for local drafts.
- `sms` — returns `501` until a provider is wired into the `deliverOtp` hook in
  `src/lib/auth.ts` (`requestOtp()`). The flow, cooldown, and expiry logic are already
  provider-agnostic; only the delivery call needs plugging (Twilio / WhatsApp Cloud API).

Codes: 6 digits, 10-minute expiry, 60-second resend cooldown, 5 attempt cap,
consumed on success; only the session token (httpOnly `mc_session`, sha256-hashed in DB)
is kept, never the code.

## Stack

- **Next.js 16** (App Router, Turbopack) + React 19 + Tailwind v4
- **Drizzle ORM + @libsql/client** (Turso/libSQL over HTTP in production; a plain SQLite file locally)
- **zod** request validation, **tsx** for scripts
- **i18n**: English & Bahasa Indonesia, swappable in the UI (`src/lib/i18n`,
  `en.ts` is the source of truth, `id.ts` is type-enforced against it)
- **Design**: `ios-glass-ui-designer` skill — SF Pro system typography, system grays,
  one accent (system blue), a thin/regular/thick glass material hierarchy used only for
  floating surfaces (nav bar, tab bar, sheets), iOS sheet easing
  `cubic-bezier(0.32, 0.72, 0, 1)`, 44pt+ targets, `env(safe-area-inset-*)` everywhere,
  automatic light/dark via `prefers-color-scheme`.

## API surface

```
POST /api/auth/request-otp      { phone }
POST /api/auth/verify-otp       { phone, code }      -> session cookie + mustOnboard
POST /api/auth/logout
GET  /api/me                                           -> user, settings, backbone
POST /api/onboarding            { displayName, locale, monthlyIncome, dailyFoodBudget, backbone }
GET  /api/presets
GET  /api/overview?date&month
GET|POST /api/expenses          POST { name, amount, spentOn, categoryId }
DELETE /api/expenses/:id
GET|POST /api/food              POST { name, amount, spentOn, categoryId? }
GET|PUT /api/budget             PUT { name?, categories[], foodOverspendCategoryIndex }
POST /api/budget/switch         { presetId }
GET|PUT /api/settings
```

Errors are `{ ok: false, error: string }`; success is `{ ok: true, ... }`.

## Tests

All three expect the server on `:3100` (`PORT=3100 npm start`) and run against a dev DB.

```bash
npm run test:e2e     # 60 checks: auth flow, onboarding, rule-4 ownership,
                     # daily food chain + automatic overspend re-booking,
                     # no-budget path, custom-backbone validation,
                     # budget edits + preset switch, page loads
npm run test:ui      # 254 checks: computed-style audit in headless Chromium —
                     # light/dark × mobile/desktop × every page (overflow,
                     # glass materials, safe areas, touch targets), plus a
                     # sheet open → fill → save → Escape interaction flow
npm run test:shots   # full-page screenshots to /tmp/mc-shots (visual reference)
```

`test:e2e` creates its own throwaway users; the other two sign in as the e2e users.

## Backlog

- **Admin dashboard (web UI)** — DDL is already in place (`V004__admin_metrics.sql`:
  `audit_logs`, `user_activity`, `v_admin_user_stats`); granting admin works today via
  `npm run db:promote-admin`.
- **SMS delivery provider** — plug into the `deliverOtp` hook, flip `OTP_MODE=sms`.
- Recurring expenses, CSV export, category budgets per backbone child.
