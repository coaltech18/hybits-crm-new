# Hybits Inventory Module Redesign Specification
## Version 2.0 — Enterprise-Grade Reusable Dishware Inventory

---

## Executive Summary

This document defines the **complete redesign** of the Hybits inventory module for managing reusable dishware assets (plates, glasses, bowls, cutlery) in a B2B rental business with subscriptions and events.

**Key Design Principles:**
1. **Movements remain source of truth** — all quantity changes happen via movement records
2. **Lifecycle states replace binary is_active** — items progress through defined states
3. **Intent-based movement classification** — movements are categorized by business purpose
4. **Operational flexibility with audit safety** — allow corrections without losing history
5. **Opening stock is correctable** — initial setup errors can be fixed
6. **Warehouse-first design** — supports real operational scenarios

---

## Part 1: Inventory Philosophy

### 1.1 Core Entities and Their Roles

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        INVENTORY DATA MODEL                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ITEM MASTER                    STOCK STATE (Derived)                   │
│   ────────────                   ──────────────────────                  │
│   "What CAN we track?"           "What DO we have?"                      │
│                                                                          │
│   inventory_items                inventory_items (quantity columns)      │
│   ├── id, outlet_id              ├── available_quantity                  │
│   ├── name, category             ├── allocated_quantity                  │
│   ├── material, unit             ├── damaged_quantity (in warehouse)     │
│   ├── lifecycle_status           ├── in_repair_quantity (fixable)        │
│   └── sku, cost_price            └── total_quantity                      │
│                                                                          │
│          │                                    ▲                          │
│          │                                    │                          │
│          ▼                                    │                          │
│                                                                          │
│   MOVEMENTS (Source of Truth)         ALLOCATIONS (State Snapshot)       │
│   ───────────────────────────         ────────────────────────────       │
│   "What HAPPENED to stock?"           "Who HAS stock right now?"         │
│                                                                          │
│   inventory_movements                 inventory_allocations              │
│   ├── movement_category              ├── reference_type (sub/event)     │
│   ├── movement_type                  ├── reference_id                    │
│   ├── quantity (always +)            ├── allocated_quantity (original)   │
│   ├── reference_type/id              ├── outstanding_quantity (derived)  │
│   ├── reason_code                    └── status (active/closed)          │
│   ├── notes (audit trail)                                                │
│   └── created_by, created_at                                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 What Each Entity Represents

| Entity | Definition | Mutability |
|--------|------------|------------|
| **Item Master** | The definition/specification of a type of dishware. Describes WHAT can be tracked. | Editable (with restrictions when in use) |
| **Stock** | Current quantity breakdown by state (available, allocated, damaged, etc.). DERIVED from movements. | Never directly edited |
| **Movement** | An immutable event record documenting a stock change. The accounting ledger. | Append-only, never deleted |
| **Allocation** | A state record tracking which subscription/event currently holds stock. | Updated by movement triggers |

### 1.3 Key Philosophy Differences from Current System

| Aspect | Current System | Redesigned System |
|--------|---------------|-------------------|
| Lifecycle | Binary `is_active` | States: `draft`, `active`, `discontinued`, `archived` |
| Opening stock | Locks item forever | Correctable; only allocations lock |
| Adjustments | Positive only | Positive AND negative |
| Warehouse operations | Not supported | Full support (breakage, repair, disposal) |
| Movement categories | Flat types | Hierarchical: category → type → reason |
| Delete rules | ANY movement blocks | Only ALLOCATION movements block |

---

## Part 2: Item Lifecycle State Machine

### 2.1 Lifecycle States

```
┌───────────────────────────────────────────────────────────────────────┐
│                    ITEM LIFECYCLE STATE MACHINE                       │
├───────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   ┌─────────┐                                                          │
│   │  DRAFT  │ ──── Item created, not yet operational                  │
│   └────┬────┘      • Full editing allowed                             │
│        │           • Can delete (hard delete)                          │
│        │           • NOT visible in allocation dropdowns               │
│        │                                                               │
│        │ Activate (requires: name, category, outlet)                   │
│        ▼                                                               │
│   ┌─────────┐                                                          │
│   │ ACTIVE  │ ──── Normal operational state                           │
│   └────┬────┘      • Visible in allocation dropdowns                  │
│        │           • Metadata editable (name, category)                │
│        │           • Core specs locked if ever allocated               │
│        │           • Can receive/dispatch stock                        │
│        │                                                               │
│        │ Discontinue (requires: allocated_quantity = 0)                │
│        ▼                                                               │
│   ┌──────────────┐                                                     │
│   │ DISCONTINUED │ ──── Phasing out, no new allocations               │
│   └──────┬───────┘      • Hidden from allocation dropdowns            │
│          │              • Still visible in reports                     │
│          │              • Can still return/process existing            │
│          │              • Can reactivate if needed                     │
│          │                                                             │
│          │ Archive (requires: total_quantity = 0, no activity 1 year) │
│          ▼                                                             │
│   ┌──────────┐                                                         │
│   │ ARCHIVED │ ──── Historical record only                            │
│   └──────────┘      • Read-only                                        │
│                     • Hidden from main UI                              │
│                     • Visible in historical reports                    │
│                     • CANNOT be reactivated                            │
│                                                                        │
└───────────────────────────────────────────────────────────────────────┘
```

### 2.2 State Transition Rules

| From State | To State | Conditions | Who Can Do |
|------------|----------|------------|------------|
| — | `draft` | Item creation | Manager, Admin |
| `draft` | `active` | Name, category, outlet set | Manager, Admin |
| `draft` | (deleted) | No movements exist | Manager, Admin |
| `active` | `discontinued` | `allocated_quantity = 0` | Manager, Admin |
| `active` | (deleted) | `total_quantity = 0` AND no allocation movements ever | Admin only |
| `discontinued` | `active` | — (always allowed) | Manager, Admin |
| `discontinued` | `archived` | `total_quantity = 0` AND last movement > 1 year ago | Admin only |
| `archived` | — | Not allowed | — |

### 2.3 What Locks an Item (Prevents Deletion)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LOCKING RULES                                   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  LOCKS ITEM FROM HARD DELETE:                                          │
│  ─────────────────────────────                                         │
│  ✅ Any ALLOCATION movement (allocation, return, damage, loss)          │
│  ✅ Any movement with reference_type = 'subscription' or 'event'        │
│  ✅ total_quantity > 0 (still has stock)                                │
│                                                                         │
│  DOES NOT LOCK ITEM:                                                    │
│  ──────────────────                                                    │
│  ❌ Opening stock (stock_in with reason 'opening_balance')              │
│  ❌ Purchase movements (stock_in with reason 'purchase')                │
│  ❌ Warehouse adjustments (not tied to customer)                        │
│  ❌ Disposal/write-off movements                                        │
│                                                                         │
│  RATIONALE:                                                            │
│  ──────────                                                            │
│  Movements tied to CUSTOMERS (subscriptions/events) create business    │
│  history that must be preserved. Internal warehouse operations can     │
│  be reversed if the item was created in error.                         │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Stock Movement Classification

### 3.1 Movement Hierarchy

```
MOVEMENT_CATEGORY          MOVEMENT_TYPE                  REASON_CODE
─────────────────          ─────────────                  ───────────
inflow                     opening_stock                  opening_balance
                           purchase                       new_purchase
                                                         gift_received
                                                         transfer_in

outflow                    allocation                     subscription_start
                                                         event_dispatch
                                                         additional_dispatch
                           disposal                       end_of_life
                                                         unrepairable
                                                         audit_writeoff
                           transfer_out                   outlet_transfer

return                     return_good                    normal_return
                                                         early_return
                           return_damaged                 client_damage
                                                         transit_damage

writeoff                   damage_warehouse               handling_damage
                                                         storage_damage
                           damage_client                  client_reported
                                                         delivery_damage
                           loss                           client_lost
                                                         transit_lost
                                                         theft
                           
adjustment                 adjustment_positive            audit_surplus
                                                         found_stock
                                                         count_correction
                           adjustment_negative            audit_shortage
                                                         missing_stock
                                                         count_correction

repair                     send_to_repair                 internal_repair
                                                         external_vendor
                           return_from_repair             repaired
                                                         irreparable
```

### 3.2 Movement Type Details

| Category | Type | Effect on Stock | Requires Reference? | Lock Level |
|----------|------|-----------------|---------------------|------------|
| **inflow** | `opening_stock` | +available, +total | No | None |
| **inflow** | `purchase` | +available, +total | No (optional PO) | None |
| **outflow** | `allocation` | -available, +allocated | Yes (sub/event) | **HARD LOCK** |
| **outflow** | `disposal` | -available, -total | No | None |
| **return** | `return_good` | +available, -allocated | Yes (sub/event) | — |
| **return** | `return_damaged` | +damaged, -allocated | Yes (sub/event) | — |
| **writeoff** | `damage_warehouse` | +damaged, -available | No | None |
| **writeoff** | `damage_client` | +damaged, -allocated | Yes (sub/event) | — |
| **writeoff** | `loss` | +lost, -allocated OR -available | Optional | None |
| **adjustment** | `adjustment_positive` | +available, +total | No | None |
| **adjustment** | `adjustment_negative` | -available, -total | No | None |
| **repair** | `send_to_repair` | +in_repair, -damaged | No | None |
| **repair** | `return_from_repair` | +available, -in_repair OR disposal | No | None |

### 3.3 Quantity Column Effects by Movement

```sql
-- STOCK BALANCE EQUATION (always true):
-- total_quantity = available + allocated + damaged + in_repair + lost

-- Each movement type affects specific columns:

-- INFLOW
opening_stock:        available +N, total +N
purchase:             available +N, total +N

-- OUTFLOW
allocation:           available -N, allocated +N
disposal:             available -N, total -N  (or damaged -N, total -N)

-- RETURN
return_good:          available +N, allocated -N
return_damaged:       damaged +N, allocated -N

-- WRITEOFF  
damage_warehouse:     damaged +N, available -N
damage_client:        damaged +N, allocated -N
loss (from avail):    lost +N, available -N, total -N
loss (from alloc):    lost +N, allocated -N, total -N

-- ADJUSTMENT
adjustment_positive:  available +N, total +N
adjustment_negative:  available -N, total -N

-- REPAIR
send_to_repair:       in_repair +N, damaged -N
return_from_repair:   available +N, in_repair -N  (if repaired)
                      total -N, in_repair -N      (if irreparable → dispose)
```

---

## Part 4: Integration with Subscriptions & Events

### 4.1 Subscription Integration

```
┌────────────────────────────────────────────────────────────────────────┐
│                 SUBSCRIPTION INVENTORY LIFECYCLE                       │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SUBSCRIPTION CREATED (status = 'draft' or 'pending')                  │
│  ─────────────────────────────────────────────────────                 │
│  • NO inventory action                                                  │
│  • Subscription may define planned dishware kit (optional)              │
│                                                                         │
│         │                                                               │
│         ▼                                                               │
│                                                                         │
│  SUBSCRIPTION ACTIVATED (status = 'active')                            │
│  ──────────────────────────────────────────                            │
│  • IF dishware kit defined:                                             │
│      → Create ALLOCATION movements for each item                        │
│      → Create/update inventory_allocations records                      │
│      → Decrement available_quantity, increment allocated_quantity       │
│  • IF no kit defined:                                                   │
│      → No automatic action; manual allocation later                     │
│                                                                         │
│         │                                                               │
│         ▼                                                               │
│                                                                         │
│  SUBSCRIPTION ACTIVE (ongoing)                                         │
│  ─────────────────────────────                                         │
│  • Manager can: add more items, process returns, record damage/loss    │
│  • Each action creates a movement + updates allocation                  │
│  • Outstanding = allocated - returned - damaged - lost                  │
│                                                                         │
│         │                                                               │
│         ▼                                                               │
│                                                                         │
│  SUBSCRIPTION PAUSED (status = 'paused')                               │
│  ───────────────────────────────────────                               │
│  • Inventory remains allocated (client still has dishes)                │
│  • No automatic returns                                                 │
│  • Manager can still process returns/damage if client returns items     │
│                                                                         │
│         │                                                               │
│         ▼                                                               │
│                                                                         │
│  SUBSCRIPTION CANCELLED (status = 'cancelled')                         │
│  ─────────────────────────────────────────────                         │
│  • Trigger: REQUIRE outstanding resolution                              │
│     Option A: Auto-return all outstanding (assume good return)          │
│     Option B: Block cancellation until outstanding = 0                  │
│     Option C: Force record damage/loss for outstanding                  │
│  • Close all allocations (is_active = false)                            │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Event Integration

```
┌────────────────────────────────────────────────────────────────────────┐
│                    EVENT INVENTORY LIFECYCLE                           │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  EVENT CREATED (status = 'planned')                                    │
│  ──────────────────────────────────                                    │
│  • Define planned dishware requirements                                 │
│  • CHECK availability (soft reserve, no actual allocation)              │
│  • Show warning if insufficient stock                                   │
│                                                                         │
│         │                                                               │
│         ▼                                                               │
│                                                                         │
│  EVENT CONFIRMED / DISPATCHED (e.g., day before event)                 │
│  ─────────────────────────────────────────────────────                 │
│  • Create ALLOCATION movements                                          │
│  • Items physically leave warehouse                                     │
│  • Decrement available_quantity                                         │
│  • Create allocation records                                            │
│                                                                         │
│         │                                                               │
│         ▼                                                               │
│                                                                         │
│  EVENT DAY                                                             │
│  ─────────                                                             │
│  • Inventory is at client location                                     │
│  • No system actions                                                    │
│                                                                         │
│         │                                                               │
│         ▼                                                               │
│                                                                         │
│  POST-EVENT PROCESSING (day after)                                     │
│  ─────────────────────────────────                                     │
│  • MANDATORY: Record return details                                     │
│     → return_good: items back in good condition                        │
│     → return_damaged: items back but damaged                           │
│     → damage_client: items not returned, confirmed damaged             │
│     → loss: items not returned, considered lost                         │
│  • Continue until outstanding = 0                                       │
│                                                                         │
│         │                                                               │
│         ▼                                                               │
│                                                                         │
│  EVENT COMPLETED (status = 'completed')                                │
│  ───────────────────────────────────────                               │
│  • Requires: all allocations closed (outstanding = 0)                   │
│  • OR: Admin override with loss/damage recording                        │
│                                                                         │
│                                                                         │
│  EVENT CANCELLED (status = 'cancelled')                                │
│  ───────────────────────────────────────                               │
│  • IF before dispatch (no allocation yet):                             │
│     → No inventory action                                              │
│  • IF after dispatch (allocations exist):                              │
│     → Same as post-event: must record return/damage/loss               │
│     → Can auto-return if items never left (cancellation before pickup) │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Allocation Table Design

```sql
-- Enhanced allocation table
CREATE TABLE inventory_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  
  -- Reference
  reference_type TEXT NOT NULL CHECK (reference_type IN ('subscription', 'event')),
  reference_id UUID NOT NULL,
  
  -- Quantities (all derived from movements, but cached for performance)
  original_quantity INTEGER NOT NULL,      -- Initial allocation
  returned_quantity INTEGER DEFAULT 0,     -- Returned in good condition
  damaged_quantity INTEGER DEFAULT 0,      -- Returned damaged or confirmed damaged
  lost_quantity INTEGER DEFAULT 0,         -- Confirmed lost
  
  -- Derived (computed column or view)
  -- outstanding_quantity = original - returned - damaged - lost
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'completed', 'cancelled')),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES user_profiles(id),
  
  -- Prevent duplicates
  CONSTRAINT unique_allocation UNIQUE (inventory_item_id, reference_type, reference_id)
);
```

---

## Part 5: Stock Adjustment Flows

### 5.1 Adjustment Types

| Scenario | Movement Type | Reason Code | Who Can Do |
|----------|---------------|-------------|------------|
| Physical count finds MORE than book | `adjustment_positive` | `audit_surplus` | Admin |
| Physical count finds LESS than book | `adjustment_negative` | `audit_shortage` | Admin |
| Found items previously thought lost | `adjustment_positive` | `found_stock` | Admin |
| Correcting data entry error (add) | `adjustment_positive` | `count_correction` | Admin |
| Correcting data entry error (remove) | `adjustment_negative` | `count_correction` | Admin |

### 5.2 Physical Count Reconciliation Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                    PHYSICAL COUNT WORKFLOW                             │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  STEP 1: INITIATE COUNT                                                │
│  ──────────────────────                                                │
│  • Manager selects outlet + item(s) to count                           │
│  • System displays current BOOK quantities                             │
│  • Creates "count session" record (optional tracking)                  │
│                                                                         │
│  STEP 2: RECORD PHYSICAL COUNTS                                        │
│  ──────────────────────────────                                        │
│  • Manager enters physical count per item                              │
│  • System calculates variance: physical - book                         │
│  • Highlights discrepancies                                            │
│                                                                         │
│  STEP 3: EXPLAIN VARIANCES                                             │
│  ─────────────────────────                                             │
│  • For each variance, manager must:                                    │
│     - Select reason code                                               │
│     - Add notes (optional for small variances, required for large)     │
│  • Large variance (> 10%) requires admin approval                      │
│                                                                         │
│  STEP 4: CREATE ADJUSTMENTS                                            │
│  ──────────────────────────                                            │
│  • System creates adjustment_positive or adjustment_negative movements │
│  • Movements update inventory_items quantities via trigger             │
│  • Count session marked complete                                       │
│                                                                         │
│  STEP 5: AUDIT TRAIL                                                   │
│  ───────────────────                                                   │
│  • All adjustments visible in movement history                         │
│  • Monthly adjustment reports for admin review                         │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Breakage Flow (Warehouse)

```
┌────────────────────────────────────────────────────────────────────────┐
│                    WAREHOUSE BREAKAGE FLOW                             │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SCENARIO: Item breaks in warehouse (not with client)                  │
│                                                                         │
│  ACTION:                                                               │
│  ───────                                                               │
│  1. Manager creates movement:                                           │
│     - movement_type: damage_warehouse                                  │
│     - reason_code: handling_damage or storage_damage                   │
│     - notes: describe what happened                                    │
│                                                                         │
│  2. Trigger updates quantities:                                         │
│     - available_quantity -= N                                          │
│     - damaged_quantity += N                                            │
│     (total_quantity unchanged — item still exists, just damaged)       │
│                                                                         │
│  SUBSEQUENT ACTION:                                                    │
│  ──────────────────                                                    │
│  Option A: Send to repair                                              │
│     - movement_type: send_to_repair                                    │
│     - damaged_quantity -= N, in_repair_quantity += N                   │
│                                                                         │
│  Option B: Dispose                                                     │
│     - movement_type: disposal                                          │
│     - reason_code: unrepairable                                        │
│     - damaged_quantity -= N, total_quantity -= N                       │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.4 Client Loss/Damage Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                    CLIENT LOSS/DAMAGE FLOW                             │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SCENARIO: Client reports items lost or damaged                        │
│                                                                         │
│  LOSS (item gone):                                                     │
│  ─────────────────                                                     │
│  1. Manager creates movement:                                           │
│     - movement_type: loss                                              │
│     - reason_code: client_lost                                         │
│     - reference_type: subscription/event                               │
│     - reference_id: the subscription/event ID                          │
│                                                                         │
│  2. Trigger updates:                                                    │
│     - allocated_quantity -= N                                          │
│     - lost_quantity += N                                               │
│     - total_quantity -= N (item no longer owned)                       │
│                                                                         │
│  3. Allocation record updated:                                          │
│     - lost_quantity += N                                               │
│     - outstanding recalculated                                         │
│                                                                         │
│  DAMAGE (item returned but broken):                                    │
│  ───────────────────────────────────                                   │
│  1. Manager creates movement:                                           │
│     - movement_type: return_damaged OR damage_client                   │
│     - reason_code: client_damage                                       │
│     - reference_type/id: the subscription/event                        │
│                                                                         │
│  2. Trigger updates:                                                    │
│     - allocated_quantity -= N                                          │
│     - damaged_quantity += N                                            │
│     (total unchanged — item still exists in warehouse)                 │
│                                                                         │
│  3. Follow repair or disposal flow                                     │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Part 6: Opening Stock Handling

### 6.1 The Problem with Current System

Current system treats `stock_in` with notes "Initial stock" the same as any other movement, locking the item from deletion forever.

### 6.2 New Approach: Opening Stock is Correctable

```sql
-- New movement tracking for opening balance
CREATE TYPE opening_balance_status AS ENUM (
  'provisional',  -- Can be corrected
  'confirmed'     -- Locked
);

-- Add to inventory_items
ALTER TABLE inventory_items ADD COLUMN opening_balance_confirmed BOOLEAN DEFAULT false;
```

### 6.3 Opening Balance Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                    OPENING BALANCE HANDLING                            │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ITEM CREATED WITH INITIAL STOCK:                                      │
│  ─────────────────────────────────                                     │
│  1. Item created in 'draft' status                                     │
│  2. opening_stock movement created with reason 'opening_balance'       │
│  3. opening_balance_confirmed = false (provisional)                    │
│                                                                         │
│  CORRECTION ALLOWED (while provisional):                               │
│  ────────────────────────────────────────                              │
│  • Can create adjustment_positive or adjustment_negative               │
│  • Reason: 'opening_balance_correction'                                │
│  • Multiple corrections allowed                                        │
│                                                                         │
│  CONFIRMATION (locks opening balance):                                 │
│  ─────────────────────────────────────                                 │
│  Triggered by ANY of:                                                  │
│  • First ALLOCATION movement (item in use with customer)               │
│  • Admin explicitly confirms opening balance                           │
│  • 7 days after creation (auto-confirm)                                │
│                                                                         │
│  AFTER CONFIRMATION:                                                   │
│  ───────────────────                                                   │
│  • opening_balance_confirmed = true                                    │
│  • Opening balance corrections require admin + reason                  │
│  • Item cannot be deleted (if stock > 0)                               │
│                                                                         │
│  DELETE RULES (even after opening balance):                            │
│  ───────────────────────────────────────────                           │
│  • IF total_quantity = 0 AND no allocation movements → can delete      │
│  • IF any allocation movements → CANNOT delete (use discontinue)       │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Opening Balance Correction Movement

```sql
-- Special movement for opening balance correction
INSERT INTO inventory_movements (
  outlet_id,
  inventory_item_id,
  movement_category,
  movement_type,
  quantity,
  reference_type,
  reason_code,
  notes,
  created_by
) VALUES (
  :outlet_id,
  :item_id,
  'adjustment',
  'adjustment_negative',  -- or adjustment_positive
  :quantity,
  'manual',
  'opening_balance_correction',
  'Correcting initial stock entry from X to Y',
  :user_id
);
```

---

## Part 7: Database-Level Rules

### 7.1 Core Constraints

```sql
-- Quantity balance (existing, keep)
CONSTRAINT quantity_balance CHECK (
  total_quantity = available_quantity + allocated_quantity + 
                   damaged_quantity + in_repair_quantity
  -- Note: lost_quantity is tracked but reduces total
)

-- No negative quantities (existing, keep)
CONSTRAINT no_negative_available CHECK (available_quantity >= 0)
CONSTRAINT no_negative_allocated CHECK (allocated_quantity >= 0)
CONSTRAINT no_negative_damaged CHECK (damaged_quantity >= 0)
CONSTRAINT no_negative_repair CHECK (in_repair_quantity >= 0)
CONSTRAINT no_negative_total CHECK (total_quantity >= 0)
```

### 7.2 Trigger Rules (BEFORE INSERT on movements)

```sql
CREATE OR REPLACE FUNCTION validate_movement_v2()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_user_role TEXT;
  v_has_allocations BOOLEAN;
BEGIN
  -- Get item
  SELECT * INTO v_item FROM inventory_items WHERE id = NEW.inventory_item_id;
  
  -- Get user role
  SELECT role INTO v_user_role FROM user_profiles WHERE id = NEW.created_by;
  
  -- RULE 1: Quantity must be positive
  IF NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'Movement quantity must be greater than zero';
  END IF;
  
  -- RULE 2: Outlet must match
  IF v_item.outlet_id != NEW.outlet_id THEN
    RAISE EXCEPTION 'Movement outlet must match item outlet';
  END IF;
  
  -- RULE 3: Item must be in valid lifecycle state
  IF v_item.lifecycle_status NOT IN ('draft', 'active') THEN
    IF NEW.movement_category NOT IN ('return', 'writeoff') THEN
      RAISE EXCEPTION 'Cannot add stock to discontinued/archived items';
    END IF;
  END IF;
  
  -- RULE 4: Allocations only from ACTIVE items
  IF NEW.movement_type = 'allocation' AND v_item.lifecycle_status != 'active' THEN
    RAISE EXCEPTION 'Can only allocate from active items';
  END IF;
  
  -- RULE 5: Check stock availability for outflow
  IF NEW.movement_category = 'outflow' THEN
    IF v_item.available_quantity < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient available stock. Available: %, Requested: %',
        v_item.available_quantity, NEW.quantity;
    END IF;
  END IF;
  
  -- RULE 6: Returns must have valid allocation
  IF NEW.movement_category = 'return' THEN
    -- Validate allocation exists and has outstanding
    -- (detailed validation in allocation sync trigger)
  END IF;
  
  -- RULE 7: Adjustments require admin (for confirmed opening balance)
  IF NEW.movement_category = 'adjustment' THEN
    IF v_item.opening_balance_confirmed = true AND v_user_role != 'admin' THEN
      RAISE EXCEPTION 'Only admins can adjust stock after opening balance is confirmed';
    END IF;
    IF NEW.notes IS NULL OR NEW.notes = '' THEN
      RAISE EXCEPTION 'Adjustment movements require notes';
    END IF;
  END IF;
  
  -- RULE 8: Negative adjustments cannot exceed available
  IF NEW.movement_type = 'adjustment_negative' THEN
    IF v_item.available_quantity < NEW.quantity THEN
      RAISE EXCEPTION 'Cannot adjust below zero. Available: %, Adjustment: %',
        v_item.available_quantity, NEW.quantity;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 7.3 Deletion Prevention Trigger

```sql
CREATE OR REPLACE FUNCTION prevent_item_deletion_v2()
RETURNS TRIGGER AS $$
DECLARE
  v_has_allocation_movements BOOLEAN;
  v_has_stock BOOLEAN;
BEGIN
  -- Allow delete only if:
  -- 1. No allocation movements (allocations to subscriptions/events)
  -- 2. Total quantity is 0

  SELECT EXISTS (
    SELECT 1 FROM inventory_movements
    WHERE inventory_item_id = OLD.id
      AND movement_category IN ('outflow', 'return', 'writeoff')
      AND reference_type IN ('subscription', 'event')
  ) INTO v_has_allocation_movements;
  
  IF v_has_allocation_movements THEN
    RAISE EXCEPTION 'Cannot delete item with customer allocation history. Use discontinue instead.';
  END IF;
  
  IF OLD.total_quantity > 0 THEN
    RAISE EXCEPTION 'Cannot delete item with stock. Write-off or dispose stock first.';
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_inventory_delete
  BEFORE DELETE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION prevent_item_deletion_v2();
```

---

## Part 8: Service-Level Rules

### 8.1 Service Layer Validation

```typescript
// inventoryService.ts - enhanced

export async function deleteInventoryItem(
  userId: string,
  itemId: string
): Promise<{ success: boolean; reason?: string }> {
  
  // Pre-flight checks (before hitting DB trigger)
  const item = await getInventoryItemById(userId, itemId);
  
  // Check 1: Lifecycle state
  if (item.lifecycle_status === 'archived') {
    return { success: false, reason: 'Archived items cannot be deleted' };
  }
  
  // Check 2: Has stock
  if (item.total_quantity > 0) {
    return { 
      success: false, 
      reason: `Item has ${item.total_quantity} units. Dispose or write-off first.` 
    };
  }
  
  // Check 3: Has customer allocations
  const hasAllocations = await checkHasCustomerAllocations(itemId);
  if (hasAllocations) {
    return {
      success: false,
      reason: 'Item has customer allocation history. Use discontinue instead.',
      suggestedAction: 'discontinue'
    };
  }
  
  // Safe to delete
  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', itemId);
    
  if (error) {
    return { success: false, reason: error.message };
  }
  
  return { success: true };
}

export async function discontinueInventoryItem(
  userId: string,
  itemId: string
): Promise<{ success: boolean; reason?: string }> {
  
  const item = await getInventoryItemById(userId, itemId);
  
  // Cannot discontinue if items still allocated
  if (item.allocated_quantity > 0) {
    return {
      success: false,
      reason: `${item.allocated_quantity} units still allocated. Resolve allocations first.`
    };
  }
  
  const { error } = await supabase
    .from('inventory_items')
    .update({ lifecycle_status: 'discontinued' })
    .eq('id', itemId);
    
  if (error) {
    return { success: false, reason: error.message };
  }
  
  return { success: true };
}
```

### 8.2 Movement Creation Rules

```typescript
// inventoryMovementService.ts - enhanced

export async function createMovement(
  userId: string,
  input: CreateMovementInput
): Promise<InventoryMovement> {
  
  // Service-level validations before DB
  
  // Rule 1: Accountants can only view
  const role = await getUserRole(userId);
  if (role === 'accountant') {
    throw new Error('Accountants cannot create movements');
  }
  
  // Rule 2: Only admins can do adjustments (after opening confirmed)
  if (input.movement_category === 'adjustment') {
    const item = await getItemById(input.inventory_item_id);
    if (item.opening_balance_confirmed && role !== 'admin') {
      throw new Error('Only admins can adjust confirmed inventory');
    }
  }
  
  // Rule 3: Allocations require valid reference
  if (input.movement_type === 'allocation') {
    if (!input.reference_id || !['subscription', 'event'].includes(input.reference_type)) {
      throw new Error('Allocation requires valid subscription or event reference');
    }
    await validateReferenceExists(input.reference_type, input.reference_id);
  }
  
  // Rule 4: Notes required for certain movements
  if (['adjustment_positive', 'adjustment_negative', 'loss', 'damage_client'].includes(input.movement_type)) {
    if (!input.notes || input.notes.trim() === '') {
      throw new Error(`Notes are required for ${input.movement_type} movements`);
    }
  }
  
  // Insert (DB triggers handle quantity updates)
  const { data, error } = await supabase
    .from('inventory_movements')
    .insert({
      outlet_id: input.outlet_id,
      inventory_item_id: input.inventory_item_id,
      movement_category: input.movement_category,
      movement_type: input.movement_type,
      quantity: input.quantity,
      reference_type: input.reference_type || 'manual',
      reference_id: input.reference_id || null,
      reason_code: input.reason_code,
      notes: input.notes,
      created_by: userId,
    })
    .select()
    .single();
    
  if (error) {
    throw new Error(error.message);
  }
  
  return data;
}
```

---

## Part 9: Minimum UI Actions Required

### 9.1 Item Management UI

| Screen | Actions | Priority |
|--------|---------|----------|
| **Item List** | View items, filter by status/category/outlet, search | P0 |
| **Item Detail** | View all item info, stock breakdown, movement history | P0 |
| **Create Item** | Create with opening stock, select outlet/category | P0 |
| **Edit Item** | Edit metadata, view what's locked | P0 |
| **Delete Item** | Delete (with pre-checks), show why blocked if blocked | P0 |
| **Discontinue** | Mark as discontinued, show what's blocking if blocked | P0 |
| **Reactivate** | Reverse discontinue | P1 |

### 9.2 Stock Operations UI

| Screen | Actions | Priority |
|--------|---------|----------|
| **Add Stock** | Purchase, transfer in, found stock | P0 |
| **Stock Adjustment** | Positive/negative adjustment, reason, notes | P0 |
| **Physical Count** | Side-by-side book vs physical, generate adjustments | P1 |
| **Write-off** | Dispose, warehouse damage, loss | P0 |
| **Repair Flow** | Send to repair, return from repair | P2 |

### 9.3 Allocation Operations UI

| Screen | Actions | Priority |
|--------|---------|----------|
| **Allocate to Subscription** | Select items, quantities, create allocation | P0 |
| **Allocate to Event** | Select items, quantities, create allocation | P0 |
| **Process Return** | Return good, return damaged, record loss | P0 |
| **View Allocations** | By subscription, by event, by item | P0 |
| **Close Allocation** | Force close with reason | P1 |

### 9.4 Reports UI

| Report | Purpose | Priority |
|--------|---------|----------|
| **Stock Summary** | Current stock by item, outlet | P0 |
| **Movement History** | Audit trail, filters by type/date/item | P0 |
| **Outstanding Allocations** | What's still with clients | P0 |
| **Damage/Loss Report** | Track damage rates by client, item | P1 |
| **Adjustment Report** | Admin audit of all adjustments | P1 |
| **Inventory Valuation** | Stock value for accounting | P2 |

---

## Part 10: Safe Migration Strategy

### 10.1 Migration Phases

```
┌────────────────────────────────────────────────────────────────────────┐
│                      MIGRATION PHASES                                  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PHASE 1: SCHEMA EXTENSION (Non-breaking)                              │
│  ─────────────────────────────────────────                             │
│  Week 1-2                                                              │
│  • Add new columns with defaults (lifecycle_status, reason_code, etc.) │
│  • Add new movement_category column                                    │
│  • Backfill existing data                                               │
│  • Keep old columns, old triggers active                               │
│  • Deploy to staging, test                                              │
│                                                                         │
│  PHASE 2: DUAL-WRITE (Parallel)                                        │
│  ──────────────────────────────                                        │
│  Week 3-4                                                              │
│  • New code writes to both old and new columns                          │
│  • Old triggers still work                                              │
│  • New triggers added (disabled initially)                             │
│  • Verify data consistency                                              │
│                                                                         │
│  PHASE 3: CUTOVER (Switch)                                             │
│  ─────────────────────────                                             │
│  Week 5                                                                │
│  • Enable new triggers                                                  │
│  • Disable old triggers                                                 │
│  • Update service layer to use new columns                             │
│  • Monitor for issues                                                   │
│                                                                         │
│  PHASE 4: CLEANUP                                                      │
│  ────────────────                                                      │
│  Week 6+                                                               │
│  • Remove old columns (after stable period)                            │
│  • Remove old triggers                                                  │
│  • Update documentation                                                 │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Migration SQL - Phase 1

```sql
-- ================================================================
-- PHASE 1: SCHEMA EXTENSION (Non-breaking)
-- ================================================================

-- Step 1.1: Add lifecycle_status to inventory_items
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'active'
CHECK (lifecycle_status IN ('draft', 'active', 'discontinued', 'archived'));

-- Step 1.2: Add opening_balance_confirmed flag
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS opening_balance_confirmed BOOLEAN DEFAULT true;
-- Default true for existing items (they're already in use)

-- Step 1.3: Add in_repair_quantity
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS in_repair_quantity INTEGER DEFAULT 0
CHECK (in_repair_quantity >= 0);

-- Step 1.4: Backfill lifecycle_status from is_active
UPDATE inventory_items 
SET lifecycle_status = CASE 
  WHEN is_active = true THEN 'active'
  ELSE 'discontinued'
END
WHERE lifecycle_status IS NULL;

-- Step 1.5: Add movement_category to inventory_movements
ALTER TABLE inventory_movements
ADD COLUMN IF NOT EXISTS movement_category TEXT;

-- Step 1.6: Add reason_code to inventory_movements
ALTER TABLE inventory_movements
ADD COLUMN IF NOT EXISTS reason_code TEXT;

-- Step 1.7: Backfill movement_category from movement_type
UPDATE inventory_movements SET movement_category = CASE
  WHEN movement_type = 'stock_in' THEN 'inflow'
  WHEN movement_type = 'allocation' THEN 'outflow'
  WHEN movement_type = 'return' THEN 'return'
  WHEN movement_type IN ('damage', 'loss') THEN 'writeoff'
  WHEN movement_type = 'adjustment' THEN 'adjustment'
  ELSE 'unknown'
END
WHERE movement_category IS NULL;

-- Step 1.8: Create index on new columns
CREATE INDEX IF NOT EXISTS idx_items_lifecycle ON inventory_items(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_movements_category ON inventory_movements(movement_category);
```

### 10.3 Data Preservation

```sql
-- Create audit table for migration tracking
CREATE TABLE IF NOT EXISTS inventory_migration_log (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  old_values JSONB,
  new_values JSONB,
  migrated_at TIMESTAMPTZ DEFAULT now(),
  migrated_by TEXT DEFAULT 'system'
);

-- Log all changes during migration
CREATE OR REPLACE FUNCTION log_inventory_migration()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO inventory_migration_log (table_name, record_id, old_values, new_values)
  VALUES (TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Enable migration logging
CREATE TRIGGER log_items_migration
  AFTER UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION log_inventory_migration();

CREATE TRIGGER log_movements_migration
  AFTER UPDATE ON inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION log_inventory_migration();
```

### 10.4 Rollback Plan

```sql
-- If migration fails, rollback to original state

-- Step 1: Restore is_active from lifecycle_status
UPDATE inventory_items 
SET is_active = (lifecycle_status != 'discontinued' AND lifecycle_status != 'archived');

-- Step 2: Drop new columns
ALTER TABLE inventory_items DROP COLUMN IF EXISTS lifecycle_status;
ALTER TABLE inventory_items DROP COLUMN IF EXISTS opening_balance_confirmed;
ALTER TABLE inventory_items DROP COLUMN IF EXISTS in_repair_quantity;
ALTER TABLE inventory_movements DROP COLUMN IF EXISTS movement_category;
ALTER TABLE inventory_movements DROP COLUMN IF EXISTS reason_code;

-- Step 3: Re-enable old triggers (if disabled)
-- (specific commands depend on what was disabled)

-- Step 4: Drop migration log table
DROP TABLE IF EXISTS inventory_migration_log;
```

---

## Appendix A: Type Definitions

```typescript
// types/inventory.ts

export type LifecycleStatus = 'draft' | 'active' | 'discontinued' | 'archived';

export type MovementCategory = 'inflow' | 'outflow' | 'return' | 'writeoff' | 'adjustment' | 'repair';

export type MovementType = 
  // Inflow
  | 'opening_stock'
  | 'purchase'
  // Outflow
  | 'allocation'
  | 'disposal'
  | 'transfer_out'
  // Return
  | 'return_good'
  | 'return_damaged'
  // Writeoff
  | 'damage_warehouse'
  | 'damage_client'
  | 'loss'
  // Adjustment
  | 'adjustment_positive'
  | 'adjustment_negative'
  // Repair
  | 'send_to_repair'
  | 'return_from_repair';

export type ReasonCode = 
  // Inflow reasons
  | 'opening_balance'
  | 'new_purchase'
  | 'gift_received'
  | 'transfer_in'
  // Allocation reasons
  | 'subscription_start'
  | 'event_dispatch'
  | 'additional_dispatch'
  // Disposal reasons
  | 'end_of_life'
  | 'unrepairable'
  | 'audit_writeoff'
  // Return reasons
  | 'normal_return'
  | 'early_return'
  | 'client_damage'
  | 'transit_damage'
  // Damage reasons
  | 'handling_damage'
  | 'storage_damage'
  | 'client_reported'
  | 'delivery_damage'
  // Loss reasons
  | 'client_lost'
  | 'transit_lost'
  | 'theft'
  // Adjustment reasons
  | 'audit_surplus'
  | 'audit_shortage'
  | 'found_stock'
  | 'missing_stock'
  | 'count_correction'
  | 'opening_balance_correction';

export interface InventoryItemV2 {
  id: string;
  outlet_id: string;
  name: string;
  sku: string | null;
  category: string;
  material: string | null;
  unit: string;
  
  // Lifecycle
  lifecycle_status: LifecycleStatus;
  opening_balance_confirmed: boolean;
  
  // Quantities
  total_quantity: number;
  available_quantity: number;
  allocated_quantity: number;
  damaged_quantity: number;
  in_repair_quantity: number;
  
  // Cost tracking (optional)
  unit_cost: number | null;
  
  // Audit
  created_by: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined
  outlet_name?: string;
  outlet_code?: string;
}

export interface InventoryMovementV2 {
  id: string;
  outlet_id: string;
  inventory_item_id: string;
  
  // Movement classification
  movement_category: MovementCategory;
  movement_type: MovementType;
  reason_code: ReasonCode | null;
  
  // Quantity (always positive)
  quantity: number;
  
  // Reference
  reference_type: 'subscription' | 'event' | 'manual';
  reference_id: string | null;
  
  // Audit
  notes: string | null;
  created_by: string;
  created_at: string;
  
  // Joined
  item_name?: string;
  reference_name?: string;
  created_by_name?: string;
}
```

---

## Appendix B: Quick Reference Card

### Can I Delete This Item?

```
total_quantity > 0?
  └── NO → "Dispose or write-off stock first"
  
Has allocation movements (to subscription/event)?
  └── YES → "Has customer history → Discontinue instead"
  
Otherwise → ✅ DELETE ALLOWED
```

### Can I Discontinue This Item?

```
allocated_quantity > 0?
  └── YES → "Resolve outstanding allocations first"
  
Otherwise → ✅ DISCONTINUE ALLOWED
```

### Movement Creates Lock?

```
reference_type = 'subscription' or 'event'?
  └── YES → 🔒 LOCKS ITEM (cannot delete, only discontinue)
  └── NO → No lock
```

### Who Can Do What?

| Action | Manager | Admin |
|--------|---------|-------|
| Create item | ✅ | ✅ |
| Edit item | ✅ | ✅ |
| Delete item (unlocked) | ❌ | ✅ |
| Discontinue | ✅ | ✅ |
| Add stock | ✅ | ✅ |
| Allocate | ✅ | ✅ |
| Process return | ✅ | ✅ |
| Adjustment (before confirmed) | ✅ | ✅ |
| Adjustment (after confirmed) | ❌ | ✅ |
| Archive | ❌ | ✅ |

---

*End of Specification*
