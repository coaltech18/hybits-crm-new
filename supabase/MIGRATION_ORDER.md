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

## Verification scripts (optional, run after the matching migration)

These are **not** migrations. Each wraps its checks in `BEGIN … ROLLBACK`, seeds its own throwaway fixtures, and leaves the database unchanged. Paste separately.

| Script | Checks |
|--------|--------|
| `038_verify.sql` | A back-dated invoice keeps its date through finalization and is numbered in the correct financial year; an invoice with no supplied date still defaults to today. |
| `039_verify.sql` | A finalized invoice reaches `report_revenue_daily`, `gst_working_domestic` and the inherited `_totals` view; a draft still does not. |
| `040_041_verify.sql` | `approve_inventory_audit` rejects a caller-supplied admin uuid; the inventory-item delete guard runs; RLS is on everywhere; overpayment is still rejected and exact settlement still allowed. |

⚠️ `040_041_verify.sql` cannot prove the payment race is fixed — that needs two concurrent sessions and belongs in an integration test.

## Not migrations

- `data_reset.sql` — **DESTRUCTIVE dev/test tool.** Deletes all transactional data (invoices, payments, inventory, …). Never run against production. Kept here deliberately labelled; consider moving out of this folder.
- `config.toml` — local Supabase CLI config only; hosted project settings live in the dashboard.

## Conventions

- When a migration needs new enum values, split it: `NNNa` adds the values (run alone), `NNNb` uses them. Postgres requires `ALTER TYPE ... ADD VALUE` to commit before the values are usable.
- Never renumber or edit an already-applied migration; add a new one.
- New migrations continue from 042.
