# Inventory Module — How It Works, How to Use It, and What's Next

_Last updated: 2026-10-29 (after migrations 042 + 043). Earlier versions of this guide warned that some screens were broken and told you to use only the Item Detail page; that is no longer true. The full reference is [SOFTWARE_OVERVIEW.md §3.9](SOFTWARE_OVERVIEW.md#39-inventory-dishware-stock)._

This document has three parts:
1. **The mental model** — how Hybits inventory tracks dishes.
2. **How to use it day to day.**
3. **What is still missing.**

---

## Part 1 — The mental model

Every inventory item (e.g. "10-inch dinner plate") tracks its dishes across **buckets**. A dish is always in exactly one bucket:

```
total = available + allocated + damaged + in_repair
(lost dishes leave "total" entirely)
```

| Bucket | Meaning |
|--------|---------|
| **available** | In the warehouse, ready to send out |
| **allocated** | Currently out with a client (event/subscription) — shown as "Out" |
| **damaged** | Broken, not usable yet |
| **in_repair** | Sent to a repair vendor |
| **lost** | Gone (client lost / missing at the outlet) — a lifetime counter outside total |

**The golden rule:** you **never type a new stock number directly**. You record a **movement** (stock in, send out, return, damage, etc.), and the database moves dishes between buckets. This gives a permanent, audit-proof ledger of every dish's journey. The **Movements** page is that ledger. Since migration 043 the database itself refuses any direct change to stock numbers, so the ledger is the only way in. Every movement is stamped with the signed-in user who made it.

### The actions
| Action (button) | What happens to buckets |
|--------|------------------------|
| **Add stock** (purchase / opening balance) | available ↑, total ↑ |
| **Send out / Send dishes** (to an active subscription or planned event) | available ↓, allocated ↑ |
| **Record return → good** | allocated ↓, available ↑ |
| **Record return → damaged** (client or transit damage) | allocated ↓, damaged ↑ |
| **Mark damaged** (warehouse handling damage) | available ↓, damaged ↑ |
| **Mark lost** (by a client, or missing at the outlet) | allocated ↓ or available ↓, total ↓, lost ↑ |
| **Dispose damaged** (end of life) | damaged ↓, total ↓ |
| **Adjust stock** (admin only; count correction up, audit shortage down) | available ↑/↓, total ↑/↓ |
| Send to repair / return from repair | damaged ↔ in_repair ↔ available — **supported by the database, no button yet** |

### Item lifecycle
An item has a lifecycle status: **draft → active → discontinued → archived**. In practice the app creates items as **active**, and the only lifecycle button is **Deactivate** (→ discontinued: no new dispatches, but returns and write-offs still work). There is no reactivate or archive button. Only active items can be sent out.

### Opening balance
When you create an item you enter its starting count (an "opening balance" stock-in). The opening balance **locks** automatically on the item's first dispatch. After locking — and for any decrease at any time — only an admin can adjust stock.

### Bookings and allocations
Each (item, event) or (item, subscription) pair has one allocation record that the database keeps in step with the ledger: it opens on the first dispatch, grows with more dispatches, and closes when everything is returned, damaged or lost. "Pending" / "still out" is always calculated from the ledger.

A subscription's **planned dishware kit** (entered when the subscription is created) is only a plan. It does not move stock or create allocations.

---

## Part 2 — How to use it

You can send and receive dishes from three places; all of them use the same database rules:

- **Send & receive** (sidebar → Dishware): search any event or subscription, then the **Send dishes** or **Receive back** tab. Works for **both events and subscriptions**.
- **Event page**: Send dishes, and Record return from the event's dishware ledger.
- **Item page** (Items → click an item): Add stock, Send out, Record return, Mark damaged, Mark lost, Dispose damaged, Adjust stock (admin).

Dishes can be sent only to an **active subscription** or a **planned event**.

### Initial setup (one time)
1. Admin creates each outlet under **Admin → Outlets**.
2. For each dish type: **Dishware → Items → Add item** (name, category, material, unit), entering the current physical count as **opening stock**.
3. Check that **Available** equals your real shelf count.

### When dishes go out for an event or subscription
1. Open the event (or Send & receive → search the subscription) → **Send dishes** → item + quantity.
2. Repeat per dish type (one item at a time).

### When dishes come back
1. Event page ledger, or Send & receive → **Receive back**, or the item's **Record return**.
2. Record **Returned** (good), **Damaged** or **Lost** quantities. Notes are mandatory for damaged and lost.
3. You cannot return more than is still out for that booking. An event cannot be cancelled, and a subscription cannot be cancelled, while dishes are still out.

### In the warehouse
- Broken on the shelf → item page → **Mark damaged**.
- Can't be found → item page → **Mark lost** (missing at the outlet).
- Beyond use → **Dispose damaged**.

### Monthly stock audit
1. **Stock audits → New audit**: outlet + month. The system snapshots the available count of every item.
2. Count the shelves and enter the **physical count** for every item. Give a reason for every difference.
3. **Submit.** If every count matches — or an admin submits with no shortages — it is approved automatically and the corrections are posted. Otherwise it waits for an **admin** to approve (posts the corrections) or reject (with a reason).
4. An audit that has not been submitted can be cancelled.

### Keeping an eye on things
- **Stock overview**: totals per bucket, and a "Needs attention" list (unlocked opening balances, pending returns, damaged stock, items in repair, audits awaiting approval).
- **Dashboard → Dishes out the longest**: bookings whose dishes have been out longest.
- **Stock reports**: Stock summary, Dishes out, Damage and loss, Movements — all exportable to CSV.

---

## Part 3 — What is still missing

The earlier fix-it plan ("Phase A") is done: every screen uses the same ledger rules, the movement types that used to fail (damaged returns, disposal, repair) work in the database, subscriptions can be found and served in Send & receive, and Record return on the item page works. Migrations 042 and 043 also made audits work end to end and made the ledger the only way to change stock.

Still open:

1. **Repair flow screens.** Send to repair / return from repair are supported by the database but have no button.
2. **Lifecycle screens.** No reactivate (discontinued → active) or archive button; no screen to delete an item.
3. **Bulk send.** Dishes are sent one item at a time. There are no "items required for this event" lists and no automatic dispatch when an event or subscription starts (the old empty "integration hooks" were removed rather than built).
4. **Subscription dishware ledger.** The event page shows what is out with the client; the subscription page shows only the planned kit.
5. **Low-stock alerts** per item and **stock valuation** (needs a unit cost field).
6. **Known rough edges** (see [SOFTWARE_OVERVIEW.md §7.1](SOFTWARE_OVERVIEW.md#71-rough-edges-found-in-the-current-code)): "Send dishes" is offered on completed events but the database refuses it; a month with a rejected audit cannot be re-audited from the UI; Adjust stock is offered on discontinued items but refused; allocations at a deactivated outlet disappear from the dishware screens.

---

## Quick reference — is my count right?

`available + allocated + damaged + in_repair` must equal `total` for every item. The database enforces this with a constraint and, since 043, refuses any write to the stock numbers that does not come from a movement. If a count looks wrong, look at the item's movement history (item page, or Movements filtered by item) to see which movement caused it, and correct it with a stock audit or an admin adjustment.
