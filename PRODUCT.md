# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Outlet managers (daily, primary).** Staff at each Hybits outlet. They register clients, record subscriptions and events, raise GST invoices, record payments, and send dishware out and receive it back. They use the app many times a day, often in a hurry, so the next action and the current balance must be obvious.
- **Accountant (month-end).** Read-only. Works through revenue, outstanding/aging and GST working reports, and exports CSVs for filing. Needs dense, exact and trustworthy numbers.
- **Owner/admin (oversight).** Sees every outlet. Watches outstanding money and stock losses, approves inventory audits, and manages users, outlets and settings.

All three use the app mostly on a laptop or desktop. Phones are used occasionally, for example to check a balance, so mobile must work well but is not the design target.

## Product Purpose

Hybits CRM is the private billing and operations system of Hybits Solutions Pvt Ltd (Bengaluru), which rents sterilised, ready-to-use dishware. It serves corporate clients on recurring subscriptions (daily, weekly or monthly) and event clients with one-off bookings (weddings, functions). It does four jobs: keeps the client register per outlet, raises GST tax invoices and prints PDFs, records full and part payments, and tracks every dish sent out, returned, damaged or lost, including monthly stock audits. Reports cover revenue, aging and GST working for the accountant.

Success means a manager finishes a task (invoice, payment, dispatch) without hunting, the owner can see money and stock exposure at a glance, and the accountant trusts and exports the numbers.

## Positioning

The core idea is pairing GST-correct invoicing with tracking physical dishware per client. Every plate that leaves an outlet is tied to a client, event or subscription, and to the money owed for it.

## Operating Context

- **Outlets.** Each client, invoice, payment and stock item belongs to one outlet (branch). Managers see only their assigned outlets. Admins and accountants see all of them.
- **Invoices.** Indian GST tax invoices: CGST+SGST or IGST, SEZ and export sheets, SAC/HSN 9985, and financial-year numbering. A lifecycle runs from draft to finalized, partially paid, paid or cancelled.
- **Inventory.** The stock buckets are available, allocated, damaged and lost, recorded in an immutable movement ledger. Monthly audits are created and submitted by managers and approved by admins.
- **Hosting.** No app server: the browser talks directly to Supabase, which enforces security with row-level security (RLS). The frontend is a static site on Render.

## Capabilities and Constraints

- **Stack.** React 18, TypeScript, Vite, Tailwind CSS 3, Supabase, Recharts, jsPDF and PapaParse.
- **Roles.** admin, manager and accountant. Accountants are read-only.
- **Currency and format.** INR only. Indian number formatting (lakh/crore grouping) and DD MMM YYYY dates are expected.
- **Migrations.** Applied manually in the Supabase SQL editor, in the order set by `supabase/MIGRATION_ORDER.md`.
- **Full feature map.** See `docs/SOFTWARE_OVERVIEW.md`.

## Brand Commitments

- The Hybits logo (`public/logo.png`: the "hybits" wordmark with a plate-and-spoon "bi", and "Sterilised Dish" underneath) must stay.
- The Hybits green identity must stay recognisable. The logo greens are roughly #229A7A for the wordmark and #58B692 for the tagline.
- Everything else (layout, type, components, density, secondary colours) is open to redesign.
- The legal name on invoices is HYBITS SOLUTIONS PRIVATE LIMITED, GSTIN 29AAHCH6039E1ZH.

## Evidence on Hand

- Logo and favicon in `public/`.
- Company profile, bank details and default invoice terms in `src/config/companyProfile.ts`.
- No customer testimonials, metrics or marketing content exist, and none must be invented.

## Product Principles

1. **Money and stock exposure first.** Outstanding balances, overdue invoices and dishes still out are the facts every role needs. Surface them where decisions are made.
2. **One obvious next action.** Each record shows its state and the single most likely next step, for example finalize, record payment or receive back.
3. **Exact over pretty.** Amounts, GST splits, quantities and dates are always precise, aligned and in Indian format. The accountant must be able to trust every figure.
4. **Everything findable.** Every feature can be reached from navigation. Nothing hides behind unlabeled icons or unreachable routes.
5. **Role-honest UI.** Show people only what they can actually do. Read-only users see clean read views, not disabled forms.

## Accessibility & Inclusion

Target WCAG 2.2 AA:

- body text contrast of at least 4.5:1,
- full keyboard operation with visible focus,
- labelled controls,
- dialogs with focus management.

Users read many numbers across long sessions, so legibility of figures and tables is a first-class requirement.
