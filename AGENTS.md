# AGENTS.md

## Layout

- This is the money-calculator app: Next.js 16 + React 19 + Tailwind v4, backed by SQLite (`better-sqlite3`) via Drizzle. It is its own git repo; the workspace root `/Users/asani/@Persona` is not.
- This file mixes manual project guidance (above) with a managed Next.js agent-rules block (below, delimited by `BEGIN/END nextjs-agent-rules` HTML-comment markers). `next dev` upserts that block in place and leaves content outside the markers untouched — keep the markers intact and don't edit the block by hand.
- The iOS glass UI is built from the workspace skill at `/Users/asani/@Persona/.agents/skills/ios-glass-ui-designer/` — read it before touching any component styling. For the liquid-glass aesthetic itself, start with this CSS guide: https://www.abinandhan.in/blog/how-to-create-apples-liquid-glass-ui-style-for-the-web-complete-css-guide
- The app is bilingual; strings live in `src/lib/i18n/en.ts` (source of truth) and `id.ts` (type-enforced `Dictionary`). Any key added to `en.ts` must also be added to `id.ts`.

## Commands (run inside `money-calculator/`)

```bash
npm run dev                  # dev server on :3000 (runs migrations via predev)
npm run build                # production build (prebuild runs migrations)
PORT=3100 npm start          # the ONLY way to run the server tests expect
npm run lint                 # eslint
npx tsc --noEmit             # there is no typecheck npm script; run this manually
npm run db:migrate           # apply pending migrations
npm run db:promote-admin -- <phone>
npm run test:e2e             # API smoke test (needs server on :3100)
npm run test:ui              # Playwright computed-style audit (needs server on :3100)
npm run test:shots           # full-page screenshots → /tmp/mc-shots
```

## Operational gotchas (highest signal)

- **Stale server kills you.** Kill with `pkill -f "next-server"` — `pkill -f "next start"` misses it. A leftover server holding an old DB causes phantom test failures.
- **Fresh DB per e2e/UI run.** `test:e2e`, `test:ui`, and `test:shots` all sign up brand-new users during onboarding, so a populated DB fails `mustOnboard` paths. Reset with `rm data/money.db && npm run db:migrate`.
- **Migrations are immutable and checksummed** (Flyway-style runner in `scripts/migrate.ts`). Never edit an applied `db/migrations/V*.sql`; write a new `V00N__*.sql`.
- DB file is `data/money.db`, override with `DATABASE_PATH`, git-ignored.
- `better-sqlite3` is a native module held external in `next.config.ts` (`serverExternalPackages`) — keep it that way.

## Architecture rules

- **DDL source of truth is the SQL migrations**; `src/lib/schema.ts` is a hand-synced Drizzle mirror. When you add a migration you must mirror it in `schema.ts` and vice versa.
- **Money**: integer rupiah, no floats. **Percentages**: basis points (`10000 = 100%`). **Dates**: `YYYY-MM-DD` strings, and the browser always sends its own "today" (`?date=`/`?month=`) — the server never guesses timezones.
- Every expense links to exactly one backbone category (`transactions.category_id` NOT NULL); a category with linked expenses cannot be deleted.
- API envelope: success `{ ok: true, ... }`, error `{ ok: false, error }`.
- Next.js 16 quirks in this repo: route handler `params` are Promises, `cookies()` is async, route files export only HTTP methods (no named exports like `config`).
- This Drizzle version has **no `sql.literal`** — interpolate params directly in `sql` templates.
- The managed block at the bottom of this file (re-verified by `next dev`) points at `node_modules/next/dist/docs/` — read the relevant guide before writing any Next.js code; this Next version has breaking changes vs. training data.

## Domain model (the food rules are subtle)

- User-facing term is **"plan"** ("Rencana" in id); internal identifiers, DB tables, and API keys keep **`backbone`** (`backbones`, `backboneCategories`). Don't rename internals to "plan".
- Food is a **daily** budget (`user_settings.daily_food_budget`). Unused allowance carries to the next day within the same month and **compounds** (a quiet day adds the full daily budget to tomorrow's allowance). No daily budget set (`0`) ⇒ no carry chain, show the "set a daily food budget" hint instead of "of Rp 0".
- Overage (a day that out-spends its available budget) is **re-booked at view time** from that day's food-linked categories (walked in id order per day) to the plan's overspend target — Wants for presets, user-chosen for custom plans. There is **no posting ledger**: don't resurrect `api/food/leftover`, `food_leftovers`, or `kind='food_leftover'` transactions.
- Food entries are ordinary `transactions` with `is_food=1`, so they count against their linked category once — totals always equal actual money spent.

## Status (in-progress — this section goes stale, update it as things land)

The "7 pending fixes" refactor is **complete**: backend, dashboard/food/expenses/onboarding/settings/budget UI, i18n, e2e script, and README all use the daily-chain food math and the "plan"/overspend terminology. Verified end-to-end with a fresh `db:migrate` → `npx tsc --noEmit` → `lint` → `build` → server on :3100 → `test:e2e` (60/60) → `test:ui` (254/254).

One bug fixed along the way: with no daily food budget (`0`), `computeFoodChain()` was still reporting overage even though re-booking is skipped; overage is now gated on `daily > 0`.

Do **not** rebuild "leftover" UX — the design deliberately has no posting ledger (see Domain model). The in-training food section stays accurate to the code; only this Status block needs a bump.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->