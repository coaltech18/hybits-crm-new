# Hybits CRM — Full Application Workflow

_Last updated: 2026-10-29 (after migrations 042 + 043 and the UI redesign). This is a plain-English guide to what every part of the app does, who can do it, and how data flows from one module to the next. For the detailed reference, see [SOFTWARE_OVERVIEW.md](SOFTWARE_OVERVIEW.md)._

---

## 1. The big picture

Hybits CRM is a **billing + inventory system for a dish-rental business**. Everything is built around two ways money comes in:

| Flow | What it is | Who it's for |
|------|-----------|--------------|
| **Corporate subscriptions** | Recurring dish rental, billed daily, weekly or monthly | Offices, canteens, corporate clients |
| **Events** | One-time dish rental for a wedding / function | Individuals, event organisers |

Both flows end the same way: an **invoice** is raised → **payments** are recorded against it → it shows up in **Reports** and **GST working**. **Inventory** tracks the physical dishes going out and coming back.

The app is a website (React) talking directly to a **Supabase** database. There is no separate backend server. The database's rules (row-level security, triggers) are what enforce "who can see/do what" — even someone calling the database directly with their own login gets the same answer as the app.

---

## 2. Who can do what (roles)

There are three roles. A user has exactly one.

| Capability | Admin | Manager | Accountant |
|-----------|:-----:|:-------:|:----------:|
| See all outlets | ✅ | ❌ (only assigned outlets) | ✅ |
| Create/edit clients, events, subscriptions | ✅ | ✅ (own outlets) | ❌ view only |
| Create/edit/finalize invoices | ✅ | ✅ (own outlets) | ❌ view only |
| Record or void payments | ✅ | ✅ (own outlets) | ❌ view only |
| Send / receive dishes, stock actions | ✅ | ✅ (own outlets) | ❌ view only |
| Stock adjustments | ✅ only | ❌ | ❌ |
| Create, count and submit stock audits | ✅ | ✅ (own outlets) | ❌ view only |
| Approve or reject stock audits | ✅ only | ❌ | ❌ |
| Back-date a subscription | ✅ only | ❌ | ❌ |
| Manage users / outlets / settings, activity log | ✅ | ❌ | ❌ |
| Dashboard, Reports & GST working | ✅ | ✅ (own outlets) | ✅ |

**The accountant is read-only everywhere, including payments.** The app hides every create, edit, send, void and payment button for accountants, and the database refuses their writes.

**Outlet isolation:** a **manager** only ever sees data for the outlet(s) they are assigned to (Admin → Users → Assign outlets). A manager with several outlets picks the outlet on each create form. **Admins and accountants** see every outlet.

---

## 3. Getting around

- **Sign in** with your work email. If you opened a link while signed out, you are taken back to it after signing in.
- **Forgot password?** on the sign-in card emails you a link to `/reset-password`, where you choose a new password (at least 8 characters).
- **Sign out** (bottom of the sidebar) signs out **this device only**; other devices stay signed in.
- **Ctrl+K** (Cmd+K on Mac), or the search box in the header, jumps to any page, invoice number, client or stock item.
- The sidebar is grouped:

| Group | Pages |
|---|---|
| **Overview** | Dashboard: money outstanding, invoices waiting for payment (oldest first, with aging bars), dishes out longest, things needing attention |
| **Sales** | Clients, Subscriptions, Events, Invoices, Payments |
| **Dishware** | Stock overview, Items, Send & receive (admin/manager), Movements, Stock audits, Stock reports |
| **Accounts** | Reports (revenue, payments, aging, MRR, events, clients, outlets), GST working |
| **Admin** (admin only) | Users, Outlets, Activity log, Settings |

---

## 4. Client workflow

**Clients** is the foundation — nothing can be billed without a client.

1. **Clients → New client.**
2. Pick a **client type**:
   - **Corporate** → GSTIN (optional, format-checked) and a **GST type** (Domestic, SEZ or Export). These clients get **subscriptions**.
   - **Event** → individual customers. These get **events**.
3. Pick the **outlet** (if you have more than one) and save.

> A corporate client and an event client are separate records even if it's the same company — the two billing flows never mix. Once a client has subscriptions, events or invoices, its type and outlet can no longer be changed.

---

## 5. Corporate subscription workflow

1. **Subscriptions → New subscription.**
2. Choose the outlet, the **corporate client**, the cycle (daily, weekly, or monthly on a day 1–28), the start date, quantity and price per unit, and the mandatory pricing notes. Optionally fill in the questionnaire and a **planned dishware kit** (a plan only — it does not move stock).
3. States, enforced by the database:
   - **active** → can be **paused** or **cancelled**,
   - **paused** → can be **resumed** (active) or **cancelled**,
   - **cancelled** → final; the subscription is frozen.
   A subscription **cannot be cancelled while dishes are still out** with the client. Only admins can back-date the start date.
4. **To send dishes:** subscription → **Allocate dishware** (opens Send & receive for that subscription). Only active subscriptions can receive dishes.
5. **To bill it:** subscription → **New invoice** (or Invoices → New invoice, type Subscription). Billing is manual: the app does not raise subscription invoices automatically and does not move the next billing date when you invoice.
6. **Price changes** need a reason and are kept in the price history. The price locks once the client has an issued subscription invoice raised after the subscription started.

---

## 6. Event workflow

1. **Events → New event.** Choose the outlet, the **event client**, event date and details. It starts as **planned**.
2. **Event page → Send dishes** before the event.
3. After the event, **Record return** for what came back: good, damaged or lost.
4. **Complete** the event. Event status flows, enforced by the database:
   - **planned → completed**, or **planned → cancelled**. Both are final; a completed or cancelled event can no longer be edited.
   - **Cancel is blocked while dishes are still out.**
5. **Event page → Create invoice** (only for completed events). An event can have **only one live invoice**; to bill it again, cancel the first invoice.

---

## 7. Invoice workflow (the core of the system)

An invoice is a **GST legal document**, so the rules are strict.

### Lifecycle
```
draft ──► finalized ──► partially_paid ──► paid
  │            │             ▲    │          │
  │            │             └────┴──────────┘  (follows payments automatically)
  └► cancelled └► cancelled (only while unpaid; database only, no button)
```

- **draft** — fully editable: invoice date, line items, quantities, prices, GST rates, terms. Type, outlet, client and event are fixed once created.
- **finalized** — the invoice is issued. It becomes **immutable**: no more editing items or amounts, and the client's name, GSTIN, address and GST type are **frozen onto the invoice** (later client edits do not change it or move it to another GST sheet).
- **partially_paid / paid** — **set automatically by the database from the payments.** Nobody sets these by hand. Voiding a payment moves the status back.
- **cancelled** — voided; cannot change afterwards. In the app you cancel **drafts** (invoice page → menu → Cancel invoice).

### Numbering
- The invoice **number is given when the draft is created** (not at finalize), and never changes after finalizing. If you change a draft's date into another day or financial year, the draft gets a new number for that date.
- Four formats, chosen per invoice: **Standard** `INV-YYYYMMDD-NNNN` (one running counter), **Outlet + FY** `INV/<CODE>/<2025-26>/NNNN` (per outlet per year), **Outlet short** `INV-<CODE>-NNNN` (one running counter per outlet), **FY only** `INV/<2025-26>/NNNN` (per year).
- Dates and financial years (April–March) follow the invoice date in Indian time.

### How to create one
1. **Invoices → New invoice**, or a shortcut: client → New invoice, subscription → New invoice, completed event → Create invoice, or an invoice → Duplicate as new draft.
2. Pick type (subscription or event), outlet, client (and the completed event).
3. Set the invoice date (today by default; may be in the past, never in the future).
4. Add line items: description, quantity, unit price and **GST rate** (0%, 5%, 12% or 18%). Totals are calculated exactly to the paisa.
5. Choose the number format, check the terms, and save. The draft opens straight away.
6. Review → **Finalize** when ready to send. An empty draft cannot be finalized. Download the PDF from the invoice page.

> Invoices can **never be deleted** (legal requirement). To void a draft, use **Cancel**. There are no credit notes yet.

### GST split
- **Domestic** clients: CGST + SGST (half each; they always add up to the tax).
- **SEZ / Export** clients: all tax as IGST.
- There is no place-of-supply logic yet, so an inter-state domestic client cannot be billed with IGST.

---

## 8. Payment workflow

1. **Payments are recorded from the invoice.** Open the invoice and choose **Record payment**. (The Payments page lists payments and links to Invoices; it has no "add payment" button.)
2. Enter the amount, method (cash, UPI, bank transfer, card or cheque), date and an optional reference (UTR / cheque no.) and notes.
3. Rules the system enforces:
   - You cannot pay a **draft** or **cancelled** invoice — finalize it first.
   - You cannot **overpay** beyond the balance due (₹0.05 rounding tolerance).
   - The payment date cannot be in the future (Indian date) or before the invoice date.
4. Recording a payment immediately updates the invoice's paid amount, balance and status (**finalized → partially_paid → paid**). The database does this itself.
5. **Payments are never edited or deleted.** A wrong payment is **voided** (Payments page → Void, with an optional reason) and recorded again. The database keeps who voided it, when and why. Voiding recalculates the invoice balance and status. A voided payment cannot be brought back.

---

## 9. Reports & GST

- **Reports** — revenue by invoice date, payments by payment date, outstanding aging (0–30, 31–60, 61–90, 90+ days from the invoice date), subscription MRR, event revenue, client revenue and outlet performance. Only issued invoices count (no drafts, no cancelled). Every tab exports CSV.
- **GST working** — Domestic (CGST + SGST), SEZ and Export (IGST) sheets for the CA, using the client details frozen at finalize. Export each as CSV.

Managers see only their outlets' numbers; admins and accountants see everything.

---

## 10. Admin

- **Users** — list, deactivate/reactivate, and assign outlets to managers (saved in one step). New logins are created in the Supabase dashboard; the Add user screen explains how. Safety rails, enforced by the database: nobody can deactivate themselves, and the last active admin cannot be deactivated or demoted. There is no screen to change a role.
- **Outlets** — your branches. Create, edit, deactivate or reactivate (blocked while the outlet has active subscriptions, dishes out or planned events). Outlets are never deleted.
- **Activity log** — combined trail of stock movements, payments (voids marked), subscription and event changes, and invoices created. Admin actions themselves are not logged.
- **Settings** — stored values marked **"Not yet enforced"**: nothing reads them yet. Each shows who changed it last.

---

## 11. End-to-end example (event)

> A wedding rents 500 plates.

1. **Clients** → add the customer as an **event** client.
2. **Events** → create the event (planned), outlet = Bengaluru, date set.
3. **Event page → Send dishes** → 500 plates (dishes leave the warehouse).
4. After the event: **Event page → Record return** → e.g. 480 good, 15 damaged, 5 lost.
5. **Complete** the event.
6. **Event page → Create invoice** → add rental + any damage/loss charges → **Finalize**.
7. **Invoice → Record payment** → the invoice becomes paid automatically.
8. **Reports / GST working** → the revenue and tax now appear.

---

## 12. One-line summary of data flow

```
Client ──► (Subscription or Event) ──► Invoice ──► Payment ──► Reports / GST
                     │
                     └──► Inventory (send dishes out, receive back, track damage/loss)
```
