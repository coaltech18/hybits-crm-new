# Hybits CRM — Full Application Workflow

_Last updated: 2026-07-08. This is a plain-English guide to what every part of the app does, who can do it, and how data flows from one module to the next._

---

## 1. The big picture

Hybits CRM is a **billing + inventory system for a dish-rental business**. Everything is built around two ways money comes in:

| Flow | What it is | Who it's for |
|------|-----------|--------------|
| **Corporate Subscriptions** | Recurring monthly rental of sterilized dishes | Offices, canteens, corporate clients |
| **Events** | One-time dish rental for a wedding / function | Individuals, event organizers |

Both flows end the same way: an **Invoice** is raised → a **Payment** is recorded → it shows up in **Reports** and **GST Working**. **Inventory** tracks the physical dishes going out and coming back.

The app is a website (React) talking directly to a **Supabase** database. There is no separate backend server — the database's Row-Level Security (RLS) rules are what enforce "who can see/do what."

---

## 2. Who can do what (roles)

There are three roles. A user has exactly one.

| Capability | Admin | Manager | Accountant |
|-----------|:-----:|:-------:|:----------:|
| See all outlets | ✅ | ❌ (only assigned outlets) | ✅ |
| Create/edit clients, events, subscriptions | ✅ | ✅ (own outlets) | ❌ (view only) |
| Create/edit invoices | ✅ | ✅ (own outlets) | ❌ (view only) |
| Record payments | ✅ | ✅ (own outlets) | ✅ |
| Inventory stock actions | ✅ | ✅ (own outlets) | ❌ (view only) |
| Negative stock adjustments | ✅ only | ❌ | ❌ |
| Manage users / outlets / settings | ✅ | ❌ | ❌ |
| Reports & GST Working | ✅ | ✅ | ✅ |

**Key idea — outlet isolation:** A **Manager** only ever sees data for the outlet(s) they are assigned to (in Admin → Users). **Admins and Accountants** see every outlet. This is enforced both in the app and in the database.

---

## 3. The sidebar — every button explained

When you log in you land on the **Dashboard**. The left sidebar is your map:

| Menu item | What it does |
|-----------|--------------|
| **Dashboard** | Summary numbers: revenue, outstanding, recent activity. (Admin/Manager only.) |
| **Clients** | Your customer database. Every invoice must belong to a client. |
| **Subscriptions** | The recurring corporate rental agreements. |
| **Events** | One-off weddings/functions. |
| **Invoices** | The actual bills. Created from a subscription or an event. |
| **Payments** | Money received against invoices. |
| **Reports** | Revenue, outstanding aging, outlet performance. |
| **GST Working** | Tax breakdown (CGST/SGST/IGST) for filing returns. |
| **Inventory** | Dish stock: what you own, what's out, what's damaged. |
| **Admin → Users** | Create/assign roles and outlets. (Admin only.) |
| **Admin → Outlets** | Your branches/locations. (Admin only.) |
| **Admin → Activity Logs** | Audit trail of who did what. (Admin only.) |
| **Admin → Settings** | System configuration. (Admin only.) |

---

## 4. Client workflow

**Clients** is the foundation — nothing can be billed without a client.

1. **Clients → Add Client.**
2. Pick a **client type**:
   - **Corporate** → GSTIN is expected (used for tax on invoices). These clients get **Subscriptions**.
   - **Event** → individual customers. These get **Events**.
3. Save. The client is tied to the **outlet** you're working in.

> A corporate client and an event client are separate records even if it's the same company — the two billing flows never mix.

---

## 5. Corporate subscription workflow

Use this for **recurring monthly** dish rental.

1. **Subscriptions → Add Subscription.**
2. Choose the **corporate client**, the **outlet**, the **monthly amount / plan**, and the start date.
3. A subscription has one of three states:
   - **active** — currently running and billable.
   - **paused** — temporarily on hold.
   - **cancelled** — ended.
4. To bill it, go to **Invoices → Create Invoice**, choose **type = subscription**, pick the client, and add the line items (the dishes/services and their price + GST rate). Save as **draft**.

> ⚠️ Today the subscription does **not** automatically know which inventory items belong to it (see the Inventory guide — the auto-allocation hooks are placeholders). Dishes are allocated manually.

---

## 6. Event workflow

Use this for **one-time** weddings/functions.

1. **Events → Add Event.**
2. Choose the **event client**, **outlet**, event date, and details.
3. Event status flows: **planned → completed** (or **planned → cancelled**).
4. **You can only invoice an event once its status is `completed`.** A cancelled event can never be invoiced. This is enforced in the database.
5. From the event (or Invoices → Create Invoice, type = event), raise the invoice with line items.

**On the Event detail page** there are inventory buttons (Allocate / Return / Damage / Loss) so you can send dishes out for the event and record what comes back. ✅ These were rewired to the correct (V2) inventory path on 2026-07-08 — apply migrations `035a` + `035b` and deploy the frontend for the fix to take effect (details in the Inventory guide).

---

## 7. Invoice workflow (the core of the system)

An invoice is a **GST legal document**, so the rules are strict.

### Lifecycle
```
draft ──► finalized ──► partially_paid ──► paid
  │            │
  └► cancelled └► cancelled
```

- **draft** — fully editable. You can change items, quantities, prices, GST rates, terms.
- **finalized** — the invoice is "issued." It gets a permanent invoice number and becomes **immutable** (no more editing items/amounts). Only status can change from here.
- **partially_paid** — at least one payment recorded, but balance still due.
- **paid** — fully settled.
- **cancelled** — voided. Cannot be changed afterward.

### How to create one
1. **Invoices → Create Invoice.**
2. Pick type (subscription or event), client, outlet.
3. Add line items. Each line has: description, quantity, unit price, and a **GST rate** (allowed rates: 0%, 5%, 12%, 18%).
4. The system computes line totals, tax, and grand total automatically (rounded to 2 decimals).
5. Choose an **invoice number format** (standard, outlet+FY, outlet-short, or FY-only).
6. Save as **draft** → review → **finalize** when ready to send.

> Invoices can **never be deleted** (legal requirement). To void one, use **Cancel**.

> ✅ **Fixed (2026-07-08):** previously, a payment covering the **full amount in one go** left the invoice stuck at `finalized`. Migration `034_fix_invoice_payment_transitions.sql` fixes the transition rules, repairs any already-stuck invoices, and the app no longer hides status-sync errors. Make sure migration 034 is applied to production.

---

## 8. Payment workflow

1. **Payments** (or from an invoice) → **Add Payment.**
2. Pick the invoice, amount, method (cash/UPI/bank/etc.), date, reference number.
3. Rules the system enforces:
   - You cannot pay a **draft** or **cancelled** invoice — finalize it first.
   - You cannot **overpay** beyond the balance due (small rounding tolerance allowed).
   - Payment date cannot be in the future.
4. Recording a payment updates the invoice's paid amount / balance and (should) advance its status.
5. **Payments are never hard-deleted** — you "deactivate" them (soft delete) so the audit trail is preserved. Deactivating a payment recalculates the invoice balance.

---

## 9. Reports & GST

- **Reports** — daily revenue, outstanding aging (who owes you and for how long), outlet-wise performance, subscription MRR (monthly recurring revenue).
- **GST Working** — splits invoice tax into domestic (CGST+SGST), SEZ, and export buckets so you (or your CA) can file GST returns. Numbers come straight from finalized invoices.

Managers see only their outlet's numbers; Admins/Accountants see everything.

---

## 10. Admin

- **Users** — create users (note: actual account creation is done in the Supabase dashboard today; the app assigns role + outlets), toggle active/inactive, change roles. Safety rails: you can't deactivate or downgrade the **last active admin**, and you can't downgrade **yourself**.
- **Outlets** — your physical branches. Each has its own GSTIN.
- **Activity Logs** — audit trail.
- **Settings** — system-wide configuration.

---

## 11. End-to-end example (event)

> A wedding rents 500 plates.

1. **Clients** → add the customer as an **event** client.
2. **Events** → create the event (planned), outlet = Bengaluru, date set.
3. **Inventory** → allocate 500 plates to the event (dishes leave the warehouse). *(Use the Item Detail page action buttons — see Inventory guide for why.)*
4. Event day passes → set event status to **completed**.
5. **Inventory** → receive back: e.g. 480 good, 15 damaged, 5 lost.
6. **Invoices → Create Invoice** (type = event) → add rental + any damage/loss charges → finalize.
7. **Payments** → record the customer's payment → invoice becomes paid.
8. **Reports / GST Working** → the revenue and tax now appear.

---

## 12. One-line summary of data flow

```
Client ──► (Subscription or Event) ──► Invoice ──► Payment ──► Reports / GST
                     │
                     └──► Inventory (allocate dishes out, receive back, track damage/loss)
```
