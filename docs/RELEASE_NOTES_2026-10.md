# Release notes — October 2026

This release is a large bug-fix pass, two database migrations (042 and 043) and a full redesign of the app's look and navigation. Full details are in [SOFTWARE_OVERVIEW.md](SOFTWARE_OVERVIEW.md).

## Fixes

**Invoices**
- Editing a draft invoice now works (it used to fail whenever the draft had line items).
- "Duplicate as new draft" now copies the invoice. Client, subscription and event pages have New invoice / Create invoice shortcuts that pre-fill the form.
- Totals are calculated exactly to the paisa, so saving no longer fails on a one-paisa rounding difference.
- Invoice numbers no longer collide: "Outlet short" numbers (`INV-<CODE>-NNNN`) are one running series per outlet, managers no longer clash with outlets they cannot see, and dates and financial years follow Indian time.
- An event can only have one live invoice, and an empty draft can't be finalized.
- The client's name, GSTIN, address and GST type are frozen onto the invoice when it is finalized. Editing a client later no longer changes old invoices or moves them to a different GST sheet.
- Paid / part-paid status is now set by the database whenever a payment is recorded or voided, so it can't get stuck or go wrong.

**Payments**
- Payments made just after midnight (Indian time) are no longer rejected as "in the future".
- The Payments page is paged and its totals are calculated on the server, so they're correct beyond 1,000 payments.
- Voiding a payment can include a reason. The system records who voided it and when.

**Events and subscriptions**
- Event and subscription status changes follow fixed rules. For example, a completed event can't go back to planned, and nothing can be cancelled while dishes are still out.
- Event pages show a full dishware history: sent, returned, damaged, lost and still out.
- A subscription's planned dishware kit is kept as a plan, shown on the subscription page with the questionnaire answers. It no longer appears as stock that went out.
- Managers with more than one outlet can choose the outlet on every "new" form.

**Dishware (inventory)**
- Sending dishes to subscriptions and receiving them back now works. Previously subscriptions could not be found.
- "Record return" on the item page works.
- Monthly stock audits can be created, submitted and approved end to end. They used to fail on submit.
- Stock can only change through recorded movements, each stamped with the real signed-in user.

**Reports**
- Client and outlet reports no longer double-count invoices.
- Every report, the dashboard and GST working read past 1,000 rows.
- CSV exports are safe to open in Excel: values that start with `=`, `+`, `-` or `@` cannot run as formulas.
- GST sheets show every rate on an invoice (e.g. "5% / 18%"), the HSN/SAC code on every sheet, and a CGST/SGST split that always adds up to the tax.

**Admin**
- Assigning outlets to a manager saves in one step, so a manager can't end up with no outlets.
- The "Delete outlet" action, which could never work, is gone. Outlets are deactivated instead.
- Settings now say "Not yet enforced" and show who last changed each one.

## Security

- The database now enforces the business rules itself. Someone calling it directly with a manager, accountant or old login gets the same refusals as the app.
- Accountants are strictly read-only, and deactivated users can do nothing.
- Nobody can deactivate themselves, and the last active admin can't be removed.
- Issued invoices and payments can't be altered. Payments can only be voided.
- Signing out ends the session on this device only. If an account is deactivated, every device is signed out.
- Your profile is re-checked in the background, so a deactivation takes effect without a page reload.
- New **Forgot password?** link on the sign-in page, with a `/reset-password` page to choose a new password.
- The website sends strict security headers (content security policy, no framing, HSTS).

## New look & navigation

- A new design with a clear status stamp on every invoice, plus aging bars for money owed and dishes out.
- A grouped sidebar (Overview / Sales / Dishware / Accounts / Admin) that reaches every page, including all the stock pages. On phones it becomes a slide-out menu.
- **Ctrl+K** (Cmd+K on Mac) jumps to any page, invoice number, client or stock item.
- A new dashboard showing:
  - money outstanding and money more than 30 days overdue,
  - invoices waiting for payment, oldest first,
  - the dishes that have been out longest,
  - items that need attention.
- Opening a link while signed out brings you back to that page after you sign in.
- Pages load faster because each page is downloaded only when first opened.
- One page crashing no longer blanks the whole app.

## Database migrations to apply

Apply these in the Supabase SQL editor **before** deploying the new frontend. The app expects both.

1. Run **`042_bug_fixes.sql`**, then **`043_security_hardening.sql`**. Each file is one transaction: if anything fails, nothing is applied. Do not re-run 042 after 043. If you ever must, run 043 again afterwards.
2. Run **`042_verify.sql`** and **`043_verify.sql`**. They roll back and change nothing. Each must finish without an error.
3. **Read the NOTICE messages** from both migrations and act on them. In particular:
   - "SKIPPED invoices_one_live_invoice_per_event": some events are invoiced twice. Cancel the duplicates, then re-run that block.
   - "SKIPPED inventory_audits_one_open_per_outlet": an outlet has several open audits.
   - "Returns were booked against never-dispatched stock for …": check those items' quantities.
   - "CHECK BY HAND: cancelled invoices with active payments": decide whether to void those payments.
   - "SKIPPED invoices_number_format_known": an unknown number format is in use.
   - The counts of repaired invoice statuses and the list of functions still callable by signed-in users.

See [`supabase/MIGRATION_ORDER.md`](../supabase/MIGRATION_ORDER.md) rows 42–43 for the full contents.

## Owner actions required

1. **Rotate passwords and close old projects.** Change the admin and manager passwords that were exposed, and pause or delete the old Supabase projects that are no longer used.
2. **Complete the company address.** Invoices currently print only "Bengaluru, Karnataka" as the registered office. Put the full registered address in `src/config/companyProfile.ts` (marked `TODO(owner)`) and redeploy.
3. **Allow the password-reset page.** In Supabase → Authentication → URL Configuration, add `<your site origin>/reset-password` to the redirect allow-list. Otherwise the "Forgot password?" emails won't open the reset page.
4. **Decide inter-state GST with your CA.** The app picks CGST+SGST or IGST only from the client's GST type (Domestic vs SEZ/Export). It has no place-of-supply logic, so an out-of-state domestic client can't be billed with IGST yet. Agree the rule with your CA before it is built.
