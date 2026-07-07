# Inventory Module — How It Works, How to Use It, and the Fix-It Plan

_Last updated: 2026-07-08._

This document has three parts:
1. **The mental model** — how Hybits inventory is designed to track dishes.
2. **How to actually use it today** (and the trap to avoid).
3. **A plan to make it fully work** for the Hybits unit.

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
| **allocated** | Currently out with a client (event/subscription) |
| **damaged** | Came back broken, not usable yet |
| **in_repair** | Sent to a repair vendor |
| **lost** | Gone (client lost / theft / transit) — subtracted from total |

**The golden rule:** you **never type a new stock number directly**. Instead you record a **movement** (stock in, allocate, return, damage, etc.), and the database automatically moves dishes between buckets. This gives you a permanent, audit-proof ledger of every dish's journey. The **Movements** page is that ledger.

### The movement types
| Action | What happens to buckets |
|--------|------------------------|
| **Add Stock** (purchase / opening balance) | available ↑, total ↑ |
| **Allocate** (send to event/subscription) | available ↓, allocated ↑ |
| **Receive Back** (good condition) | allocated ↓, available ↑ |
| **Mark Damaged** | allocated ↓ (or available ↓), damaged ↑ |
| **Mark Lost** | allocated ↓, total ↓, lost ↑ |
| **Send to Repair / Return from Repair** | damaged ↔ in_repair ↔ available |
| **Dispose** (damaged beyond repair) | damaged ↓, total ↓ |
| **Adjust** (audit correction) | available ↑/↓ (negative = admin only) |

### Item lifecycle
An item also has a lifecycle status: **draft** (being set up) → **active** (in use, can be allocated) → **discontinued** (phasing out, no new allocations) → **archived** (read-only history). Only **active** items can be allocated to clients.

There's also an **"opening balance"** concept: when you first create an item you set its starting count; once you make the first allocation, that opening balance **locks** so it can't be quietly changed later. After locking, only admins can make corrections.

---

## Part 2 — How to use it today

### ✅ The reliable way (use this)

Do all stock actions from the **item's own detail page**:

1. **Inventory → Items** → click an item → you're on the **Item Detail** page.
2. Use the action buttons there: **Add Stock, Allocate, Receive Back, Mark Damaged, Mark Lost, Dispose, Adjust Stock.**
3. These buttons are wired to the **new (V2)** logic and update the buckets correctly.

### ⚠️ The trap (FIXED — apply migrations 035a + 035b and deploy the code)

There were **two other places** that also let you allocate/return dishes — the standalone **Inventory → Allocate** page and the **Event detail page** buttons — and they used the **old (V1)** code path that was out of sync with the database.

**What went wrong (precisely):** V1 writes were missing the `movement_category` classification field. The on-hand bucket counts still updated (a fallback in the database handled that), but:
- **All safety checks were silently skipped** — no "enough stock available" check, no "only active items" check, no "can't return more than outstanding" check.
- **Returns/damage/loss recorded this way were invisible to the outstanding-return math**, so the app kept showing dishes as "pending return" after they were back, allocations never auto-closed, and it was possible to over-return (inflating available stock).
- The opening-balance auto-lock never fired.

**Separately**, three actions on the (good) Item Detail page — *Receive Back (damaged)*, *Dispose*, and the *repair* flow — failed outright with a database enum error, because the `movement_type` enum was never extended for V2.

**All of this is fixed** by: the code changes (all screens now use the V2 services), migration **035a** (adds the missing enum values), and migration **035b** (auto-classifies any unclassified insert, backfills historical rows, makes the field mandatory, aligns allocation auto-close with the V2 math, and closes allocations that were already fully returned). Until those two migrations are applied to the production database, keep using the Item Detail page only.

### Recommended day-to-day routine for the Hybits unit

**Initial setup (one time):**
1. Admin creates each outlet under **Admin → Outlets**.
2. For each dish type, **Inventory → Items → Add Item** (name, category, material, unit = "pcs").
3. Open each item → **Add Stock** with reason **"opening balance"** and your current physical count.
4. Verify **available** now equals your real shelf count.

**When dishes go out for an event/subscription:**
1. Open the item → **Allocate** → quantity + link to the event/subscription.
2. Repeat per dish type. (Or, once fixed, do it in bulk from the event page.)

**When dishes come back:**
1. Open the item → **Receive Back** for the good ones.
2. **Mark Damaged** / **Mark Lost** for the rest (notes are mandatory — record what happened).

**Monthly / periodic:**
1. Do a physical count.
2. **Inventory → Audit** to compare system vs. physical and post corrections (admin approves).
3. Send broken dishes to **Repair**; **Dispose** the unrepairable.

---

## Part 3 — The plan to make it fully work

The root problem: the inventory backend was upgraded to **V2** (lifecycle statuses, repair flow, richer reasons), but the **frontend was only half-migrated** — some screens still call the old V1 code. That mismatch is why counts silently break in some places and not others. There is also a designed-but-not-built feature: **auto-allocating dishes when an event/subscription starts** (the code hooks exist but are empty placeholders, and there are no `event_items` / `subscription_items` tables to say "this event needs 500 plates").

### Phase A — Stop the silent data corruption ✅ DONE (2026-07-08)
1. ✅ The two V1 screens now use V2 services: `AllocateInventoryModal` and `ReturnDamageLossModal` were rewired to `allocateInventoryV2` / `returnInventoryV2` / `writeOffInventoryV2`, which fixes both `InventoryAllocationPage` and `EventDetailPage`.
2. ✅ Item creation with initial stock now uses `createStockInV2` with reason "opening balance".
3. ✅ DB safety net (migration `035b`): a `BEFORE INSERT` trigger derives `movement_category` from `movement_type` when missing, and the column is now `NOT NULL` — a stray V1-style insert is auto-classified or rejected loudly, never silent.
4. ✅ Data cleanup (migrations `035a` + `035b`): missing `movement_type` enum values added (`return_damaged`, `disposal`, `send_to_repair`, `return_from_repair` — these made damaged returns/dispose/repair fail outright); historical `NULL` classifications backfilled; the allocation auto-close trigger now uses the same category-based math as the views; already-fully-returned allocations were closed.

> **Deployment note:** run `035a` by itself first, then `035b` (enum values must commit before use — same pattern as 030a/030b). Migration `034` (invoice status fix) is independent and can run any time.

### Phase B — Make event/subscription allocation first-class (medium effort)
1. Create `event_items` and `subscription_items` tables: `(reference_id, inventory_item_id, quantity)`.
2. Add UI on the event/subscription pages to list "dishes required for this event."
3. Implement the currently-empty hooks (`onEventPlanned`, `onSubscriptionActivated`, `onEventCompleted`, `onSubscriptionCancelled`) to auto-allocate on start and prompt for returns on completion — wrapped in a single database transaction (RPC) so a partial failure can't leave half-allocated stock.

### Phase C — Operational polish (lower priority)
1. A **"Pending Returns"** dashboard: for every completed event, show what's still `allocated` and not yet received/damaged/lost, so nothing is forgotten.
2. **Low-stock alerts** per item (reorder threshold).
3. **Per-outlet stock valuation** for reports (needs a unit cost field on items).
4. Retire the V1 inventory services entirely once nothing imports them, to remove the two-code-paths confusion for good.

### Suggested sequencing
- **Week 1:** Phase A (1–4). After this, inventory counts are trustworthy everywhere and the unit can rely on the module.
- **Weeks 2–3:** Phase B. After this, allocating dishes to an event is one click instead of item-by-item.
- **Later:** Phase C as time allows.

---

## Quick reference — is my count right?

If `available + allocated + damaged + in_repair` does **not** equal `total` for an item, something wrote to the buckets incorrectly (almost certainly via the broken V1 screens). The database has a constraint that should prevent this, so if you see it, stop and investigate before trusting any inventory report.
