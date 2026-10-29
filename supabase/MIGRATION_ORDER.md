# Migration Run Order (canonical)

The SQL files in this folder are applied **manually in the Supabase SQL editor**, in the order below. The database does not track filenames, so this document is the source of truth for what the intended order is and which files are deprecated.

## Canonical order

| # | File | Notes |
|---|------|-------|
| 1–10 | `001` … `010` | Core phases (auth/outlets → GST reports) |
| 11 | `011_fix_created_by_columns.sql` | |
| 12 | `012_subscription_commercial_layer_v1.sql` | |
| 13 | `013_enforce_gst_rate_constraint.sql` | ⚠️ Two files share the `013` prefix (numbering mistake). Both must run; this one first. |
| 13.5 | `013_fix_payment_rounding.sql` | Second of the two `013` files. |
| 14–23 | `014` … `023` | Rounding/monetary hardening, currency, RLS fixes, hard-delete blocks |
| 24–26 | `024`, `025`, `026` | Inventory V2 (foundation → behaviour → audit) |
| 27–29 | `027`, `028`, `029` | Invoice enhancements, HSN, sequence floor |
| — | ~~`030_invoice_lifecycle_refactor.sql`~~ | **DEPRECATED — do not run.** Fails as a single transaction (uses enum values in the same transaction that adds them). Fully superseded by 030a + 030b. Kept only for history. |
| 30a | `030a_add_enum_values.sql` | Run **alone**, let it commit. |
| 30b | `030b_migrate_data.sql` | Contains all trigger/constraint/view changes from the deprecated 030. |
| 31 | `031_inventory_ledger_immutability.sql` | |
| 32 | `032_inventory_row_locking.sql` | |
| 33 | `033_fix_user_profiles_rls_recursion.sql` | |
| 34 | `034_fix_invoice_payment_transitions.sql` | Fixes finalized→paid; repairs stuck invoices. |
| 35a | `035a_add_movement_type_values.sql` | Run **alone**, let it commit (same pattern as 030a). |
| 35b | `035b_inventory_movement_category_guard.sql` | movement_category derive trigger + backfill + NOT NULL + allocation-sync rewrite + data repair. |
| 36 | `036_invoice_number_lock.sql` | Advisory lock — fixes duplicate-invoice-number race. |
| 37 | `037_harden_own_profile_update.sql` | Requires 033. Blocks self-reactivation by deactivated users. |
| 38 | `038_custom_invoice_date.sql` | Makes the invoice date (`issued_at`) user-settable so historical invoices can be re-entered. Numbering + financial year follow the invoice's own date. |
| 39 | `039_fix_report_view_status.sql` | **Fixes empty reports.** 7 report/GST views still filtered `status = 'issued'` after 030b migrated everything to `finalized`. |
| 40 | `040_secure_audit_rpcs.sql` | **Security.** Audit RPCs took the acting user as a parameter; now derived from `auth.uid()`. Requires 033. |
| 41 | `041_concurrency_and_rls_hardening.sql` | Row lock in `prevent_overpayment`; fixes 023's `item_id` typo; RLS on `inventory_migration_log`; role check on the `invoice_items` manager policy. |
| 42 | `042_bug_fixes.sql` | **Confirmed DB bug fixes, one transaction, no enum changes.** Invoices: draft items editable/deletable (issued ones locked), unpaid drafts discardable (manager DELETE policy), item amounts computed by the DB, collision-free numbering (definer scan, `outlet_short` = running per-outlet counter, no 4-digit truncation, exact prefix match, legacy floor only for the all-time counters and FY 2025-26, IST dates, draft renumbered when its date changes FY/day), event-client check, one live invoice per event, no empty finalize, client/supplier snapshot (`client_*_snap`, `supplier_gstin_snap`), `invoices.subscription_id`. Payments: IST "not in the future" rule, `payments_with_details.outlet_id`, `payments_summary()`. Reports: fan-out fixed in client/outlet reports, IST dates, per-day payments, consistent MRR, exact CGST/SGST split, deterministic `rate` + `rate_label`, `hsn_sac_code` on SEZ/Export, activity log wording. Inventory: audit RPCs work (were failing on every call), movement validation, opening-balance lock under RLS, default `opening_balance_confirmed = false`, phantom kit allocation repair, movement/damage/audit views, `reference_allocation_history`. CRM: event + subscription lifecycles, client reclassification guard, price-history names. Users: `record_login()`, `set_user_outlet_assignments()`. Requires 033, 035b, 040. |
| 43 | `043_security_hardening.sql` | **Security hardening, one transaction, no enum changes.** Requires 042 (and 033). Inventory: `inventory_allocations` SELECT-only for clients (written only by the ledger triggers, now SECURITY DEFINER); item quantities / `outlet_id` / `opening_balance_confirmed` not client-writable (stock changes only via movements; new items start at zero, unlocked); managers lose item DELETE; movement `created_by` forced to `auth.uid()` (+ `WITH CHECK created_by = auth.uid()`). Audits: read + count-only line updates (`physical_quantity`, `reason_code`, `notes`, `status`) while counting/review; status/approval only through the RPCs; only unsubmitted audits can be deleted (the app's cancel); `is_active` on every audit policy. Invoices: created as draft only; status derived from payments by a DB trigger (payments insert/void) + one-time repair; manual status changes limited to draft→finalized/cancelled and unpaid finalized→cancelled; header totals recomputed from `invoice_items`; number, number format, client/outlet/event/type/subscription link and `created_at` fixed after creation; invoice date locked once issued and range-checked (2017-07-01 … IST today); party snapshot not forgeable on drafts; client type must match invoice type. Payments: immutable except voiding (new `voided_at` / `voided_by` / `void_reason`), no reactivation, payment date not before the invoice date. Events: created as planned; frozen once completed/cancelled (notes editable). Subscriptions: created active; no back-dating by non-admins; end/start/next-billing/price rules enforced in the DB. Users: own-profile updates only `full_name`/`phone` and only while active; last active admin cannot be deactivated/demoted; nobody deactivates themselves. `created_at` not client-writable. Every SECURITY DEFINER function: `search_path = public, pg_temp`, no EXECUTE for PUBLIC/anon, authenticated only where the app or a policy/view needs it; unused settlement helpers (018) locked; no TRUNCATE/TRIGGER for API roles. **No frontend change required.** ⚠️ Re-running 042 after 043 fails at B2 (`payments_with_details` uses `p.*`, and 043 adds payment columns) — if 042 ever has to be re-run, re-run 043 after it (042 would also reset `sync_allocation_on_movement` to invoker). |

## Verification scripts (optional, run after the matching migration)

These are **not** migrations. Each wraps its checks in `BEGIN … ROLLBACK`, seeds its own throwaway fixtures, and leaves the database unchanged. Paste separately.

| Script | Checks |
|--------|--------|
| `038_verify.sql` | A back-dated invoice keeps its date through finalization and is numbered in the correct financial year; an invoice with no supplied date still defaults to today. (Inserts a line item before finalizing, as required since 042.) |
| ~~`039_verify.sql`~~ | **Not written** — the file was never added to the repo. `042_verify.sql` covers the report/GST views that 039 touched. |
| `040_041_verify.sql` | `approve_inventory_audit` rejects a caller-supplied admin uuid; the inventory-item delete guard runs; RLS is enabled on `inventory_migration_log` (the one table that lacked it — not a scan of every table); the `invoice_items` manager policy has a role check; overpayment is still rejected and exact settlement still allowed. (Inserts a line item before finalizing, as required since 042.) |
| `042_verify.sql` | Runs partly as a fake **manager** and **admin** session (`SET LOCAL ROLE authenticated` + `request.jwt.claims`). Draft item delete allowed / issued item insert-update-delete blocked; unpaid draft discard (incl. by a manager); empty draft cannot be finalized; DB-computed item tax; payment dated IST-today accepted, tomorrow rejected; `payments_summary`; `outlet_short` not colliding next day, counter past 9999, `_` in outlet codes; draft renumbered on FY change; manager numbering not colliding with an outlet it cannot see; report totals not multiplied (client with 2 subscriptions + 3 invoices); snapshot frozen against client edits; CGST+SGST = tax; `rate_label`; event-client mismatch rejected; no dispatch to a cancelled event; audit submit/approve end to end (no "ambiguous audit_id"), double-approve rejected; `set_user_outlet_assignments`; `record_login` without bumping `updated_at`. Needs permission to insert into `auth.users` (standard SQL editor). |
| `043_verify.sql` | Replays every exploit from the security review as a fake **manager**, **admin**, **accountant**, **deactivated manager** and **anon** session and requires each to fail *for the right reason* (error text matched); runs the legit app flows alongside (stock-in/return movements, item create/rename, audit create/cancel/count/submit/approve, draft invoice + items + finalize + cancel, payment record + void, event create/edit/complete, subscription create/price change/pause/resume/cycle change/cancel, own name/phone edit, `record_login`, outlet RPC); checks definer-function / table / column privileges and that ledger quantities still add up. Temporarily deactivates every other admin inside the transaction (rolled back). Needs permission to insert into `auth.users`. |

⚠️ `040_041_verify.sql` cannot prove the payment race is fixed — that needs two concurrent sessions and belongs in an integration test.

## Not migrations

- `data_reset.sql` — **DESTRUCTIVE dev/test tool.** Deletes all transactional data (invoices, payments, inventory, …). Never run against production. Kept here deliberately labelled; consider moving out of this folder.
- `config.toml` — local Supabase CLI config only; hosted project settings live in the dashboard.

## Conventions

- When a migration needs new enum values, split it: `NNNa` adds the values (run alone), `NNNb` uses them. Postgres requires `ALTER TYPE ... ADD VALUE` to commit before the values are usable.
- Never renumber or edit an already-applied migration; add a new one.
- `CREATE OR REPLACE VIEW` **resets** the view's options (e.g. `security_invoker`) to whatever its `WITH (...)` list says — an omitted list clears them. Always write `CREATE VIEW ... WITH (security_invoker = true)` or follow it with `ALTER VIEW ... SET (security_invoker = true)`. (039's closing comment says the opposite; it is wrong, but 039 itself is safe because it restates the option.)
- Security items deliberately left out of 042 (allocations read-only, movement `created_by` override, own-profile column guard, last-admin invariant) are delivered in 043. The inactive-outlet write block was refuted by the security review and is not implemented.
- New migrations continue from 044.
