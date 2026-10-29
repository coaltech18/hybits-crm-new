# Hybits CRM

The private billing and operations web app of Hybits Solutions Pvt Ltd, a sterilised-dishware rental business in Bengaluru.
It keeps the client register per outlet, raises GST tax invoices (PDF), records payments, tracks every dish sent out and returned, runs stock audits, and produces revenue, aging and GST working reports.

## Stack

- **Frontend:** React 18, TypeScript 5 (strict), React Router 6, Vite 5, Tailwind CSS 3, lucide-react icons
- **Charts and exports:** Recharts, jsPDF + jspdf-autotable (invoice PDF), CSV built in the browser
- **Backend:** Supabase (Postgres, PostgREST, Auth). There is no app server: the browser talks to Supabase directly, and security is enforced in the database (row-level security, triggers, locked-down RPCs)
- **Hosting:** Render.com static site

## Local setup

Requires Node.js 18 or newer and access to a Supabase project.

```bash
npm ci
cp .env.example .env      # then fill in the two values below
npm run dev               # http://localhost:3000
```

`.env` needs:

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API → anon public key |

Never put the `service_role` key in `.env`; everything in a `VITE_*` variable ends up in the browser bundle.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on port 3000 |
| `npm run build` | `tsc && vite build`; output goes to `build/` (not `dist/`) |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint over `src/`, zero warnings allowed |
| `npm run type-check` | `tsc --noEmit` |
| `npm test` | `test:db` then `test:e2e` |
| `npm run test:db` | Migration test in PGlite (in-process Postgres): every migration in `supabase/MIGRATION_ORDER.md` order, a seed before 042, every `*_verify.sql`, the smoke checks in `tests/db/smoke-042.sql` and the business flows in `tests/db/flows.sql` |
| `npm run test:e2e` | Playwright (Chromium): a smoke test per route, empty/error states for the dashboard and invoices, and business flows driven through the forms |
| `npm run test:ui` | Playwright UI mode |

## Tests

Neither suite talks to a real Supabase project.

- **Migrations** (`tests/db/`): `supabase-stubs.sql` emulates what hosted Supabase provides (`anon`/`authenticated`/`service_role`, `auth.users`, `auth.uid()`/`auth.jwt()`). The run order is read from `supabase/MIGRATION_ORDER.md`, and the test fails if a migration file is not listed there. After 042 it runs the verify scripts up to 042 (the state between the two manual runs), then again after the last migration. Set `MIGRATION_TEST_VERBOSE=1` to print NOTICEs. `flows.sql` runs the day-to-day flows as real admin / manager / accountant / anon sessions through RLS: invoice draft → finalize → locked → cancel; payments partial → paid → overpayment rejected → void; dishes stock in → sent to an event → returned / damaged / lost, with the ledger adding up after every step; and what each role can see and change per outlet.
- **Browser** (`tests/e2e/`): Playwright builds the app and serves it on port 4317 (`vite preview`) with a fake project URL (`https://hybits-e2e.supabase.co`), puts a fake admin session in `localStorage`, and answers every `*.supabase.co` request from `tests/e2e/support/fixtures.mjs` via `page.route`. Any other outside request fails the test. The clock is fixed at 29 Oct 2026, 14:30 IST, to match the fixtures. Each route must render without the ErrorBoundary, log no console errors, and show its heading and some fixture data. `flows.spec.ts` signs in as a manager, accountant or admin and drives the real forms: create → finalize → PDF download, record a part payment then the rest, send dishes to an event and receive them back, and what each role is offered. The mock runs in stateful mode there, so each step sees the previous one's writes, and the test checks the exact payload the app sent. First run: `npx playwright install chromium`.

CI (`.github/workflows/ci.yml`) runs `npm ci`, type-check, lint, build, `test:db` and `test:e2e` on every push to main/master and on every pull request.

## Database setup

1. Apply the SQL files in `supabase/` **by hand in the Supabase SQL editor**, in the order given in [`supabase/MIGRATION_ORDER.md`](supabase/MIGRATION_ORDER.md). The database does not record which files have run, so that file is the source of truth. Note the special cases it lists: the two `013` files, the deprecated `030` (do not run), and the `030a`/`035a` enum files that must run alone first.
2. **042 (`042_bug_fixes.sql`) and 043 (`043_security_hardening.sql`) are the latest.** Run 042, then 043. Each is one transaction: if a statement fails, nothing is applied. Read the NOTICE messages they print (e.g. skipped indexes because of duplicate data, cancelled invoices with active payments to check by hand). The current frontend expects both.
3. After a migration, run its verify script if there is one (`038_verify.sql`, `040_041_verify.sql`, `042_verify.sql`, `043_verify.sql`). They run inside `BEGIN … ROLLBACK` and leave the database unchanged. 042/043 verify need permission to insert into `auth.users` (the standard SQL editor has it).
4. `supabase/data_reset.sql` is a destructive dev tool, not a migration. Never run it against production.
5. Users are created in Supabase Dashboard → Authentication → Users, followed by a `user_profiles` row (role `admin`, `manager` or `accountant`). The app cannot create logins.
6. In Supabase → Authentication → URL Configuration, add `<your-site-origin>/reset-password` (and the local `http://localhost:3000/reset-password` if needed) to the redirect allow-list, or the "Forgot password?" emails will not land on the reset page.

## Deployment (Render)

`render.yaml` defines a static site:

- build command `npm ci && npm run build`, publish directory `./build`,
- a catch-all rewrite of `/*` to `/index.html` so deep links work on refresh,
- security headers on every path: Content-Security-Policy (self, Google Fonts and `*.supabase.co` only, no framing), `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS, and immutable caching for `/assets/*`,
- PR previews off (they would run branch code against the production database).

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be set in the Render dashboard (Environment). Vite bakes them in at **build** time, so after changing either you must trigger a new build, not just a redeploy. If they are missing, the site loads as a blank page.

## Documentation

- [`docs/SOFTWARE_OVERVIEW.md`](docs/SOFTWARE_OVERVIEW.md): the full product map (roles, every module, security model, reports, migrations, known gaps)
- [`docs/APPLICATION_WORKFLOW.md`](docs/APPLICATION_WORKFLOW.md): plain-English guide to the day-to-day workflows
- [`docs/INVENTORY_GUIDE_AND_PLAN.md`](docs/INVENTORY_GUIDE_AND_PLAN.md): how the dishware stock module works
- [`docs/RELEASE_NOTES_2026-10.md`](docs/RELEASE_NOTES_2026-10.md): what changed in the October 2026 release and the owner actions it needs
- [`PRODUCT.md`](PRODUCT.md): users, purpose and product constraints
- [`DESIGN.md`](DESIGN.md): the visual design system
- [`supabase/MIGRATION_ORDER.md`](supabase/MIGRATION_ORDER.md): migration run order and verify scripts
- `docs/archive/`: historical planning documents (superseded)
