# Hybits CRM: Software Overview

> The full product map for the owner and developer: what the software is, who can do what, every module and feature, how the pieces connect, and where the gaps are.
> Written from the code as it stands on `master` on 2026-10-29 (migrations 001–043, after the bug-fix pass, migrations 042 + 043 and the UI redesign). Every feature listed here can be traced to a file in `src/` or `supabase/`.
> Several features below depend on the database having **042 and 043 applied** (see Section 6). Section 7 lists gaps, orphans and known rough edges.

---

## Contents

1. [What it is](#1-what-it-is)
2. [Roles and access](#2-roles-and-access)
   - 2.1 [Security model (what the database enforces)](#21-security-model-what-the-database-enforces)
3. [Modules](#3-modules)
   - 3.1 [Authentication and app shell](#31-authentication-and-app-shell)
   - 3.2 [Admin and configuration](#32-admin-and-configuration)
   - 3.3 [Dashboard](#33-dashboard)
   - 3.4 [Clients](#34-clients)
   - 3.5 [Subscriptions](#35-subscriptions)
   - 3.6 [Events](#36-events)
   - 3.7 [Invoices](#37-invoices)
   - 3.8 [Payments](#38-payments)
   - 3.9 [Inventory (dishware stock)](#39-inventory-dishware-stock)
   - 3.10 [Reports](#310-reports)
   - 3.11 [GST Working](#311-gst-working)
   - 3.12 [Shared UI system](#312-shared-ui-system)
4. [End-to-end workflows](#4-end-to-end-workflows)
5. [Reports catalogue](#5-reports-catalogue)
6. [Migration changelog](#6-migration-changelog)
7. [Known gaps and orphans](#7-known-gaps-and-orphans)

---

## 1. What it is

**Hybits CRM** is the private billing and operations web app of **Hybits Solutions Pvt Ltd** (Bengaluru), a business that rents sterilised dishware. It serves two kinds of customer:

- **Corporate clients** on recurring **subscriptions**, billed daily, weekly or monthly.
- **Event clients** who book one-off **events** such as weddings and functions.

Staff use it to:

- keep the client register for each outlet (branch),
- raise GST tax invoices and print them as PDFs,
- record payments, including part payments,
- track every dish sent out, returned, damaged or lost,
- run monthly stock audits,
- produce revenue, aging and GST working reports for the accountant.

### Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 single-page app, TypeScript 5 (strict), React Router 6. Every page is **code-split** (`React.lazy` per route in `AppRoutes.tsx`) and loads on first visit |
| Styling | Tailwind CSS 3 with semantic tokens (`paper`, `ink`, `rail`, status colours), Source Sans 3 / Source Code Pro from Google Fonts, lucide-react icons. Design rules live in `DESIGN.md` |
| Charts / exports | Recharts (charts), jsPDF + jspdf-autotable (invoice PDF), a shared CSV writer `src/utils/csv.ts` |
| Build | Vite 5. `npm run build` runs `tsc && vite build` and writes to `build/` |
| Backend | **No app server.** The browser talks directly to **Supabase** (Postgres + PostgREST + Auth) through `supabase-js` |
| Security | Postgres Row-Level Security on every table, `security_invoker` views, business-rule and integrity triggers, and `SECURITY DEFINER` RPCs with locked-down `EXECUTE` (see 2.1) |
| Tests | None. `npm test` / `npm run test:ui` call Playwright, but there is no Playwright config and there are no test files. `npm run lint` and `npm run type-check` pass |

### Deployment

| Item | Detail |
|---|---|
| Host | Render.com static site (`render.yaml`): `npm ci && npm run build`, publishes `./build`. PR previews are **off** (they would run branch code against the production Supabase project) |
| Routing | A catch-all rewrite sends `/*` to `/index.html`, so deep links survive a refresh |
| Security headers | `render.yaml` sets a Content-Security-Policy (self, Google Fonts, `*.supabase.co` only; no framing), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS, and long-lived caching for `/assets/*` |
| Env vars | `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are baked in at **build** time (set in the Render dashboard; `sync: false`), so changing them needs a rebuild. If either is missing, the page loads blank |
| Database changes | Migrations in `supabase/NNN_*.sql` are pasted by hand into the Supabase SQL editor, in the order given in `supabase/MIGRATION_ORDER.md`. There is no applied-migrations table |
| SEO | `index.html` sets `noindex, nofollow` |

---

## 2. Roles and access

Each user has exactly **one** role, from the Postgres enum `user_role` (001), stored in `user_profiles`.

| Role | Outlets they see | What they can do |
|---|---|---|
| **Admin** | All outlets | Everything the app offers. The only role that sees the Admin pages (Users, Outlets, Activity log, Settings), posts inventory **adjustments** (any negative one, and any after an opening balance is locked), back-dates a subscription, and **approves or rejects** stock audits. Still bound by the delete-blocking and integrity triggers. |
| **Manager** | Only outlets assigned in `user_outlet_assignments` | Create, view and update clients, subscriptions, events, invoices, payments and stock movements for assigned outlets. A manager with several outlets picks the outlet on every create form. Cannot change a client's type or move records between outlets. Can delete only an unpaid draft invoice (used to roll back a failed create, 042) and an unsubmitted audit (the app's Cancel, 043); cannot delete inventory items (043). Can create, count and submit audits. |
| **Accountant** | All outlets | **Read-only** everywhere, including payments (022). The UI hides every create, edit, send, void and payment button, and the create/edit routes and `/inventory/allocate` refuse accountants. Sees the dashboard, all reports and GST working. |

### How access is enforced (three layers)

1. **Sidebar and Ctrl+K palette** (`components/layouts/navigation.ts`): show only the links the role may open. Cosmetic only.
2. **Route guard** (`ProtectedRoute` in `AppRoutes.tsx`): requires a session and a loaded profile, and checks `allowedRoles`. A role failure goes to `/unauthorized`; a missing session goes to `/login` and comes back afterwards.
3. **Database**: RLS, triggers and privileges. This is the layer that actually enforces access (Section 2.1).

### Outlet scoping rules

- Admins and accountants get every **active** outlet loaded at login.
- A manager gets only their assigned active outlets. A manager with exactly one outlet has it pre-selected; with several, each create form (client, subscription, event, invoice, stock item) shows an outlet picker limited to their outlets.
- There is still no global outlet switcher: `setSelectedOutlet` exists in `AuthContext` but nothing calls it.
- Reports and inventory pages show an Outlet filter to admins and accountants; managers are scoped to their outlets automatically.

### 2.1 Security model (what the database enforces)

Migrations 042 and 043 move the business rules into Postgres so that a signed-in user calling the Supabase API directly with their own token gets the same answer as the app. The threat model in `043_security_hardening.sql` is: an authenticated manager or accountant calling PostgREST/RPC directly, a deactivated user with a leftover token, and anyone holding the public anon key. SQL-editor and service-role sessions (`auth.uid() IS NULL`) stay exempt from most rules so data can be repaired by hand (the last-admin rule applies to them too).

| Area | Enforced in the database |
|---|---|
| Everyone | Every policy requires `is_active = true`, so a deactivated user's token sees and changes nothing. `created_at` is never client-writable. `created_by` is forced to `auth.uid()` (019; movements 043). |
| Users | A user may update only their own `full_name` and `phone`, and only while active. The last active admin cannot be deactivated or demoted, and nobody can deactivate themselves (043). `last_login` is written by the `record_login()` RPC (042). Outlet assignment is the atomic `set_user_outlet_assignments()` RPC (042). |
| Invoices | Created only as **draft**; number, number format, client, outlet, event, type, subscription link and `created_at` fixed after creation; header totals recomputed from `invoice_items`; line amounts computed by the DB; items writable only while the invoice is a draft; invoice date range-checked (2017-07-01 … IST today) and locked once issued; client snapshot taken at finalize and not forgeable; client type must match invoice type; one live invoice per event; an empty draft cannot be finalized. **Status is derived from payments** by a trigger; the only manual status changes are draft → finalized / cancelled and unpaid finalized → cancelled. No hard deletes except an unpaid draft. |
| Payments | Immutable except voiding (active → voided, by an active admin/manager, which stamps `voided_at` / `voided_by` and keeps an optional `void_reason`). No reactivation. Payment date not in the future (IST) and not before the invoice date. Overpayment blocked under a row lock. No hard deletes. |
| Events / subscriptions | Events are created as planned and move only planned → completed / cancelled; frozen once completed or cancelled (notes stay editable); cannot be cancelled while dishes are out. Subscriptions are created active, move active ⇄ paused and → cancelled; no back-dating by non-admins; end, start, next-billing and price rules enforced; cannot be cancelled while dishes are out. |
| Inventory | Stock changes **only** through ledger movements: item quantities, `outlet_id` and `opening_balance_confirmed` are not client-writable, `inventory_allocations` is read-only for clients (maintained by owner-run ledger triggers), and movements are append-only. Audit headers change only through the audit RPCs; line items accept count-only updates while counting or in review. |
| Functions and privileges | Every `SECURITY DEFINER` function has `search_path = public, pg_temp`, no `EXECUTE` for PUBLIC/anon, and `authenticated` only where the app or a policy needs it. Unused settlement helpers (018) are locked. API roles have no `TRUNCATE` / `TRIGGER`. |

`supabase/043_verify.sql` replays each exploit from the security review as a fake manager, admin, accountant, deactivated manager and anon session, and requires each to fail for the right reason while the normal app flows still pass.

---

## 3. Modules

### 3.1 Authentication and app shell

**Purpose:** Signs staff in and out, keeps the session alive, and draws the frame (sidebar, header, jump palette, guarded pages) that every screen sits in.

**Screens**

| Route | Page | Roles |
|---|---|---|
| `/login` | LoginPage (in AuthLayout), with a "Forgot password?" mode | Public |
| `/reset-password` | ResetPasswordPage: choose a new password | Public route; works only with a session from a recovery/invite link (or an existing sign-in) |
| `/` | Redirect to `/dashboard` | Any |
| `/unauthorized` | "You don't have access to this page", with Go to dashboard | Any signed-in user |
| `*` | "Page not found", with Go to dashboard | Any signed-in user |

**Features**

1. **Email and password sign-in.** Supabase Auth checks the password, then the app loads and validates the profile (missing profile, no/invalid role or deactivated account are refused). `last_login` is recorded through the `record_login()` RPC (fire-and-forget; also once for a restored session).
2. **Deep-link return.** If a signed-out user opens a protected URL, they are sent to `/login` and, after signing in, returned to the page they asked for (path, query and hash). Only same-origin paths are accepted (`authService.safeRedirectPath`); anything else falls back to `/dashboard`.
3. **Forgot password.** "Forgot password?" on the sign-in card sends a Supabase recovery email whose link points at `<origin>/reset-password`. The page asks for the new password twice (minimum 8 characters) and then opens the dashboard. An expired or invalid link shows "Link expired" with a way back. The `PASSWORD_RECOVERY` auth event also routes there. **The `/reset-password` URL must be in the Supabase Auth redirect allow-list.**
4. **Session restore and re-validation.** The session is kept in localStorage and refreshes automatically. On start the profile is fetched (15 s timeout). On `USER_UPDATED`, a sign-in as a different user, or a sign-in/token refresh more than 10 minutes after the last check, the profile is re-loaded and re-validated, so a deactivation takes effect without a reload. A missing, inactive or invalid-role profile signs the user out everywhere (`scope: 'global'`).
5. **Profile load failure.** If the profile cannot be loaded because of the network or a timeout, the stored session is kept and a "Couldn't load your profile" screen offers Retry and Sign out.
6. **Sign out (this device only).** The sign-out button at the bottom of the sidebar ends only this browser's session (`scope: 'local'`) and clears the Supabase auth keys from storage. Other devices stay signed in.
7. **Grouped sidebar.** Groups and links (filtered by role):
   - **Overview:** Dashboard (all roles).
   - **Sales:** Clients, Subscriptions, Events, Invoices, Payments.
   - **Dishware:** Stock overview, Items, Send & receive (admin and manager), Movements, Stock audits, Stock reports.
   - **Accounts:** Reports, GST working.
   - **Admin** (admin only): Users, Outlets, Activity log, Settings.
   Every routed list page is reachable from the sidebar; detail and edit pages are reached from lists. The longest matching link is highlighted. On narrow screens the sidebar becomes a drawer opened from the header.
8. **Ctrl+K jump palette** (`CommandPalette.tsx`; Ctrl+K or Cmd+K). Searches the pages the role may open (with keywords), plus invoice numbers, client names and stock item names (5 each, RLS-scoped), with arrow-key and Enter navigation.
9. **Route protection.** Every page except Login and Reset password needs a session and a profile, plus an allowed role.
10. **Error boundaries.** A top-level `ErrorBoundary` plus one per route (reset on navigation), so a crashing page does not blank the shell. It offers Try again, Go to dashboard and Reload; the stack trace appears in dev builds only.
11. **Browser tab titles.** `useDocumentTitle` sets "Page | Hybits CRM" on every page.

**DB objects:** `auth.users`, `user_profiles`, `user_outlet_assignments`, `outlets`, RLS `users_see_own_profile` (001) and `users_update_own_profile` (037, rewritten 043), `current_user_role()` and `current_user_is_active()` (033), `record_login()` (042), `enforce_admin_invariants` (043).

**Code:** `src/pages/auth/{LoginPage,ResetPasswordPage}.tsx`, `src/contexts/AuthContext.tsx`, `src/services/authService.ts`, `src/lib/supabase.ts`, `src/routes/AppRoutes.tsx`, `src/components/ProtectedRoute.tsx`, `src/components/layouts/{MainLayout,Sidebar,AuthLayout,CommandPalette,navigation}.tsx|ts`, `src/components/ErrorBoundary.tsx`.

---

### 3.2 Admin and configuration

**Purpose:** The admin's back office for user accounts, outlet assignments, outlets, a combined activity history and system settings. This module also covers the company identity printed on invoices, which lives in code config.

**Screens** (all admin-only)

| Route | Page |
|---|---|
| `/admin/users` | UsersManagementPage |
| `/admin/outlets` | OutletsManagementPage |
| `/admin/activity-logs` | ActivityLogsPage |
| `/admin/settings` | SystemSettingsPage |

(The old, unrouted `AccessMatrixPage` has been deleted.)

**Features**

1. **User list.** Name, email, role badge, outlets (managers), Active/Inactive status and last login, with counts of active admins and managers.
2. **Deactivate or reactivate a user** after a confirmation. Deactivating yourself and deactivating the last active admin are refused by the app **and** by the database (043).
3. **Assign outlets to a manager.** Saving replaces the manager's assignments with the chosen list in one atomic RPC, `set_user_outlet_assignments` (042). At least one outlet is required. If the RPC is not deployed, the service falls back to add-first-then-remove so a failure never leaves the manager with zero outlets.
4. **Add user.** The modal explains the steps and its submit button is disabled: logins must be created in Supabase Dashboard → Authentication → Users, then a `user_profiles` row added. There is no screen to change a user's role.
5. **Outlet list with live stats.** Code, city, active users, active clients, active subscriptions, dishware out and status, with a Refresh button.
6. **Create or edit an outlet.** Fields: name, a unique upper-case code, city, address, phone and email. The code is locked after creation.
7. **Deactivate or reactivate an outlet.** Deactivation is refused while the outlet has active subscriptions, active dishware allocations or planned events (checked in the browser, `adminOutletService.canDeactivateOutlet`). Outlets are never deleted; there is no Delete action.
8. **Unified activity log.** Newest first, combining stock movements, payments (voided ones marked "[VOIDED]"), subscription created / last updated, event created / last updated, and invoices created (any status, e.g. "created (DRAFT)"). Filters: outlet, module, action and IST date range. Shows the matching total; fetches at most the latest 1000 rows and says so when more match. CSV export of the rows shown.
9. **System settings.** Grouped list with readable labels ("Payment edit window (days)"), each showing when it was last changed and **by whom**. A banner and the edit modal say **"Not yet enforced"**: nothing in the app or the database reads these values. `inventory_negative_stock_tolerance` is locked. There is no change history beyond `updated_at` / `updated_by`.
10. **Company profile and invoice defaults** (code config, `src/config/companyProfile.ts`, not a screen):
    - legal name HYBITS SOLUTIONS PRIVATE LIMITED, GSTIN `29AAHCH6039E1ZH`, phone, email, website and HDFC bank details,
    - registered office address: currently only "Bengaluru, Karnataka", marked `TODO(owner)` — it is printed as the supplier address on every tax invoice,
    - default Terms and Conditions,
    - four invoice-number formats,
    - SAC/HSN `9985` on every line.

**Key rules**

- Users and outlets are never deleted; they are deactivated. Triggers from migration 023 block hard deletes.
- Admin actions themselves (user toggles, outlet edits, settings edits, assignments) are not written to the activity log.

**DB objects:** `outlets` (001, +created_by 011, +currency 020), `user_profiles` (001, +last_login 021), `user_outlet_assignments` (001), `system_settings` (009), views `admin_users_summary` (021), `admin_outlets_summary` (009) and `admin_activity_log_unified` (042), RPCs `set_user_outlet_assignments` and `record_login` (042), triggers `block_user_profile_delete` and `block_outlet_delete` (023), `enforce_admin_invariants` (043).

**Code:** `src/pages/admin/*`, `src/components/admin/*` (incl. `settingLabel.ts`), `src/services/{adminUserService,adminOutletService,activityLogService,systemSettingsService}.ts`, `src/config/{companyProfile,gstConstants}.ts`.

---

### 3.3 Dashboard

**Purpose:** The landing page: money owed, dishes out, and what needs attention.

| Route | Page | Roles |
|---|---|---|
| `/dashboard` | DashboardPage | Admin, manager, accountant (sidebar link for all three) |

**Features**

1. **Header:** greeting, today's date and the scope ("All outlets", the outlet name, or "N outlets"). "New invoice" and "Send dishes" buttons for admin and manager. Refresh.
2. **Money strip (4 figures):**
   - **Outstanding:** total `balance_due > 0` on issued invoices (`invoices_with_payment_status`), with "N unpaid invoices".
   - **Over 30 days:** balance on unpaid invoices issued at least 30 days ago; red when above zero.
   - **Dishes out:** pieces still out (`outstanding_quantity`), "with N clients & events".
   - **Invoiced this month:** total of invoices issued since the 1st.
3. **Waiting for payment** ledger: finalized and partially paid invoices with a balance, **oldest first**, with invoice (linked), client, date, an **aging bar** (amber, red from 30 days, capped at "90+") and balance due. Shows the 12 oldest and links to Reports for the rest.
4. **Needs attention:** number of draft invoices (links to Invoices) and pieces still out (links to Send & receive).
5. **Dishes out the longest:** the 6 events or subscriptions whose dishware has been out longest (grouped by booking, earliest dispatch), with pieces and an aging bar, linked to the event or subscription.
6. **Register:** active clients and active subscriptions.

**Key rules**

- Scoped by RLS: a manager sees their own outlets.
- All queries page past 1000 rows. A figure that fails to load shows "—" and a warning names it.
- Money is shown with 2 decimals (`formatCurrency`). Day maths uses the browser's local date (IST in practice).

**DB objects:** `clients`, `subscriptions`, `invoices`, `invoices_with_payment_status` (016), `inventory_allocations_with_details` (025).
**Code:** `src/pages/dashboard/DashboardPage.tsx`, `src/services/dashboardService.ts`, `src/components/ui/AgingBar.tsx`.

---

### 3.4 Clients

**Purpose:** The customer register. Every subscription, event and invoice belongs to one client, and every client belongs to **exactly one outlet**. A company that buys from two outlets is entered twice.

**Screens**

| Route | Page | Roles |
|---|---|---|
| `/clients` | ClientsPage | Admin, manager, accountant |
| `/clients/new` | AddClientPage | Admin, manager |
| `/clients/:id` | ClientDetailPage | Admin, manager, accountant |
| `/clients/:id/edit` | EditClientPage | Admin, manager |

**Features**

1. **Client list.** Name, contact, type, phone, outlet and status. Search by name or phone, filter by type (Corporate or Event), and toggle between Active and Inactive.
2. **Add client.** Choose the type, then fill in:
   - outlet (a picker for admins and multi-outlet managers; a locked readout otherwise),
   - name (at least 2 characters), contact person,
   - phone (Indian mobile: 10 digits starting 6–9, `+91` optional), email,
   - Corporate only: GSTIN (format-checked) and **GST type** (Domestic by default, SEZ or Export),
   - billing address.
3. **Client detail.** Type and status badges, contact, clickable phone and email, GSTIN, GST type, outlet, billing address and created date, plus a **New invoice** link (`/invoices/create?client_id=…&type=…`). It does not list the client's subscriptions, events or invoices.
4. **Edit client.** Name, contact, phone, email, billing address; GSTIN and GST type for corporate clients. Type can be changed only by an admin and only while the client has no subscriptions, events or invoices. Outlet is read-only.
5. **Deactivate or reactivate** (soft delete) after a confirmation. Deactivation is refused while the client has active or paused subscriptions (service check).

**Key rules**

- **Types:** `corporate` clients are for subscriptions only and `event` clients for events only. The two billing flows never mix; invoices enforce this too (043).
- **GSTIN:** optional. If given, it must match the 15-character pattern (DB CHECK `clients_gstin_format`). The checksum is not verified.
- **GST type:** decides which GST Working sheet the client's invoices land in. A blank value counts as Domestic. Issued invoices keep the value frozen at finalize (3.7).
- **Reclassification guard (042):** a client's type or outlet cannot change once it has subscriptions, events or invoices. Managers can never change type or outlet (002).
- **Active client:** new subscriptions and events need an active client (042).
- **No hard delete:** trigger `block_client_delete` (023).
- **Attribution:** `created_by` is forced to the logged-in user (019); `created_at` is not client-writable (043).

**DB objects:** enum `client_type` (002), table `clients` (002, +`gst_type` 010), enum `client_gst_type` (010), RLS policies (002), triggers `prevent_client_reclassification` (042) and `aa_protect_created_at` (043).
**Code:** `src/pages/clients/*` (incl. `ClientParts.tsx`), `src/services/clientService.ts`, `src/utils/validation.ts`.

---

### 3.5 Subscriptions

**Purpose:** Recurring rental agreements with corporate clients. Each records an agreed quantity of dishware at a negotiated price per unit, on a daily, weekly or monthly cycle, plus an optional planned dishware kit. A subscription **records the agreement only**. Invoices are raised by hand.

**Screens**

| Route | Page | Roles |
|---|---|---|
| `/subscriptions` | SubscriptionsPage | Admin, manager, accountant |
| `/subscriptions/add` | AddSubscriptionPage | Admin, manager |
| `/subscriptions/:id` | SubscriptionDetailPage | Admin, manager, accountant |
| `/subscriptions/:id/edit` | EditSubscriptionPage | Admin, manager |

**Features**

1. **Subscription list.** Client (with outlet beneath), cycle (e.g. "Monthly (Day 15)"), quantity, price per unit, total per cycle (before GST), next billing date and status. Filter by client and status. Row actions: **New invoice** on active rows, **Resume** on paused rows.
2. **Create a subscription:**
   - outlet (picker for admins and multi-outlet managers), then a corporate client of that outlet,
   - cycle: Daily, Weekly, or Monthly with a billing day of 1–28,
   - start date, quantity and price per unit, with a live total preview,
   - **Pricing Notes / Justification** (mandatory),
   - optional **client questionnaire** (daily volume, peak challenges, washing facility, ESG priority, other context),
   - optional **standard dishware kit**: inventory items of that outlet and quantities. The kit is a **plan only**, stored in `subscriptions.questionnaire.standard_kit`; it moves no stock and creates no allocation.
3. **Subscription detail:** header with New invoice (`?client_id=`), Allocate dishware and Edit (hidden when cancelled), Pause, Resume and Cancel; a money strip (quantity, price, value per cycle, next billing date); details and pricing notes; the **planned kit**; the **questionnaire answers**; and a price-history ledger with who changed it and why.
4. **Edit a subscription.** Cycle, billing day, quantity, price and notes can change. Client, outlet and start date are read-only; the kit and questionnaire are shown read-only. Next billing date is not set by hand. Cancelled subscriptions are read-only.
5. **Price change reason and history.** A price change asks for a reason; a trigger appends old price, new price, who (`changed_by_name`, 042) and why to the price history.
6. **Price lock.** The price can no longer be changed once the client has a finalized, partly-paid or paid **subscription** invoice raised after this subscription was created (app and DB use the same client + date test; `invoices.subscription_id` is not used for this).
7. **Pause, Resume and Cancel.** Cancel sets the end date to today (never before the start date).

**Key rules**

- **Corporate, active clients only,** and the client's outlet must match (trigger `validate_subscription_business_rules`, 003/042).
- **Lifecycle (DB, 042/043):** created `active` with no end date; `active ⇄ paused`, `active/paused → cancelled`. A cancelled subscription is frozen (status, client, outlet, cycle, day, dates, quantity, price, next billing date); notes and questionnaire stay editable. The end date can change only when cancelling.
- **Cancellation guard:** the database refuses to cancel a subscription that still has dishes out, and closes its allocations on cancel (`handle_subscription_inventory_v2`, 025; SECURITY DEFINER since 043).
- **Monthly billing day:** must be 1–28 (CHECK).
- **Next billing date:** computed in the browser (`utils/billingDate.ts`) on create, on resume, and when the cycle or day changes (anchored on the later of start date and today). It is **not advanced** when an invoice is raised. Non-admins cannot set it directly (043).
- **Back-dating:** only admins may set a start date before today (IST) or change the start date (043).
- **Pricing (V1, 012):** a single composite `price_per_unit × quantity`, before GST.
- **MRR in reports (042):** monthly = qty × price; weekly × 52/12; daily × 365/12. Annual value ×12, ×52, ×365. Only active subscriptions of active clients count.
- **No hard delete** (023). Price history is append-only (012).

**DB objects:** enums `subscription_status` and `billing_cycle` (003), table `subscriptions` (003, +`questionnaire` and `price_change_reason` 012), `subscription_price_history` (012, +`changed_by_name` 042) and trigger `log_subscription_price_change`, `enforce_subscription_lifecycle` (042), subscription integrity trigger (043), `handle_subscription_inventory_v2` (025).
**Code:** `src/pages/subscriptions/*` (incl. `SubscriptionFormParts.tsx`, `SubscriptionReference.tsx`), `src/services/subscriptionService.ts`, `src/utils/billingDate.ts`.

---

### 3.6 Events

**Purpose:** One-off bookings (weddings, birthdays, corporate functions) for event clients. Staff schedule the event, send dishware out, record what comes back, mark the event completed, and then bill it.

**Screens**

| Route | Page | Roles |
|---|---|---|
| `/events` | EventsPage | Admin, manager, accountant |
| `/events/add` | AddEventPage | Admin, manager |
| `/events/:id` | EventDetailPage | Admin, manager, accountant |
| `/events/:id/edit` | EditEventPage | Admin, manager |
| `/inventory/allocate?type=event&ref=:id` | Send & receive hub (deep link) | Admin, manager |

**Features**

1. **Events list.** Grouped into Upcoming and Past; name, client, type, date, outlet, guests and status. Filter by client and status. Row action: **Complete** on planned events dated today or earlier.
2. **Create an event.** Outlet (picker when the user has more than one), an active event client of that outlet, name, optional type, date, optional guest count and notes. The event starts as `planned`.
3. **Edit a planned event.** Name, type, date, guests and notes. Client, outlet and status are read-only.
4. **Event detail:**
   - **Planned:** Send dishes, Complete (warns if dated in the future or dishes are still out), Edit, Cancel.
   - **Completed:** Create invoice (`/invoices/create?type=event&outlet_id&client_id&event_id`) and Send dishes (see Section 7.1).
   - **Dishware strip** (still out, sent, returned good, damaged or lost) and a **dishware ledger** per item from `reference_allocation_history`, including fully resolved rows: sent, returned good, damaged, lost or disposed, pending, an age bar and Record return. Shown for every status.
   - **Invoices** table for completed events.
5. **Send dishes and record returns** in modals: pick an active item with stock and a quantity (`event_dispatch` outflow); record a good return, a damaged return or a loss (damaged and lost need notes).
6. **Complete** after a confirmation. Only completed events can be invoiced.
7. **Cancel** after a confirmation. Blocked while dishes are still out (service and DB); cancelled events cannot be invoiced.

**Key rules**

- **Lifecycle (DB, 042):** `planned → completed` or `planned → cancelled`; completed and cancelled are terminal. Cancelling with dishes out is refused, and cancelling closes the allocations.
- **Frozen after the fact (043):** new events must start as planned; once completed or cancelled, name, type, date, guests, client and outlet cannot change (notes stay editable in the DB; no screen offers it).
- **Event clients only,** active, and in the event's outlet (`validate_event_business_rules`, 004/042). An invoiced event cannot change client or outlet (042).
- **Guest count:** must be > 0 if given (CHECK).
- **Deleting:** an event with an invoice, movements or allocations cannot be deleted (042). No screen offers delete.
- **Dispatch and returns:** a dispatch needs an active item with enough available stock and is accepted only for a **planned** event (042). A return or loss cannot exceed the outstanding quantity. The allocation record is created, topped up and closed by the ledger triggers.
- **Event invoices:** the event must be completed, in the same outlet, for the same client, and have no other live invoice (042).

**DB objects:** enum `event_status` and table `events` (004), triggers `validate_event_business_rules`, `enforce_manager_event_restrictions` (004), `enforce_event_lifecycle` and `check_event_delete` (042), `enforce_event_integrity` (043), view `reference_allocation_history` (042), inventory movement and allocation objects (see 3.9).
**Code:** `src/pages/events/*`, `src/services/eventService.ts`, `src/components/inventory/{AllocateInventoryModal,ReturnDamageLossModal}.tsx`, `src/services/{allocationService,inventoryMovementServiceV2}.ts`.

---

### 3.7 Invoices

**Purpose:** GST tax invoices. Each invoice is either a **Subscription** invoice (corporate client) or an **Event** invoice (a completed event). It starts as an editable draft, is **finalized** into a locked legal document that payments are recorded against, or is cancelled. It can be printed as a PDF.

**Screens**

| Route | Page | Roles |
|---|---|---|
| `/invoices` | InvoicesPage | Admin, manager, accountant |
| `/invoices/create` | CreateInvoicePage | Admin, manager |
| `/invoices/:id` | InvoiceDetailPage | Admin, manager, accountant |
| `/invoices/:id/edit` | EditInvoicePage (drafts only) | Admin, manager |

**Features**

1. **Invoice list.** Paged (50 per page, exact total), newest first. Invoice number, client, date, type, total, balance due and status, with the total outstanding and a link to Outstanding & aging. Filter by type and status. Row actions: Finalize (drafts) and Download PDF.
2. **Create an invoice (saved as a draft)** and open it straight away:
   - type, outlet (picker for admins and multi-outlet managers), client (filtered by type and outlet) and, for event invoices, a completed event that has no live invoice,
   - invoice date, line items (description, quantity, price, GST rate 0/5/12/18%), number format, editable T&C (pre-filled),
   - a live subtotal, CGST + SGST or IGST and grand total.
3. **Prefill and duplicate links** on `/invoices/create`:
   - `?duplicate=<invoiceId>` copies type, outlet, client, items, T&C and number format into a new draft (the event is kept only when the source was cancelled),
   - `?event_id=` (or `?event=`) prefills a completed event, its client and outlet, and a first line "Event name (date)",
   - `?client_id=` (or `?client=`) prefills the client, its outlet and the matching type,
   - `?type=` and `?outlet_id=` are simple hints, applied only when none of the above is given.
   Records in outlets the user cannot access are refused. Entry points: invoice detail "Duplicate as new draft", client detail and subscription "New invoice", event detail "Create invoice".
4. **Invoice date.** Defaults to today; may be in the past (not before 2017-07-01) but not the future. It drives the number's date or financial year and every report. Changing a draft's date into another day/FY renumbers the draft.
5. **Edit a draft.** Invoice date, line items and T&C can change; type, outlet, client and event are locked. Items are now editable and removable (042).
6. **Finalize.** After a confirmation, the draft becomes a frozen tax invoice and the client's name, GSTIN, address and GST type (and the outlet GSTIN) are **snapshotted** onto it.
7. **Cancel.** The invoice page offers Cancel for drafts. The database also allows cancelling an unpaid finalized invoice, but no screen offers it.
8. **Invoice detail:** status stamp, invoice date, Bill To (from the snapshot once issued), From (company, outlet, supplier GSTIN), event details, line items with HSN 9985, totals with the GST split, payments received with a running balance, T&C, bank details and timestamps. Actions: Finalize, Record payment, Edit, Download PDF, and a menu with Duplicate as new draft and Cancel invoice.
9. **PDF download** (A4, built in the browser): "TAX INVOICE" for issued invoices; "DRAFT INVOICE" with a DRAFT watermark for drafts; "CANCELLED - NOT A VALID TAX INVOICE" with a watermark for cancelled ones. File names `Invoice_<no>.pdf`, `Draft_Invoice_<no>.pdf`, `Cancelled_Invoice_<no>.pdf`.
10. **Four numbering formats**, chosen per invoice (see Key rules).

**Key business rules**

- **Lifecycle (enum `invoice_status`):**

  | From | Allowed to | How |
  |---|---|---|
  | draft | finalized, cancelled | Manual (Finalize / Cancel). An empty draft cannot be finalized (042) |
  | finalized | partially_paid, paid | **Automatic** from payments (043 trigger) |
  | finalized | cancelled | Manual, only with no active payments (DB; no UI) |
  | partially_paid ⇄ paid ⇄ finalized | | **Automatic** when payments are recorded or voided |
  | cancelled | *(terminal)* | |

  Since 043, a client cannot set `partially_paid` / `paid` / `finalized` by hand to anything other than what the payments say.
- **Lock after finalize (030b/043):** totals, T&C, number, format, client, outlet, event, type, subscription link and date are frozen; items cannot be added, changed or removed (042); a cancelled invoice cannot change at all; invoices and items are never hard-deleted, except an unpaid draft (used only to roll back a failed create).
- **Numbering (trigger `generate_invoice_number` + `next_invoice_number`, 042):**
  - The number is assigned **when the draft is created** (the toast says "Draft INV-… created"). It never changes after finalize. A draft is renumbered only if its date moves to another day/FY that its prefix no longer matches.
  - Dates and financial years (April–March) follow the invoice date in **IST**.
  - Standard `INV-YYYYMMDD-NNNN`: one global running counter.
  - Outlet + FY `INV/<CODE>/<2025-26>/NNNN`: per outlet per financial year.
  - Outlet Short `INV-<CODE>-NNNN`: **one running counter per outlet that never resets** (it used to reset daily and collide).
  - FY only `INV/<2025-26>/NNNN`: per financial year across outlets.
  - Legacy floor: the next number is at least 0031 for Standard and Outlet Short, and for the FY formats only in FY 2025-26; other FYs start at 0001.
  - Counters are computed by a `SECURITY DEFINER` helper that sees every outlet (managers no longer collide with outlets they cannot see), pad to at least 4 digits without truncating, match prefixes exactly, and are serialized by an advisory lock.
- **Amounts:** line amounts are computed by the database (042) and, in the browser, with exact paise integer maths (`utils/format.ts` `calcLineAmounts` / `calcInvoiceTotals`) so both agree:

  ```
  line_total = ROUND(qty × unit_price, 2)
  tax_amount = ROUND(line_total × rate / 100, 2)
  subtotal, tax_total = sums of the lines; grand_total = subtotal + tax_total
  ```

  Header totals are recomputed from the items by the DB while the invoice is a draft (043). Rates are limited to 0, 5, 12 and 18. Money columns are `NUMERIC(12,2)`.
- **GST split** comes only from the client's GST type (the snapshot once issued):
  - Domestic or blank: CGST = ROUND(tax/2, 2), SGST = tax − CGST (always adds up).
  - SEZ or Export: all tax is IGST.
  - There is no place-of-supply logic (Section 7.2).
- **Type rules:** an event invoice needs a completed event in the same outlet and for the same client, and an event can have only one live (non-cancelled) invoice (partial unique index, 042; skipped with a NOTICE if duplicates already existed). A subscription invoice has no event. The client must belong to the invoice's outlet, and its type must match the invoice type (043).
- **Attribution:** `created_by` is forced to the logged-in user (019).

**DB objects:** enums `invoice_type` and `invoice_status` (005, +3 values 030a), tables `invoices` (005, +T&C and format 027, +`subscription_id` and snapshot columns `client_*_snap` / `supplier_gstin_snap` 042) and `invoice_items` (005), functions and triggers `generate_invoice_number`, `next_invoice_number`, `renumber_draft_invoice`, `validate_invoice_business_rules`, `validate_invoice_status_transition`, `snapshot_invoice_parties`, item write guard and amount trigger (042), `enforce_invoice_integrity` and draft-totals trigger (043), `prevent_invoice_modification` (030b), `set_issued_at` (038), index `invoices_one_live_invoice_per_event` (042), views `invoices_with_payment_status` (016) and `invoices_with_details` (030b, unused by the app).
**Code:** `src/pages/invoices/*` (incl. `InvoiceFormParts.tsx`, `invoiceDisplay.ts`), `src/services/invoiceService.ts`, `src/utils/{invoicePdfGenerator,format}.ts`, `src/config/{companyProfile,gstConstants}.ts`.

---

### 3.8 Payments

**Purpose:** Records money received against finalized invoices, including part payments. The database keeps each invoice's paid amount, balance and status in step.

**Screens**

| Route | Page | Roles |
|---|---|---|
| `/payments` | PaymentsPage (all payments) | Admin, manager, accountant (Void is hidden for accountants) |
| `/invoices/:id` | Payments received + **Record payment** modal | Admin, manager, accountant (Record payment hidden for accountants) |

**Features**

1. **Record a payment — from the invoice.** Open the invoice and choose Record payment (the Payments page has no Add button; it links to Invoices). Fields:
   - amount (capped at the balance due),
   - method: Cash, UPI, Bank transfer, Card or Cheque,
   - date (defaults to today; not in the future and not before the invoice date),
   - optional reference (UTR or cheque number) and notes.
2. **Part payments.** Any number of payments per invoice. The invoice shows amount paid, balance due and a history with a running balance.
3. **Settlement tolerance.** A balance within ±₹0.05 counts as fully paid and is shown as ₹0.00.
4. **Overpayment prevention.** Checked in the form, in the service and in a DB trigger that locks the invoice row (041).
5. **No payments on draft or cancelled invoices** (DB trigger).
6. **Payments list.** Paged (50 per page), newest first: date, invoice (linked), client, method, reference, amount and status. Filters: method, date range and "Show voided".
7. **Totals strip** from the `payments_summary` RPC (server-side, so not capped at 1000 rows): collected (in range), number of payments, today's collections (IST), and voided count.
8. **Void a payment** (admin, manager) after a confirmation, with an **optional reason**. The DB stamps `voided_at` and `voided_by` and keeps `void_reason` (043). The balance goes back up and the invoice status reverts automatically. A voided payment can never be reactivated or edited.
9. **Automatic invoice status** after every payment or void, set by the DB trigger `sync_invoice_status_from_payments` in the same transaction (043):
   - **Paid:** money received and balance ≤ ₹0.05.
   - **Partially paid:** some money received, balance still above ₹0.05.
   - **Finalized:** nothing received.

**Key rules**

- **Amounts:** must be > 0, `NUMERIC(12,2)`, auto-rounded to 2 decimals (013).
- **Payment date:** not after today in **IST** (trigger, 042; the old UTC CHECK rejected early-morning payments) and not before the invoice date (043).
- **Immutable:** amount, date, method, invoice, reference and notes never change; corrections are void and re-record (043). Hard deletes are blocked (023).
- **Reverting status:** when an invoice falls back to finalized it keeps its number and date.
- **Role limits:** managers work only with invoices of their own outlets. Accountants are read-only (022).

**DB objects:** enum `payment_method` and table `payments` (006, +`voided_at`/`voided_by`/`void_reason` 043), triggers `prevent_overpayment` (041), `validate_payment_against_invoice` (006), IST date trigger (042), `enforce_payment_integrity` and `sync_invoice_status_from_payments` (043), `round_payment_amount` (013), `block_payment_delete` (023), views `invoices_with_payment_status` (016) and `payments_with_details` (042, +`outlet_id`), RPC `payments_summary` (042).
**Code:** `src/pages/payments/PaymentsPage.tsx`, `src/components/payments/AddPaymentModal.tsx`, `src/services/paymentService.ts`, `src/utils/{format,date}.ts`.

---

### 3.9 Inventory (dishware stock)

**Purpose:** Tracks every dish, glass and cutlery piece each outlet owns, and where it is: on the shelf, out with a client, damaged, at repair, or lost or disposed. Every change is an append-only **movement** in a ledger, and the database recalculates the stock buckets. A monthly physical count (audit) corrects stock, with admin approval where needed.

**Screens**

| Route | Page | Roles | Sidebar |
|---|---|---|---|
| `/inventory` | InventoryOverviewPage | Admin, manager, accountant | Stock overview |
| `/inventory/items` | InventoryItemsPage | Admin, manager, accountant | Items |
| `/inventory/items/:id` | InventoryItemDetailPage | Admin, manager, accountant | (from Items) |
| `/inventory/allocate` | InventoryAllocationPage (Send & receive) | Admin, manager | Send & receive |
| `/inventory/movements` | InventoryMovementsPage | Admin, manager, accountant | Movements |
| `/inventory/audit` | InventoryAuditPage | Admin, manager, accountant | Stock audits |
| `/inventory/audit/:id` | InventoryAuditDetailPage | Admin, manager, accountant | (from Stock audits) |
| `/inventory/reports` | InventoryReportsPage | Admin, manager, accountant | Stock reports |

**Features**

1. **Overview:**
   - header buttons Send dishes (admin, manager) and Items, plus an outlet filter (admin, accountant),
   - an "Audit in progress" banner,
   - a stock strip: Total pieces, Available, Out with clients, Damaged, In repair (when any), Lost (active and draft items),
   - a note when discontinued items still hold stock,
   - **Needs attention:** unlocked opening balances, pending returns, damaged stock, items in repair, and (admin) audits waiting for approval,
   - the 10 latest movements and links to every inventory page.
2. **Item catalogue.** Item, category, outlet (admin, accountant), Available, Out, Damaged, Lost, Total and status. Filters: outlet, category, Active/Inactive/All, plus URL filters used by the Overview links.
3. **Create an item with opening stock.** The item is created active with zero stock; an `opening_balance` stock-in movement then sets the shelf count.
4. **Edit an item** (name, category, material, unit) **or Deactivate it**, which makes it Discontinued. There is no reactivate or archive screen.
5. **Item detail:** lifecycle badge, stock strip and the item's full movement history. Seven actions (hidden for accountants and archived items):
   - **Add stock** (purchase or opening balance),
   - **Send out** to an active subscription or planned event,
   - **Record return** (good or damaged) against a booking,
   - **Mark damaged** (warehouse handling damage, from available),
   - **Mark lost** (missing at the outlet, or lost by a client against a booking),
   - **Dispose damaged** (end of life),
   - **Adjust stock** (admin only; increase = count correction, decrease = audit shortage; reason and notes required).
6. **Send & receive hub.** Search any subscription or event (all statuses) or arrive by deep link (`?type=subscription|event&ref=`). Shows the booking's Sent, Still out, Items and Out since, with two tabs: **Send dishes** (only for an active subscription or a planned event) and **Receive back** (Returned / Damaged / Lost per row). Subscription lookups now work (the old `subscriptions.is_active` filter is gone).
7. **Event page dishware ledger** (see 3.6). Subscription detail shows only the planned kit and an Allocate dishware link; it has no dishes-out ledger.
8. **Movement ledger.** Read-only, 50 per page with a total: time, item, outlet, type, quantity, client or event, notes and user. Filters: outlet, item, type and IST dates, plus a `?item=` deep link. CSV export fetches every matching row.
9. **Inventory reports.** Four tabs (`?tab=` deep link), each with filters, totals, a table and CSV: **Stock summary**, **Dishes out**, **Damage and loss**, **Movements**. All rows are fetched past 1000.
10. **Monthly audit: list and create.** Audits by outlet and month, status, progress, plus/minus variance and creator name (visible to every role since 042). "New audit" (admin, manager): outlet plus the current or one of the previous 11 months; the RPC snapshots the available quantity of every active or draft item.
11. **Audit count sheet:**
    - enter physical counts and see the live variance; every non-zero variance needs a reason matching its direction, plus optional notes; Save and Submit,
    - **auto-approved** only if every variance is zero, or the submitter is an admin and there are no shortages; otherwise it goes to **Pending approval**, where an admin approves (posts the plus and minus adjustments) or rejects with a reason,
    - an audit still being counted (or in review) can be cancelled, which deletes it.
12. **Item lifecycle (DB):** `draft → active → discontinued → archived`. The app creates items as active and only offers Deactivate (→ discontinued).

**Key business rules**

- **Stock buckets:** `total = available + allocated + damaged + in_repair` (CHECK `quantity_balance_v2`). `lost` is a lifetime counter outside `total`. Every bucket is ≥ 0.
- **Ledger-only writes.** Quantities are never typed in: each change is a movement, and trigger `update_inventory_quantities_v2` moves units between buckets. Since 043 the database refuses direct client writes to item quantities, `outlet_id`, the opening-balance lock and `inventory_allocations`.

| Movement category | Typical reason | Effect |
|---|---|---|
| inflow (`stock_in`) | purchase, opening_balance | +available, +total |
| outflow (`allocation`) | event_dispatch / subscription | −available, +allocated |
| return (`return` / `return_damaged`) | good / client or transit damage | −allocated, +available or +damaged |
| writeoff: warehouse damage | handling damage | −available, +damaged |
| writeoff: loss | client_lost, missing_stock | −allocated or −available, −total, +lost |
| writeoff (`disposal`) | end_of_life | −damaged, −total |
| adjustment | count correction (+) / audit shortage (−) | ±available, ±total |
| repair | send_to_repair / return_from_repair | damaged → in_repair → available (or −total if irreparable); DB only, no UI |

- **The ledger is immutable:** movements cannot be updated (031) or deleted (023). A mistake is corrected with a new adjustment. `movement_category` is always derived from `movement_type` (042). The acting user is forced to the session user (`aa_force_movement_actor` + `WITH CHECK created_by = auth.uid()`, 043).
- **Validation** (`validate_movement_v2`, latest 042):
  - quantity > 0; the outlet must match the item;
  - archived items take no movements; discontinued items take only returns and write-offs (no adjustments);
  - dispatches and returns must reference a subscription or event in the same outlet; an outflow needs an active item with enough stock and an **active subscription or planned event**;
  - a return or write-off cannot exceed what is outstanding for that booking; write-off reasons must suit the movement type and reference;
  - item and allocation rows are locked `FOR UPDATE`, so concurrent movements queue up.
- **Adjustments:** need a reason and notes. Whether an adjustment is a decrease is decided by `reason_code` only (`inventory_adjustment_is_negative`, 042). Any negative adjustment, and any adjustment after the opening balance is locked, is admin-only, and stock cannot go below zero.
- **Allocations:** one row per (item, subscription or event), written only by the ledger triggers. A dispatch creates or tops it up; full resolution closes it; reopening restarts from what was already resolved. Outstanding = allocated − (returns + write-offs), always derived.
- **Opening balance:** `opening_balance_confirmed` defaults to false (042) and locks automatically on the item's first allocation.
- **Item limits:** an item cannot be discontinued while dishes are allocated; archiving needs zero stock and no movement for 365 days; deletion needs no movements and zero stock, and only admins can delete (043; no UI).
- **Audits:** one live audit per outlet per month and at most one open audit per outlet (a rejected audit no longer blocks its month in the DB); period format `YYYY-MM`; `variance = physical − system`; physical counts ≥ 0; submit needs every line counted and a reason for every variance; the actor is always the logged-in user (040/042); header status changes only through the RPCs (043).
- **Subscription kit:** a plan in `subscriptions.questionnaire.standard_kit`; it never touches stock. 042 repaired old "phantom" kit allocations (rows with no dispatch) by moving them into the questionnaire and closing them.

**DB objects:**
- Enums: `movement_type` (008, +4 values 035a), `reference_type` (008), `audit_status` (026).
- Tables: `inventory_items` (008, +lifecycle, opening balance and repair 024), `inventory_movements` (008, +category and reason 024), `inventory_allocations` (008), `inventory_audits` and `inventory_audit_line_items` (026), `inventory_migration_log` (024).
- Triggers (latest): `derive_movement_category`, `validate_movement_v2`, `update_inventory_quantities_v2`, `lock_opening_balance_on_allocation`, `sync_allocation_on_movement` (042; definer since 043), `enforce_item_lifecycle_v2` (025), block update/delete (023/031), `guard_inventory_allocation_write`, `guard_inventory_item_direct_write`, `aa_force_movement_actor`, `guard_inventory_audit_write`, `guard_inventory_audit_line_write` (043).
- RPCs: `create_inventory_audit`, `submit_inventory_audit`, `approve_inventory_audit` (042), `check_active_audit` (026); helpers `user_display_name`, `inventory_adjustment_is_negative` (042).
- Views: `inventory_stock_summary` and `inventory_allocations_with_details` (025), `inventory_movements_with_details`, `inventory_damage_loss_report`, `inventory_audit_summary` and `reference_allocation_history` (042).

**Code:** `src/pages/inventory/*` (incl. `StockParts.tsx`, `stockDisplay.ts`), `src/components/inventory/**` (incl. `actions/*`, `AuditStatus.tsx`, `ModalParts.tsx`, `Tabs.tsx`, `movementLabels.ts`), `src/services/{inventoryService,inventoryServiceV2,inventoryMovementService,inventoryMovementServiceV2,allocationService,inventoryAuditService,inventoryReportService}.ts`.

---

### 3.10 Reports

**Purpose:** Shows how the business is doing: money billed, collected and owed, recurring income, event income, client ranking and outlet comparison. See Section 5 for the full catalogue.

| Route | Page | Roles |
|---|---|---|
| `/reports` | ReportsPage (7 tabs) | Admin, manager, accountant |

**Features**

1. **Tabs:** Revenue · Payments · Outstanding & aging · Subscriptions · Events · Client revenue · Outlet performance. Each has a totals strip, a ledger with a totals footer, a tab-specific filter, Export CSV and charts.
2. **Shared filters:** From and To dates (Revenue, Payments, Outstanding and Events only; the other tabs say the range does not apply), plus Outlet (admin and accountant, active outlets). Clear filters.
3. **Revenue:** invoiced, collected and outstanding by IST invoice date, outlet and type. "Collected" here is what has been paid on invoices issued that day; cash received in a period is the Payments tab.
4. **Payments:** collections per day × outlet × method (voided payments excluded).
5. **Outstanding & aging:** each unpaid issued invoice with its age and a bucket (0–30, 31–60, 61–90, 90+).
6. **Subscriptions (MRR):** active subscriptions of active clients with MRR and annual value (current snapshot; outlet filter only).
7. **Events:** revenue figures limited to event invoices.
8. **Client revenue:** Top 10 plus an all-clients table (active clients, all-time).
9. **Outlet performance:** clients, invoices, invoiced, collected, outstanding, collection %, subscriptions, MRR and events per active outlet (all-time).

**Key rules**

- **Which invoices count:** finalized, partially paid and paid only; drafts and cancelled invoices are excluded. Dates are IST calendar dates (042).
- **No double-counting:** client and outlet reports total invoices, subscriptions, events and clients separately before joining (042).
- **No 1000-row cap:** every tab fetches all pages (`fetchAllRows` in `reportService.ts`).
- **Aging** runs from the invoice date (IST), because there is no due-date field.
- **Collection %** = collected ÷ invoiced × 100, to 2 decimals.
- **Scoping:** views are `security_invoker`; managers additionally get an explicit outlet filter.
- **CSV:** every export goes through `src/utils/csv.ts` (quoting, formula-injection escaping, UTF-8 BOM).

**DB objects:** `report_revenue_daily`, `report_outstanding_aging`, `report_client_revenue`, `report_outlet_performance`, `report_payments_daily` and `report_subscription_mrr` (all 042).
**Code:** `src/pages/reports/{ReportsPage,ReportKit,reportFormat,useReportLoader}.ts(x)`, `src/services/reportService.ts`, `src/utils/csv.ts`.

---

### 3.11 GST Working

**Purpose:** The month-end GST sheets for the CA, in the accountant's Excel column layout.

| Route | Page | Roles |
|---|---|---|
| `/reports/gst-working` | GSTWorkingReportsPage (3 tabs) | Admin, manager, accountant |

**Features**

1. **Domestic sheet.** One row per issued invoice for Domestic or blank-GST-type clients. Columns: Invoice date, Invoice no. (linked), Party name, GSTIN, HSN/SAC (9985), As per invoice, Taxable value, Rate, IGST (0), CGST, SGST, Total.
2. **SEZ sheet.** Same layout (HSN column), with all tax in IGST and CGST/SGST at 0.
3. **Export sheet.** Same as SEZ, plus Currency (the outlet's currency, default INR).
4. **Filters:** IST invoice date range, plus Outlet (admin and accountant).
5. **Totals row** (taxable value, IGST, CGST, SGST, Total) on every sheet, also in the CSV.
6. **Download CSV** per sheet, named `gst_working_<type>_YYYY-MM-DD.csv`.

**Key rules**

- **Party snapshot:** party name, GSTIN and sheet routing use the values **frozen at finalize** (`client_*_snap`, 042), falling back to the live client only for invoices without a snapshot. Editing a client no longer rewrites or moves issued invoices. (Invoices issued before 042 were back-filled with the client's values at that time.)
- **Domestic split:** CGST = ROUND(tax/2, 2), SGST = tax − CGST, so they always add up.
- **Rate column:** `rate_label` lists the invoice's distinct rates (e.g. "5% / 18%"); `rate` is the highest rate.
- **HSN:** `hsn_sac_code` (9985) on every sheet.
- **Which invoices count:** finalized, partially paid and paid only. All rows are fetched past 1000.

**DB objects:** `gst_working_domestic`, `gst_working_sez` and `gst_working_export` (042), `gst_working_*_totals` (017/028, unused by the app), `outlets.currency` (020).
**Code:** `src/pages/reports/GSTWorkingReportsPage.tsx`, `src/services/gstReportService.ts`.

---

### 3.12 Shared UI system

**Purpose:** The building blocks every page uses. The visual rules (colour tokens, type scale, status stamps, layout) are documented in `DESIGN.md`.

**Features**

1. **App shell:** a dark-green grouped sidebar (a drawer on small screens) beside a scrolling content area, with a header that opens the Ctrl+K palette (`MainLayout`).
2. **Page header:** `ui/PageHeader` (title, description, back link, actions) on every page.
3. **Status:** `ui/StatusStamp` for invoice and document states, `ui/Badge`, and semantic colours for draft, final, partial, overdue and void.
4. **Aging:** `ui/AgingBar` for invoice and dishware ages.
5. **Toasts:** `useToast().showToast(msg, type)` for success, error, warning and info.
6. **Dialogs:** `ui/ConfirmDialog`, `admin/ConfirmationModal`, generic `ui/Modal`, and shared inventory modal parts (`inventory/ModalParts.tsx`).
7. **Form controls:** `Input`, `Select`, `Textarea`, `Button` / `LinkButton` (variants, sizes, loading state).
8. **Display components:** `Alert`, `Card`, `EmptyState`, `Spinner`.
9. **Helpers:** `formatCurrency` (₹, 2 decimals, en-IN grouping), exact paise maths (`toPaise`, `roundCurrency`, `calcInvoiceTotals`), `settleBalance` (±₹0.05), local/IST date helpers (`utils/date.ts`), safe CSV (`utils/csv.ts`), paged fetch helpers (`utils/query.ts`).

**Code:** `src/components/ui/*`, `src/contexts/ToastContext.tsx`, `src/utils/{format,date,csv,query,cn}.ts`, `tailwind.config.js`, `src/index.css`, `DESIGN.md`.

---

## 4. End-to-end workflows

### 4.1 One-time setup (admin)

```
Admin → Outlets → Create outlet (name, CODE, city…)
      → Supabase dashboard: create auth user + insert user_profiles row (role)
        (an invite whose redirect URL is <origin>/reset-password lets them set a password)
      → Users → Assign outlets (managers only)
```

### 4.2 Subscription billing (corporate client)

```
Clients → Add (type Corporate, outlet, GSTIN, GST type)
  → Subscriptions → Add (cycle, qty × price, pricing notes, optional questionnaire / planned kit)
  → Send & receive → dispatch dishes to the subscription (optional)
  → [each cycle, by hand] Subscription → New invoice (or Invoices → New invoice)
      → draft gets its number → Edit if needed → Finalize (locked, client snapshot taken)
  → Invoice → Record payment (one or many) → status follows payments: finalized → partially_paid → paid
  → Reports (Revenue, Aging, MRR, Client, Outlet) and GST Working (sheet chosen by the frozen GST type)
```

- Price changes go through Edit subscription, with a reason, and are appended to the price history. The price locks once the client has an issued subscription invoice raised after the subscription started.
- Pause, Resume and Cancel. Cancel is blocked while dishes are still out with the client.

### 4.3 Event billing (event client)

```
Clients → Add (type Event)
  → Events → Add (planned)
  → Event detail → Send dishes (available → allocated)
  → after the event → Record return (good → available | damaged → damaged | lost → lost, −total)
  → Complete event
  → Event detail → Create invoice (prefilled) → Finalize
  → Record payment(s) → Reports / GST Working
```

### 4.4 Inventory lifecycle

```
Items → Add item (+ opening stock via opening_balance movement)
  → Send out (to an active subscription or planned event; from Item detail,
    Send & receive or the event page)  ── opening balance auto-locks
  → Record return (good / damaged)  or  Mark lost (client) / Mark damaged (warehouse)
  → Dispose damaged (scrap: −damaged, −total)
  → Month end: Stock audits → New audit (snapshot) → enter counts + reasons → Submit
       ├─ all zero, or admin with no shortages → auto-approved, adjustments posted
       └─ otherwise → Pending approval → Admin approve (± adjustments) / reject
  → Movements ledger + Stock reports (CSV)
```

### 4.5 Payment reversal

```
Payments → Void (optional reason) → DB stamps voided_at / voided_by
  → invoice balance rises → status reverts automatically
  (paid → partially_paid → finalized); number and invoice date unchanged
  → record the correct payment again from the invoice if needed
```

### 4.6 Month-end GST filing

```
GST Working → set From/To to the month (and outlet if needed)
  → Domestic / SEZ / Export tabs → Download CSV for each → hand to CA
```

---

## 5. Reports catalogue

| # | Report | Where | Source (DB view) | Filters | Export |
|---|---|---|---|---|---|
| 1 | Dashboard | `/dashboard` | `clients`, `subscriptions`, `invoices`, `invoices_with_payment_status`, `inventory_allocations_with_details` | none (RLS) | — |
| 2 | Revenue | `/reports` → Revenue | `report_revenue_daily` (042) | Dates (IST invoice date), outlet, invoice type | `revenue-report.csv` |
| 3 | Payments | `/reports` → Payments | `report_payments_daily` (042) | Dates (payment date), outlet, method | `payments-report.csv` |
| 4 | Outstanding & aging | `/reports` → Outstanding & aging | `report_outstanding_aging` (042) | Dates, outlet, aging bucket | `outstanding-aging-report.csv` |
| 5 | Subscription MRR | `/reports` → Subscriptions | `report_subscription_mrr` (042) | Outlet (current snapshot) | `subscriptions-report.csv` |
| 6 | Event revenue | `/reports` → Events | `report_revenue_daily` (type = event) | Dates, outlet | `events-revenue-report.csv` |
| 7 | Client revenue | `/reports` → Client revenue | `report_client_revenue` (042) | Outlet (all-time) | `client-revenue-report.csv` |
| 8 | Outlet performance | `/reports` → Outlet performance | `report_outlet_performance` (042) | Outlet (all-time) | `outlet-performance-report.csv` |
| 9 | GST Working: Domestic | `/reports/gst-working` | `gst_working_domestic` (042) | Dates, outlet | `gst_working_domestic_<date>.csv` |
| 10 | GST Working: SEZ | `/reports/gst-working` | `gst_working_sez` (042) | Dates, outlet | `gst_working_sez_<date>.csv` |
| 11 | GST Working: Export | `/reports/gst-working` | `gst_working_export` (042) | Dates, outlet | `gst_working_export_<date>.csv` |
| 12 | Stock summary | `/inventory/reports` | `inventory_stock_summary` (025) | Outlet, category, active | `stock-summary-<date>.csv` |
| 13 | Dishes out | `/inventory/reports` | `inventory_allocations_with_details` (025) | Outlet, reference type, item | `allocation-report-<date>.csv` |
| 14 | Damage and loss | `/inventory/reports` | `inventory_damage_loss_report` (042) | Outlet, damage/loss, item, dates | `damage-loss-report-<date>.csv` |
| 15 | Movements | `/inventory/reports` | `inventory_movements_with_details` (042) | Outlet, item, type, dates | `movement-history-<date>.csv` |
| 16 | Movement ledger | `/inventory/movements` | `inventory_movements_with_details` (042) | Outlet, item, type, IST dates | `inventory-movements-<date>.csv` |
| 17 | Activity log | `/admin/activity-logs` | `admin_activity_log_unified` (042) | Outlet, module, action, IST dates | `activity-logs-<date>.csv` |

All exports are CSV built in the browser through `src/utils/csv.ts`. There is no PDF or XLSX report export; the only PDF is the invoice.

---

## 6. Migration changelog

Run in the order given in `supabase/MIGRATION_ORDER.md`. **042 and 043 are the latest; the next new file is 044.** Enum additions are split into `NNNa` (run alone) and `NNNb`.

| File | Change |
|---|---|
| 001_phase1_auth_roles_outlets | Role enum, `outlets`, `user_profiles` and `user_outlet_assignments`, base RLS |
| 002_phase2_clients | `client_type` enum, `clients` table, `set_created_by()`, manager-restriction trigger, RLS |
| 003_phase3_subscriptions | Subscription status and billing-cycle enums, `subscriptions` table, business-rule and manager triggers, RLS |
| 004_phase4_events | `event_status` enum, `events` table, business-rule and manager triggers, RLS |
| 005_phase5_invoices | `invoices` and `invoice_items` tables, numbering, validation, immutability and issued-at triggers, RLS |
| 006_phase6_payments | `payment_method` enum, `payments` table, overpayment and invoice-state triggers, `invoices_with_payment_status` |
| 007_phase7_reports | Six `report_*` views |
| 008_phase8_inventory | Inventory items, movements and allocations, V1 triggers, four inventory views |
| 009_phase9_admin | `system_settings` and the four `admin_*` views |
| 010_phase10_gst_reports | `client_gst_type` and `clients.gst_type`, GST working views and totals views |
| 011_fix_created_by_columns | `created_by` on outlets and user_profiles |
| 012_subscription_commercial_layer_v1 | Questionnaire, price-change reason, `subscription_price_history` and its trigger |
| 013_enforce_gst_rate_constraint | GST rate limited to 0/5/12/18 (run before 013_fix) |
| 013_fix_payment_rounding | ROUND() in the payment-status view and the overpayment check |
| 014_fix_invoice_rounding | Line-total and tax CHECKs use ROUND(…, 2) |
| 015_fix_payment_settlement_rounding | ₹0.05 settlement tolerance, `is_invoice_settled()` |
| 016_harden_monetary_columns | `NUMERIC(12,2)` money columns and CHECKs, all dependent views recreated |
| 017_fix_monetary_calculation_precision | Explicit numeric division in CHECKs and GST views |
| 018_fix_settlement_false_positives | Settlement and balance helper functions return false/NULL for missing invoices |
| 019_fix_audit_attribution | `created_by` forced to `auth.uid()` everywhere |
| 020_add_dynamic_currency | `outlets.currency`, export GST view uses it, `invoices_with_currency` |
| 021_fix_admin_users_view | `user_profiles.last_login`, `admin_users_summary` rebuilt |
| 022_fix_accountant_payments_rls | Accountants made read-only on payments |
| 023_block_hard_deletes | Delete-blocking triggers on all financial and master tables, with conditional rules for events and items |
| 024_inventory_v2_phase1_foundation | Lifecycle, opening-balance lock, in-repair, movement category and reason, migration log |
| 025_inventory_v2_phase2_behaviour | V2 validation, quantity and subscription-guard triggers, V2 views |
| 026_inventory_v2_phase3_audit | Audit tables, `audit_status` enum, audit RPCs, `inventory_audit_summary` |
| 027_invoice_enhancements | Per-invoice T&C, four numbering formats |
| 028_hsn_code_display | SAC 9985 column in GST views |
| 029_invoice_sequence_floor | Numbering floor of 30 |
| 030_invoice_lifecycle_refactor | **Deprecated, do not run** |
| 030a_add_enum_values | Invoice status gains finalized, partially_paid and paid |
| 030b_migrate_data | issued → finalized, new lifecycle triggers and CHECK |
| 031_inventory_ledger_immutability | Movements cannot be updated, admin RLS narrowed, indexes |
| 032_inventory_row_locking | `FOR UPDATE` locks in movement validation |
| 033_fix_user_profiles_rls_recursion | `current_user_role()` and `current_user_is_active()`, admin profile policy |
| 034_fix_invoice_payment_transitions | Allows finalized → paid and the paid reversals, repairs stuck invoices |
| 035a_add_movement_type_values | `return_damaged`, `disposal`, `send_to_repair` and `return_from_repair` |
| 035b_inventory_movement_category_guard | Category derivation, NOT NULL, allocation-sync rewrite and repair |
| 036_invoice_number_lock | Advisory lock around number generation |
| 037_harden_own_profile_update | Users cannot change their own `is_active` |
| 038_custom_invoice_date | User-set invoice date, and the number and FY follow that date |
| 038_verify | Rollback-only check for 038 (inserts a line item before finalizing, as required since 042) |
| 039_fix_report_view_status | Report and GST views count finalized, partially_paid and paid. `039_verify.sql` was never written; `042_verify.sql` covers these views |
| 040_secure_audit_rpcs | `audit_actor()`, audit RPCs take identity from `auth.uid()` |
| 041_concurrency_and_rls_hardening | Overpayment row lock, item-delete guard fix, migration-log RLS, invoice-items policy role check |
| 040_041_verify | Rollback-only check for 040 and 041 |
| 042_bug_fixes | One transaction. **Invoices:** draft items editable/deletable (issued locked), unpaid drafts discardable, DB-computed item amounts, collision-free IST numbering, event-client check, one live invoice per event, no empty finalize, party snapshot, `invoices.subscription_id`. **Payments:** IST date rule, `payments_with_details.outlet_id`, `payments_summary()`. **Reports:** fan-out fixed, IST dates, exact CGST/SGST, `rate_label`, `hsn_sac_code`, activity log rebuilt. **Inventory:** working audit RPCs, stricter movement validation, opening-balance lock under RLS, phantom kit repair, rebuilt views, `reference_allocation_history`. **CRM:** event and subscription lifecycles, reclassification guard, price-history names. **Users:** `record_login()`, `set_user_outlet_assignments()` |
| 042_verify | Rollback-only; runs partly as fake manager/admin sessions. Needs permission to insert into `auth.users` |
| 043_security_hardening | One transaction, requires 042. Database-enforced security model (Section 2.1): allocations read-only, ledger-only stock, movement actor forced, audits only via RPC, invoice status derived from payments, invoice/payment immutability and void trail, event/subscription insert/edit rules, own-profile and last-admin guards, `created_at` protection, SECURITY DEFINER sweep. Re-running 042 after 043 fails; if 042 must be re-run, re-run 043 after it |
| 043_verify | Rollback-only; replays each exploit as manager/admin/accountant/deactivated/anon and runs the legitimate flows. Needs permission to insert into `auth.users` |
| *data_reset.sql* | Not a migration. A destructive dev reset that aborts on the 023 triggers |
| *config.toml* | Local Supabase CLI only. The `seed.sql` it references does not exist |

**The current frontend expects 042 and 043.** It calls `record_login`, `set_user_outlet_assignments` (with a fallback) and `payments_summary`, reads the snapshot columns, and writes `payments.void_reason` when voiding (a column added by 043).

---

## 7. Known gaps and orphans

### 7.1 Rough edges found in the current code

- **Add user** is not possible in the app: the form explains the steps and stays disabled. Users are created in Supabase Dashboard → Authentication → Users, then a `user_profiles` row is inserted.
- **System settings** are editable but not enforced; the page says so. `payment_edit_window_days`, `invoice_auto_number` and `subscription_auto_renewal` are read by nothing.
- **"Send dishes" on a completed event** is offered on the event page, but the database accepts dispatches only to planned events (042), so it always fails. The subscription "Allocate dishware" link is also shown for paused subscriptions, where the hub will not send.
- **"Create invoice" on a completed event** is shown even when the event already has a live invoice; the create page and the DB then refuse it.
- **Event Cancel** dialog can be confirmed while dishes are out; the service then refuses it.
- **Stock audits:** the UI refuses to start a new audit for a month that already has a *rejected* audit, although the DB now allows it; "submitted for admin approval (it contains shortages)" is shown even when a manager submits a surplus-only audit; Adjust stock is offered on discontinued items, which the DB rejects.
- **Inactive outlets:** `inventory_allocations_with_details` hides allocations at deactivated outlets, so they drop out of Send & receive, Mark lost, the Overview and the dashboard "Dishes out".
- **Dashboard for accountants:** the "pieces still out" link goes to Send & receive, which accountants cannot open (403).
- **30-day boundary:** the dashboard and aging bars treat 30 days as overdue; the aging report's 0–30 bucket includes day 30.
- **Snapshot use:** only the invoice page, PDF and GST sheets use the frozen client snapshot; the aging report, dashboard ledger, client revenue and activity log show the live client name.
- **Payments report paging:** `report_payments_daily` rows are ordered by date, `invoice_id` (always NULL since 042) and method, so ties across outlets could shift between 1000-row pages on very large ranges.
- **Activity log** still fetches at most the latest 1000 rows (the page says when more match).
- **Stale code comments:** `inventoryMovementServiceV2.ts` says 042 overwrites movement `created_by` (it is 043); `subscriptionService.ts` says invoices have no `subscription_id` (the column exists since 042 but is unused).

### 7.2 Missing features

- **Invoicing is manual.** No automatic subscription invoicing (no cron or job). The next billing date is never advanced. `invoices.subscription_id` exists (042) but the app never sets or reads it.
- **No credit notes.** A finalized invoice cannot be corrected; it can only be cancelled while unpaid, and only the database (not the UI) offers that. Payments are corrected by void + re-record.
- **No place-of-supply logic.** The GST split is decided only by the client's GST type: Domestic → CGST + SGST, SEZ/Export → IGST. An inter-state domestic client (which needs IGST) cannot be invoiced correctly. **Needs a decision with the CA** before building.
- **Incomplete company address.** `src/config/companyProfile.ts` prints only "Bengaluru, Karnataka" as the supplier address (`TODO(owner)`).
- **Account screens.** No screen to change a user's role, no outlet switcher (create forms have outlet pickers), no profile page, and no "change password" link inside the app (`/reset-password` works for a signed-in user but nothing links to it).
- **Subscription dish view.** Subscription detail shows the planned kit but no dishes-out ledger (events have one).
- **Inventory repair and lifecycle actions** (send to repair, return from repair, reactivate, archive, delete) exist in the DB and partly in service code, but have no screen.
- **Void details are stored but not shown.** `void_reason`, `voided_by` and `voided_at` are saved (043) but no screen displays them.
- **Admin actions not logged.** User, outlet, assignment and settings changes do not appear in the activity log.
- **No tests or CI.** `npm test` and `npm run test:ui` run Playwright, but there is no `playwright.config` and no test files, and there is no CI pipeline. `npm run lint` and `npm run type-check` pass. The DB has rollback-only verify scripts (`038`, `040_041`, `042`, `043`).

### 7.3 Orphans (built, never used)

| Kind | Items |
|---|---|
| Unused DB views | `clients_with_outlet`, `subscriptions_with_details`, `events_with_details`, `invoices_with_details`, `invoices_with_currency`, `gst_working_*_totals`, `admin_role_permission_matrix` (its page was deleted) |
| Unused DB functions | `get_currency_symbol`, `round_currency`, `calculate_tax_amount`, `calculate_line_item`; settlement helpers `is_invoice_settled`, `get_invoice_balance`, `get_invoice_payment_status` (locked by 043); V1 `update_inventory_quantities` and `prevent_item_deletion` (their triggers were dropped in 025). `validate_movement()` was dropped by 042 and `audit_actor` is no longer callable by clients (043) |
| Unused column | `invoices.subscription_id` (042) |
| Unread DB table | `inventory_migration_log` (admin read policy, no screen) |
| Dead service code | `inventoryIntegrationHooks.ts` (an empty stub that says it is safe to delete); unused `inventoryServiceV2` / `inventoryMovementServiceV2` functions: `createInventoryItemV2`, `discontinueItemV2`, `processRepairV2`, `discontinueItem`, `reactivateItem`, `canDeleteItem`, `deleteItemV2`, plus backward-compat re-exports; `adminUserService.createUser` (always throws) |
| Unused utilities | `validation.ts`: `validateRequired`, `validateMinLength`, `validateMaxLength`, `validatePincode`, `validatePassword`. `format.ts`: `formatFileSize`, `formatBalanceAmount`, `formatBalanceStatus`, `getBalanceStatusClass`. `billingDate.ts`: `isValidBillingDay` |
| Unused UI pieces | `components/inventory/InventorySummaryCards.tsx`, `StockBreakdown` in `InventoryV2Components.tsx` |
| Missing file | `supabase/039_verify.sql` (struck out in MIGRATION_ORDER.md) |
| Archived docs | `docs/archive/PHASE1_EVENT_INVENTORY_PLAN.md`, `docs/archive/INVENTORY_UI_SIMPLIFICATION_ANALYSIS.md` (historical, 2026-02) |
