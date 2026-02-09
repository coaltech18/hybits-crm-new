# Inventory v2.0 - Phase 1 Migration Summary

## Migration File
`supabase/024_inventory_v2_phase1_foundation.sql`

## Status: ✅ Ready for Deployment

---

## Phase 1 Changes Summary

### inventory_items Table

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `lifecycle_status` | TEXT | `'active'` | Replaces binary `is_active` with 4 states: `draft`, `active`, `discontinued`, `archived` |
| `opening_balance_confirmed` | BOOLEAN | `true` | Locks opening balance after first allocation or explicit confirmation |
| `in_repair_quantity` | INTEGER | `0` | Tracks items sent for repair (part of extended balance equation) |

### inventory_movements Table

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `movement_category` | TEXT | NULL | High-level classification: `inflow`, `outflow`, `return`, `writeoff`, `adjustment`, `repair` |
| `reason_code` | TEXT | NULL | Specific reason for movement (e.g., `opening_balance`, `client_damage`) |

### New Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `idx_inventory_items_lifecycle_status` | inventory_items | lifecycle_status | Filter by status |
| `idx_inventory_items_active_lifecycle` | inventory_items | outlet_id, lifecycle_status | Partial index for active items |
| `idx_inventory_movements_category` | inventory_movements | movement_category | Filter by category |
| `idx_inventory_movements_category_created` | inventory_movements | movement_category, created_at | Date-based category queries |
| `idx_inventory_movements_reason_code` | inventory_movements | reason_code | Partial index for non-null reasons |

### Backfill Mapping

#### lifecycle_status (from is_active)
| is_active | lifecycle_status |
|-----------|------------------|
| true | `'active'` |
| false | `'discontinued'` |

#### movement_category (from movement_type)
| movement_type | movement_category |
|---------------|-------------------|
| stock_in | `'inflow'` |
| allocation | `'outflow'` |
| return | `'return'` |
| damage | `'writeoff'` |
| loss | `'writeoff'` |
| adjustment | `'adjustment'` |

---

## What Remains Unchanged

- ✅ All existing triggers work exactly as before
- ✅ `is_active` column still exists and works
- ✅ `movement_type` enum still exists and works
- ✅ `quantity_balance` constraint unchanged (updated in Phase 2)
- ✅ All RLS policies unchanged
- ✅ Billing, subscriptions, events unaffected

---

## Deployment Instructions

### 1. Backup (Required)
```bash
# Create a full database backup before running
pg_dump -Fc your_database > backup_before_inventory_v2.dump
```

### 2. Run Migration
```sql
-- Run in Supabase SQL Editor or via CLI
\i 024_inventory_v2_phase1_foundation.sql
```

### 3. Verify
```sql
-- Check migration log
SELECT * FROM inventory_migration_log ORDER BY id;

-- Verify columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'inventory_items'
AND column_name IN ('lifecycle_status', 'opening_balance_confirmed', 'in_repair_quantity');

-- Verify backfill
SELECT lifecycle_status, COUNT(*) 
FROM inventory_items 
GROUP BY lifecycle_status;

SELECT movement_category, COUNT(*) 
FROM inventory_movements 
GROUP BY movement_category;
```

### 4. Rollback (If Needed)
The rollback script is included at the end of the migration file (commented out).

---

## Phase 2 Preview

After Phase 1 is stable in production, Phase 2 will:
1. Replace triggers to use `lifecycle_status` and `movement_category`
2. Update `quantity_balance` constraint to include `in_repair_quantity`
3. Deprecate `is_active` column
4. Add new movement types for repair flow
5. Update service layer code

---

## Success Criteria Checklist

- [ ] Migration runs without errors
- [ ] All existing data preserved
- [ ] New columns populated correctly
- [ ] Indexes created
- [ ] Existing inventory operations work unchanged
- [ ] No permission errors
- [ ] Migration log contains all operations
