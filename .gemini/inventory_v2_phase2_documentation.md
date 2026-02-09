# Inventory v2.0 - Phase 2 Complete Documentation

## Migration File
`supabase/025_inventory_v2_phase2_behaviour.sql`

---

## 1. Architecture Overview

### 1.1 Core Principle: Movement-Based Inventory

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INVENTORY DATA FLOW                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   USER ACTION                                                        │
│       │                                                              │
│       ▼                                                              │
│   ┌─────────────────────┐                                           │
│   │ inventory_movements │  ← SINGLE SOURCE OF TRUTH                  │
│   │   (append-only)     │    • Never updated                        │
│   │                     │    • Never deleted                        │
│   └────────┬────────────┘    • Complete audit trail                 │
│            │                                                         │
│            │ TRIGGER: update_quantities_v2()                        │
│            ▼                                                         │
│   ┌─────────────────────┐                                           │
│   │  inventory_items    │  ← DERIVED STATE                          │
│   │  (quantities)       │    • Never directly modified              │
│   │                     │    • Always matches movement sum          │
│   └────────┬────────────┘                                           │
│            │                                                         │
│            │ TRIGGER: sync_allocation_on_movement()                 │
│            ▼                                                         │
│   ┌─────────────────────┐                                           │
│   │ inventory_allocations│ ← CURRENT STATE                          │
│   │  (who has what)     │    • Who has items right now              │
│   │                     │    • Outstanding = DERIVED at query time  │
│   └─────────────────────┘                                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Quantity Balance Equation

```sql
-- V2 Balance Equation (includes in_repair_quantity)
total_quantity = available_quantity 
               + allocated_quantity 
               + damaged_quantity 
               + in_repair_quantity

-- Note: lost_quantity is tracked separately but REDUCES total
-- When loss occurs: total_quantity -= loss_amount
```

### 1.3 Movement Classification

```
movement_category    movement_type              Effect on Quantities
─────────────────    ─────────────              ────────────────────
inflow               opening_stock              +available, +total
                     purchase

outflow              allocation                 -available, +allocated
                     
return               return_good                +available, -allocated
                     return_damaged             +damaged, -allocated

writeoff             damage_warehouse           +damaged, -available
                     damage_client              +damaged, -allocated
                     loss (from allocated)      +lost, -allocated, -total
                     loss (from available)      +lost, -available, -total
                     disposal                   -damaged, -total

adjustment           adjustment_positive        +available, +total
                     adjustment_negative        -available, -total

repair               send_to_repair             +in_repair, -damaged
                     return_from_repair         +available, -in_repair
                                               OR -total, -in_repair (if irreparable)
```

---

## 2. Stock Flow Details

### 2.1 INFLOW (Adds Stock)

**Trigger Path:** `movement_category = 'inflow'`

```sql
-- Effect:
available_quantity += quantity
total_quantity += quantity
```

| Scenario | reason_code | Example |
|----------|-------------|---------|
| Initial stock setup | `opening_balance` | "Starting with 100 plates" |
| New purchase | `new_purchase` | "Bought 50 more glasses" |
| Gift/transfer in | `gift_received`, `transfer_in` | "Received 20 bowls from HQ" |

**Validation:**
- Item must be in `draft` or `active` lifecycle
- Required: `movement_category`, `quantity > 0`

---

### 2.2 OUTFLOW (Allocation to Customer)

**Trigger Path:** `movement_category = 'outflow'`

```sql
-- Effect:
available_quantity -= quantity
allocated_quantity += quantity
opening_balance_confirmed = true  -- Auto-lock
```

| Scenario | reason_code | Example |
|----------|-------------|---------|
| Subscription start | `subscription_start` | "Allocated 50 plates to ABC Corp" |
| Event dispatch | `event_dispatch` | "Sent 200 dishes to wedding" |
| Additional send | `additional_dispatch` | "Client requested 10 more" |

**Validation:**
- Item MUST be `active` lifecycle (not draft, discontinued, archived)
- `available_quantity >= requested quantity`
- Reference MUST be valid subscription or event
- **Side Effect:** Locks opening balance permanently

---

### 2.3 RETURN (Items Come Back)

**Trigger Path:** `movement_category = 'return'`

```sql
-- Return Good:
available_quantity += quantity
allocated_quantity -= quantity

-- Return Damaged:
damaged_quantity += quantity
allocated_quantity -= quantity
```

| Scenario | reason_code | Quantity Effect |
|----------|-------------|-----------------|
| Normal return | `normal_return` | +available, -allocated |
| Early return | `early_return` | +available, -allocated |
| Client damage | `client_damage` | +damaged, -allocated |
| Transit damage | `transit_damage` | +damaged, -allocated |

**Validation:**
- Must have active allocation for reference
- Cannot return more than outstanding
- Reference required (subscription/event)

---

### 2.4 WRITEOFF (Permanent Removal)

**Trigger Path:** `movement_category = 'writeoff'`

**A. Warehouse Damage** (from available stock)
```sql
damaged_quantity += quantity
available_quantity -= quantity
-- total unchanged (item still exists, just damaged)
```

**B. Client Damage** (from allocated stock)
```sql
damaged_quantity += quantity
allocated_quantity -= quantity
-- total unchanged
```

**C. Loss** (item gone forever)
```sql
lost_quantity += quantity
allocated_quantity -= quantity  -- or available
total_quantity -= quantity      -- REDUCED
```

**D. Disposal** (damaged item removed)
```sql
damaged_quantity -= quantity
total_quantity -= quantity
```

| Scenario | reason_code | Effect |
|----------|-------------|--------|
| Broke in warehouse | `handling_damage` | available → damaged |
| Client broke it | `client_damage` | allocated → damaged |
| Client lost it | `client_lost` | allocated → lost, -total |
| Cannot repair | `unrepairable` | damaged → removed, -total |
| End of life | `end_of_life` | damaged → removed, -total |

---

### 2.5 ADJUSTMENT (Corrections)

**Trigger Path:** `movement_category = 'adjustment'`

```sql
-- Positive:
available_quantity += quantity
total_quantity += quantity

-- Negative:
available_quantity -= quantity
total_quantity -= quantity
```

| Scenario | reason_code | Who Can Do |
|----------|-------------|------------|
| Found extra stock | `audit_surplus` | Admin |
| Physical count shortage | `audit_shortage` | Admin |
| Data entry fix | `count_correction` | Admin after lock |
| Opening balance fix | `opening_balance_correction` | Manager (before lock), Admin (after) |

**CRITICAL Rules:**
1. **Before `opening_balance_confirmed`:** Manager or Admin can adjust
2. **After `opening_balance_confirmed`:** ONLY Admin can adjust
3. **Negative adjustments:** ALWAYS require Admin
4. **Mandatory:** `reason_code` + `notes`

---

### 2.6 REPAIR (Warehouse Operation)

**Trigger Path:** `movement_category = 'repair'`

```sql
-- Send to repair:
in_repair_quantity += quantity
damaged_quantity -= quantity

-- Return from repair (fixed):
available_quantity += quantity
in_repair_quantity -= quantity

-- Return from repair (unfixable):
total_quantity -= quantity
in_repair_quantity -= quantity
```

| Scenario | reason_code | Effect |
|----------|-------------|--------|
| Send external vendor | `external_vendor` | damaged → in_repair |
| Internal workshop | `internal_repair` | damaged → in_repair |
| Repaired successfully | `repaired` | in_repair → available |
| Cannot be fixed | `irreparable` | in_repair → removed |

---

## 3. Lifecycle Enforcement

### 3.1 State Machine

```
┌─────────┐                              
│  DRAFT  │ ──── Item created, setup phase
└────┬────┘      • Full editing allowed
     │           • Opening balance NOT confirmed
     │           • Can delete (if no movements)
     │           • NOT visible in allocation dropdowns
     │
     │ Activate (on first allocation or explicit)
     ▼
┌─────────┐                              
│ ACTIVE  │ ──── Normal operational state
└────┬────┘      • Visible in allocation dropdowns
     │           • Opening balance LOCKED on first allocation
     │           • Can allocate stock
     │
     │ Discontinue (requires allocated_quantity = 0)
     ▼
┌──────────────┐
│ DISCONTINUED │ ──── No new allocations allowed
└──────┬───────┘      • Hidden from allocation dropdowns
       │              • Visible in reports
       │              • Can still receive returns/writeoffs
       │              • Can reactivate
       │
       │ Archive (requires total = 0, no activity 1 year)
       ▼
┌──────────┐
│ ARCHIVED │ ──── Historical record only
└──────────┘      • Completely read-only
                  • Hidden from main UI
                  • Visible in historical reports
                  • CANNOT be reactivated
```

### 3.2 Transition Rules

| From | To | Conditions | Who |
|------|-----|------------|-----|
| — | draft | Creation | Manager, Admin |
| draft | active | First allocation (auto) or explicit | Manager, Admin |
| draft | deleted | No movements | Manager, Admin |
| active | discontinued | `allocated_quantity = 0` | Manager, Admin |
| active | deleted | `total = 0` AND no customer allocations | Admin only |
| discontinued | active | Always allowed | Manager, Admin |
| discontinued | archived | `total = 0` AND no activity 1 year | Admin only |
| archived | — | Not allowed | — |

---

## 4. Delete vs Discontinue Decision Tree

```
                    DELETE REQUEST
                          │
                          ▼
              ┌───────────────────────┐
              │ total_quantity > 0 ?  │
              └───────────┬───────────┘
                          │
           ┌──────────────┴──────────────┐
           │ YES                         │ NO
           ▼                             ▼
    ┌─────────────────┐       ┌───────────────────────┐
    │ BLOCK DELETE    │       │ Has customer history? │
    │ "Dispose stock  │       │ (subscription/event   │
    │  first"         │       │  allocations exist?)  │
    └─────────────────┘       └───────────┬───────────┘
                                          │
                           ┌──────────────┴──────────────┐
                           │ YES                         │ NO
                           ▼                             ▼
                    ┌─────────────────┐       ┌─────────────────┐
                    │ BLOCK DELETE    │       │ ✅ ALLOW DELETE │
                    │ Use DISCONTINUE │       │ (hard delete)   │
                    │ instead         │       │                 │
                    └─────────────────┘       └─────────────────┘
```

**Implementation in trigger:**
```sql
-- In enforce_item_lifecycle_v2()
IF TG_OP = 'DELETE' THEN
  -- Check customer history
  SELECT EXISTS (
    SELECT 1 FROM inventory_movements
    WHERE inventory_item_id = OLD.id
      AND reference_type IN ('subscription', 'event')
  ) INTO v_has_customer_allocations;
  
  IF v_has_customer_allocations THEN
    RAISE EXCEPTION 'Use DISCONTINUE instead';
  END IF;
  
  IF OLD.total_quantity > 0 THEN
    RAISE EXCEPTION 'Dispose stock first';
  END IF;
  
  RETURN OLD;  -- Allow delete
END IF;
```

---

## 5. Opening Balance Lock

### 5.1 How It Works

```
CREATE ITEM ──► opening_balance_confirmed = FALSE
                    │
                    │ [Any of these locks it]
                    │
                    ├── First allocation movement
                    ├── Admin explicit confirmation
                    ├── (Future: 7-day auto-lock)
                    │
                    ▼
              opening_balance_confirmed = TRUE
                    │
                    │ [After lock]
                    │
                    ├── Adjustments require ADMIN role
                    └── Must provide reason_code + notes
```

### 5.2 Implementation

```sql
-- Auto-lock trigger (lock_opening_balance_on_allocation)
IF NEW.movement_category = 'outflow' THEN
  UPDATE inventory_items
  SET opening_balance_confirmed = true
  WHERE id = NEW.inventory_item_id
    AND opening_balance_confirmed = false;
END IF;

-- Validation trigger (validate_movement_v2)
IF NEW.movement_category = 'adjustment' THEN
  IF v_item.opening_balance_confirmed = true THEN
    IF v_user_role != 'admin' THEN
      RAISE EXCEPTION 'Only admins can adjust after lock';
    END IF;
  END IF;
END IF;
```

---

## 6. Subscription Integration

### 6.1 On Activation

When subscription status changes to `active`:
- Validate any pre-existing allocations (from pause)
- Allow activation (allocations created via separate movement calls)

### 6.2 On Cancellation

When subscription status changes to `cancelled`:
```sql
-- Check for outstanding allocations
FOR v_allocation IN SELECT ... WHERE outstanding > 0 LOOP
  RAISE EXCEPTION 'Cannot cancel with % units outstanding', outstanding;
END LOOP;

-- If all resolved, close allocations
UPDATE inventory_allocations
SET is_active = false
WHERE reference_id = subscription_id;
```

**User must process returns/damage/loss BEFORE cancelling.**

---

## 7. Edge Cases & Safety Checks

### 7.1 Negative Stock Prevention

| Layer | Check |
|-------|-------|
| Constraint | `CHECK (available_quantity >= 0)` etc. |
| Trigger | `IF v_item.available_quantity < NEW.quantity THEN RAISE EXCEPTION` |

### 7.2 Race Conditions

All triggers use `SECURITY DEFINER` and run within transaction:
```sql
-- Quantity check and update happen atomically
BEGIN;
  -- Trigger validates available >= requested
  -- Trigger updates quantities
COMMIT;  -- or ROLLBACK if constraint violated
```

### 7.3 Orphaned Allocations

Allocation closed automatically when:
- `outstanding_quantity = 0` (all items accounted for)
- Subscription/event cancelled (forced close)

### 7.4 Data Integrity on Migration

```sql
-- After migration, verify:
SELECT id, name,
  total_quantity,
  available_quantity + allocated_quantity + damaged_quantity + in_repair_quantity AS calculated_total,
  CASE WHEN total_quantity != 
       available_quantity + allocated_quantity + damaged_quantity + in_repair_quantity
  THEN 'MISMATCH' ELSE 'OK' END AS status
FROM inventory_items;
```

---

## 8. Migration Cutover Plan

### Step 1: Backup (REQUIRED)
```bash
pg_dump -Fc production_db > backup_pre_phase2.dump
```

### Step 2: Schedule Maintenance Window
- Recommend: Low-traffic period
- Duration: 10-15 minutes
- Notify users

### Step 3: Run Migration
```sql
\i 025_inventory_v2_phase2_behaviour.sql
```

### Step 4: Verify Triggers
```sql
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table IN ('inventory_items', 'inventory_movements', 'subscriptions')
  AND trigger_name LIKE '%v2%'
ORDER BY event_object_table, trigger_name;
```

### Step 5: Verify Constraint
```sql
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'quantity_balance_v2';
```

### Step 6: Test Critical Paths
```sql
-- Test allocation (should work for active items)
INSERT INTO inventory_movements (...) VALUES (...);

-- Test delete (should block if history exists)
DELETE FROM inventory_items WHERE id = '...';

-- Test subscription cancel (should block if outstanding)
UPDATE subscriptions SET status = 'cancelled' WHERE id = '...';
```

### Step 7: Monitor Logs
```sql
SELECT * FROM inventory_migration_log 
WHERE migration_version = '2.0-phase2'
ORDER BY id;
```

---

## 9. Validation Queries

### 9.1 Verify All Triggers Exist
```sql
SELECT 
  trigger_name,
  event_object_table,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE trigger_name IN (
  'validate_movement_v2_trigger',
  'update_quantities_v2_trigger',
  'lock_opening_balance_trigger',
  'enforce_lifecycle_v2_trigger',
  'subscription_inventory_v2_trigger'
)
ORDER BY event_object_table, trigger_name;
-- Expected: 5 rows
```

### 9.2 Verify Constraint
```sql
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'inventory_items'
  AND constraint_type = 'CHECK'
  AND constraint_name LIKE '%balance%';
-- Expected: quantity_balance_v2
```

### 9.3 Verify Quantity Balance
```sql
SELECT 
  id, name, lifecycle_status,
  total_quantity,
  available_quantity + allocated_quantity + damaged_quantity + in_repair_quantity AS calculated,
  CASE WHEN total_quantity = 
       available_quantity + allocated_quantity + damaged_quantity + in_repair_quantity
  THEN '✓' ELSE '✗ MISMATCH' END AS check
FROM inventory_items
WHERE lifecycle_status != 'archived';
```

### 9.4 Verify is_active Sync
```sql
SELECT 
  id, name, lifecycle_status, is_active,
  CASE WHEN is_active = (lifecycle_status IN ('draft', 'active'))
  THEN '✓' ELSE '✗ OUT OF SYNC' END AS check
FROM inventory_items;
```

### 9.5 Verify Opening Balance Locks
```sql
-- Items with allocations should be locked
SELECT 
  ii.id, ii.name, ii.opening_balance_confirmed,
  EXISTS (
    SELECT 1 FROM inventory_movements im
    WHERE im.inventory_item_id = ii.id
      AND im.movement_category = 'outflow'
  ) AS has_allocations,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM inventory_movements im 
                     WHERE im.inventory_item_id = ii.id 
                       AND im.movement_category = 'outflow')
      THEN 'No allocations yet'
    WHEN ii.opening_balance_confirmed = true 
      THEN '✓ Locked'
    ELSE '✗ Should be locked'
  END AS check
FROM inventory_items ii;
```

### 9.6 Verify Outstanding Calculations
```sql
SELECT 
  ia.id,
  ii.name,
  ia.allocated_quantity,
  COALESCE(SUM(im.quantity) FILTER 
    (WHERE im.movement_category IN ('return', 'writeoff')), 0) AS resolved,
  ia.allocated_quantity - COALESCE(SUM(im.quantity) FILTER 
    (WHERE im.movement_category IN ('return', 'writeoff')), 0) AS outstanding
FROM inventory_allocations ia
JOIN inventory_items ii ON ia.inventory_item_id = ii.id
LEFT JOIN inventory_movements im ON 
  im.inventory_item_id = ia.inventory_item_id
  AND im.reference_type = ia.reference_type
  AND im.reference_id = ia.reference_id
WHERE ia.is_active = true
GROUP BY ia.id, ii.name, ia.allocated_quantity;
```

---

## 10. Warnings & Risk Assessment

### 🔴 HIGH RISK
| Issue | Mitigation |
|-------|------------|
| Trigger replacement during active transactions | Run during maintenance window |
| Constraint change on existing data | Phase 1 ensured `in_repair_quantity = 0` |

### 🟡 MEDIUM RISK
| Issue | Mitigation |
|-------|------------|
| Existing workflows referencing `is_active` | Synced automatically, no code change needed |
| Old movement_type without movement_category | Fallback logic in trigger handles this |

### 🟢 LOW RISK
| Issue | Notes |
|-------|-------|
| View changes | Same column names, RLS unchanged |
| New validation rules | Only stricter, no data loss |

---

## 11. Post-Migration Monitoring

### First 24 Hours
```sql
-- Check for errors
SELECT * FROM inventory_migration_log
WHERE notes LIKE '%error%' OR notes LIKE '%fail%';

-- Check for blocked operations
SELECT * FROM pg_stat_activity
WHERE state = 'active'
  AND query LIKE '%inventory%'
  AND wait_event_type = 'Lock';
```

### First Week
```sql
-- Monitor adjustment patterns
SELECT 
  reason_code,
  COUNT(*) as count,
  SUM(quantity) as total_qty
FROM inventory_movements
WHERE movement_category = 'adjustment'
  AND created_at > now() - interval '7 days'
GROUP BY reason_code;

-- Monitor lifecycle transitions
SELECT 
  lifecycle_status,
  COUNT(*) as count
FROM inventory_items
GROUP BY lifecycle_status;
```

---

*End of Phase 2 Documentation*
