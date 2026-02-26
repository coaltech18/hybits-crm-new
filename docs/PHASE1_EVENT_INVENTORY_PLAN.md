# PHASE 1: Embed Inventory Inside EventDetailPage — Technical Implementation Plan

> Generated: 2026-02-24
> Scope: UI ONLY — No DB, trigger, or service changes.
> Approach: Reuse existing services and modals. Zero new service functions.

---

## 1️⃣ EventDetailPage Structure

---

### Where to Insert the "Event Inventory" Section

**Insert Location:** Between the **Notes Card** (line 227) and the **Audit Trail Card** (line 229) in `EventDetailPage.tsx`.

**Current layout order:**
```
1. Header + Action buttons (line 113–146)
2. Error alert (line 148)
3. Event Information Card (line 150–219)
4. Notes Card (line 221–227)
5. ─── INSERT "Event Inventory" SECTION HERE ───
6. Audit Trail Card (line 229–246)
7. Invoice placeholder Card (line 248–256)
8. ConfirmDialog modals (line 258–280)
```

**Rationale:** Inventory is more operationally important than audit trail metadata. Placing it between Notes and Audit Trail keeps the event info "above the fold" while making inventory discoverable.

### Available Data from EventDetailPage

| Data Point | Source | Available? | Variable |
|---|---|---|---|
| `eventId` | `useParams<{ id: string }>()` | ✅ Yes | `const { id } = useParams()` (line 17) — string, always available when page loads |
| `event.outlet_id` | `getEventById(id)` → `Event` type | ✅ Yes | `event.outlet_id` — string UUID |
| `event.event_name` | Same fetch | ✅ Yes | `event.event_name` — string |
| `event.status` | Same fetch | ✅ Yes | `event.status` — `'planned' \| 'completed' \| 'cancelled' \| 'archived'` |
| `user.id` | `useAuth()` | ✅ Yes | `user?.id` (line 19) |
| `user.role` | `useAuth()` | ✅ Yes | `user?.role` |

**Conclusion:** `id` (event UUID) is directly usable as `referenceId` for `allocationService` calls. No additional fetch required.

---

## 2️⃣ Allocation Data Fetch

---

### Service Functions to Call

```typescript
import { getAllocationsByReference, getAllocationSummary } from '@/services/allocationService';
```

### Exact Call Signatures

```typescript
// Fetch allocations for this event
const allocations = await getAllocationsByReference(user.id, 'event', id);

// Fetch summary for this event
const summary = await getAllocationSummary(user.id, 'event', id);
```

### Data Shape: `InventoryAllocation[]` (from `types/index.ts` line 584–600)

```typescript
interface InventoryAllocation {
  id: string;                      // Allocation row UUID
  outlet_id: string;               // Outlet UUID — matches event.outlet_id
  inventory_item_id: string;       // Item UUID — needed for ReturnDamageLossModal
  reference_type: ReferenceType;   // Will always be 'event' in our context
  reference_id: string;            // Will always be the eventId
  allocated_quantity: number;      // Total allocated to this event
  is_active: boolean;              // true = still active
  created_at: string;              
  updated_at: string;              
  // JOINED data (from inventory_allocations_with_details view):
  item_name?: string;              // ✅ Available — item display name
  item_category?: string;          // ✅ Available — item category
  outlet_name?: string;            // ✅ Available
  reference_name?: string;         // ✅ Available — event name
  outstanding_quantity?: number;   // ✅ DERIVED from movements — key field for returns
}
```

### Data Shape: Summary (from `allocationService.ts` line 242–272)

```typescript
{
  totalAllocated: number;    // sum of allocated_quantity across all allocations
  totalOutstanding: number;  // sum of outstanding_quantity across all allocations
  itemCount: number;         // count of allocations
}
```

### Key Confirmations

| Question | Answer |
|---|---|
| Does `getAllocationsByReference('event', eventId)` work? | ✅ Yes — service queries `inventory_allocations_with_details` view filtered by `reference_type = 'event'` and `reference_id = eventId` |
| Does it include `outstanding_quantity`? | ✅ Yes — derived from the view, NOT stored in the row. Always fresh from DB. |
| Does it include `item_name`? | ✅ Yes — joined from the view |
| What if no allocations exist? | Returns empty array `[]` — safe, no error |
| What if event doesn't have `is_active` column? | The service filters by `is_active = true` on the allocations, NOT the event. Events table doesn't have `is_active`. This is fine. |

---

## 3️⃣ Reusing Existing Modals

---

### 3A: AllocateInventoryModal

**File:** `src/components/inventory/AllocateInventoryModal.tsx`

**Can Reuse Directly?** ✅ **YES — zero modifications needed.**

**Required Props:**

```typescript
interface AllocateInventoryModalProps {
  isOpen: boolean;              // → managed by useState in EventDetailPage
  onClose: () => void;          // → setShowAllocateModal(false)
  onSuccess: () => void;        // → call loadAllocations() to refresh
  userId: string;               // → user.id (from useAuth)
  outletId: string;             // → event.outlet_id ✅ AVAILABLE
  referenceType: ReferenceType; // → 'event' (hardcode)
  referenceId: string;          // → id (from useParams) ✅ AVAILABLE
  referenceName: string;        // → event.event_name ✅ AVAILABLE
}
```

**What the modal does internally:**
1. Calls `getInventoryItems(userId, { outlet_id, is_active: true })` — fetches items for this outlet
2. Filters items with `available_quantity > 0`
3. User selects item, enters quantity
4. Calls `allocateInventory(userId, { outlet_id, inventory_item_id, quantity, reference_type: 'event', reference_id: eventId })`
5. DB trigger `sync_allocation_on_movement` creates/updates allocation row automatically

**Prop Mapping for EventDetailPage:**

```tsx
<AllocateInventoryModal
  isOpen={showAllocateModal}
  onClose={() => setShowAllocateModal(false)}
  onSuccess={loadAllocations}   // refresh allocation table
  userId={user.id}
  outletId={event.outlet_id}
  referenceType="event"
  referenceId={id!}
  referenceName={event.event_name}
/>
```

**Risk Assessment:** ✅ No issues. All props can be satisfied from existing page state.

---

### 3B: ReturnDamageLossModal

**File:** `src/components/inventory/ReturnDamageLossModal.tsx`

**Can Reuse Directly?** ✅ **YES — zero modifications needed.**

**Required Props:**

```typescript
interface ReturnDamageLossModalProps {
  isOpen: boolean;                // → managed by useState
  onClose: () => void;            // → setReturnAllocation(null)
  onSuccess: () => void;          // → call loadAllocations() to refresh
  userId: string;                 // → user.id
  outletId: string;               // → event.outlet_id ✅ AVAILABLE
  inventoryItemId: string;        // → allocation.inventory_item_id ✅ FROM allocation row
  itemName: string;               // → allocation.item_name ✅ FROM allocation row
  referenceType: ReferenceType;   // → 'event' (hardcode)
  referenceId: string;            // → id (from useParams)
  outstandingQuantity: number;    // → allocation.outstanding_quantity ✅ DERIVED
}
```

**What the modal does internally:**
1. Shows item name and outstanding quantity
2. User selects action: Return (good) / Mark Damaged / Mark Lost
3. User enters quantity (max = outstandingQuantity, enforced client-side AND server-side)
4. Notes required for damage/loss
5. Calls appropriate service: `returnInventory()`, `markDamage()`, or `markLoss()` from V1 `inventoryMovementService`
6. DB triggers handle quantity updates and allocation closure (when outstanding = 0)

**Prop Mapping for EventDetailPage:**

```tsx
{returnAllocation && (
  <ReturnDamageLossModal
    isOpen={!!returnAllocation}
    onClose={() => setReturnAllocation(null)}
    onSuccess={loadAllocations}   // refresh allocation table
    userId={user.id}
    outletId={event.outlet_id}
    inventoryItemId={returnAllocation.inventory_item_id}
    itemName={returnAllocation.item_name || 'Unknown Item'}
    referenceType="event"
    referenceId={id!}
    outstandingQuantity={returnAllocation.outstanding_quantity || 0}
  />
)}
```

**Risk Assessment:** ✅ No issues. `outstanding_quantity` is available from the allocation row (derived from the view). `item_name` is guaranteed from the `_with_details` view.

---

## 4️⃣ State Management

---

### New State Variables Required in EventDetailPage

```typescript
// Allocation data
const [allocations, setAllocations] = useState<InventoryAllocation[]>([]);
const [allocationSummary, setAllocationSummary] = useState<{
  totalAllocated: number;
  totalOutstanding: number;
  itemCount: number;
} | null>(null);
const [allocationsLoading, setAllocationsLoading] = useState(false);

// Modal state
const [showAllocateModal, setShowAllocateModal] = useState(false);
const [returnAllocation, setReturnAllocation] = useState<InventoryAllocation | null>(null);
```

### New Data Fetch Function

```typescript
async function loadAllocations() {
  if (!user?.id || !id) return;

  try {
    setAllocationsLoading(true);
    const [allocationsData, summaryData] = await Promise.all([
      getAllocationsByReference(user.id, 'event', id),
      getAllocationSummary(user.id, 'event', id),
    ]);
    setAllocations(allocationsData);
    setAllocationSummary(summaryData);
  } catch (err) {
    console.error('Failed to load allocations:', err);
    // Don't set page-level error — allocation failure shouldn't break event view
  } finally {
    setAllocationsLoading(false);
  }
}
```

### When to Fetch

| Trigger | Action |
|---|---|
| Page load (`useEffect` on `[id]`) | Call `loadAllocations()` alongside existing `loadEvent()` |
| After allocation success | `AllocateInventoryModal` `onSuccess` → `loadAllocations()` |
| After return/damage/loss success | `ReturnDamageLossModal` `onSuccess` → `loadAllocations()` |
| After event status change | `handleAction()` already calls `loadEvent()` — add `loadAllocations()` after it |

### Refresh Strategy

```typescript
// In existing useEffect (line 32-34):
useEffect(() => {
  loadEvent();
  loadAllocations();  // ADD THIS
}, [id]);

// In existing handleAction (after line 73):
await loadEvent();
await loadAllocations();  // ADD THIS
```

**No manual cache invalidation needed.** Each call to `loadAllocations()` fetches fresh data from the `inventory_allocations_with_details` view, which derives outstanding quantities from the movements table in real-time.

---

## 5️⃣ Risk Assessment

---

### Circular Import Check

| Import Path | Exists? | Risk |
|---|---|---|
| `EventDetailPage` → `allocationService` | ❌ NEW (will add) | ✅ No risk — `allocationService` has no imports from events |
| `EventDetailPage` → `AllocateInventoryModal` | ❌ NEW (will add) | ✅ No risk — modal imports from `inventoryService` and `inventoryMovementService`, neither imports from events |
| `EventDetailPage` → `ReturnDamageLossModal` | ❌ NEW (will add) | ✅ No risk — modal imports from `inventoryMovementService`, no event imports |
| `allocationService` → `EventDetailPage` | ❌ Does not exist | ✅ No circular dependency |

**Conclusion: ZERO circular import risk.** All imports are one-directional: EventDetailPage → inventory services/components.

### Prop Type Mismatches

| Prop | Expected Type | Available Value | Match? |
|---|---|---|---|
| `userId` | `string` | `user?.id` (AuthUser.id) | ✅ — but must guard with `user?.id \|\| ''` or check before render |
| `outletId` | `string` | `event.outlet_id` (Event.outlet_id) | ✅ Exact match |
| `referenceType` | `ReferenceType` = `'subscription' \| 'event' \| 'manual'` | `'event'` literal | ✅ Exact match |
| `referenceId` | `string` | `id` from `useParams<{ id: string }>()` | ⚠️ `id` is `string \| undefined`. Must use `id!` or guard. Existing page already guards at line 37: `if (!id) return;` |
| `referenceName` | `string` | `event.event_name` | ✅ Exact match — always present in Event type |
| `inventoryItemId` | `string` | `allocation.inventory_item_id` | ✅ Exact match — always present in InventoryAllocation |
| `itemName` | `string` | `allocation.item_name` | ⚠️ Optional field (`item_name?: string`). Fallback: `allocation.item_name \|\| 'Unknown Item'` |
| `outstandingQuantity` | `number` | `allocation.outstanding_quantity` | ⚠️ Optional field (`outstanding_quantity?: number`). Fallback: `allocation.outstanding_quantity \|\| 0` |

**All mismatches are optional-to-required narrowing** — resolved with `|| 'fallback'` patterns. No structural type incompatibilities.

### Role-Based Restrictions to Preserve

| Restriction | Source | How to Implement |
|---|---|---|
| Accountants cannot allocate | `InventoryAllocationPage` route blocks accountants entirely. `AllocateInventoryModal` does NOT check role internally — relies on route. | ✅ Must add `user?.role !== 'accountant'` guard on "Send Items" button in EventDetailPage |
| Accountants cannot process returns | `ReturnDamageLossModal` does NOT check role internally. `InventoryAllocationPage` route blocks. | ✅ Must add `user?.role !== 'accountant'` guard on "Process Return" button per row |
| Accountants CAN view allocation data | `getAllocationsByReference()` has no role check — just passes `_userId` (unused) | ✅ Show the allocation table to all roles, hide action buttons from accountants |
| Managers restricted to assigned outlets | RLS policies on `inventory_allocations`, `inventory_movements` | ✅ Automatically enforced by DB. If manager doesn't have access to event's outlet, allocation queries return empty. No UI change needed. |
| Only planned/completed events should show allocation actions | Business logic — no point allocating to cancelled/archived events | ✅ Must add: Show "Send Items" button only for `event.status === 'planned'`. Show "Process Return" for `'planned' \| 'completed'`. |

### Event Status Visibility Matrix

| Event Status | Show Allocation Table? | Show "Send Items" Button? | Show "Process Return" Button? | Rationale |
|---|---|---|---|---|
| `planned` | ✅ Yes | ✅ Yes (Admin/Manager) | ✅ Yes (Admin/Manager) | Active event, items being prepared |
| `completed` | ✅ Yes | ❌ No | ✅ Yes (Admin/Manager) | Event done, need to process returns |
| `cancelled` | ✅ Yes (read-only) | ❌ No | ❌ No | Event cancelled, auto-return should have happened (or will in Phase 2) |
| `archived` | ✅ Yes (read-only) | ❌ No | ❌ No | Historical view only |

---

## 6️⃣ Implementation Checklist

---

### Files to Modify

| # | File | Change Type | Description |
|---|---|---|---|
| 1 | `src/pages/events/EventDetailPage.tsx` | **MODIFY** | Add imports, state, fetch function, JSX section, and modal instances |

### Files to Reuse (NO modifications)

| # | File | Usage |
|---|---|---|
| 1 | `src/services/allocationService.ts` | `getAllocationsByReference()`, `getAllocationSummary()` |
| 2 | `src/components/inventory/AllocateInventoryModal.tsx` | Allocate items to event |
| 3 | `src/components/inventory/ReturnDamageLossModal.tsx` | Process return/damage/loss |
| 4 | `src/types/index.ts` | `InventoryAllocation`, `ReferenceType` types |

### New Imports for EventDetailPage

```typescript
// NEW IMPORTS (add after existing imports)
import { getAllocationsByReference, getAllocationSummary } from '@/services/allocationService';
import type { InventoryAllocation } from '@/types';
import AllocateInventoryModal from '@/components/inventory/AllocateInventoryModal';
import ReturnDamageLossModal from '@/components/inventory/ReturnDamageLossModal';
import { Package } from 'lucide-react';
```

### JSX Section Structure (Pseudocode)

```
<Card>  {/* Event Inventory Section */}
  <Header>
    <h2>Event Inventory</h2>
    {canAllocate && <Button>Send Items</Button>}
  </Header>

  {allocationsLoading ? <Spinner /> : (
    <>
      {/* Summary Row — only if allocations exist */}
      {summary && summary.itemCount > 0 && (
        <SummaryRow>
          Total Sent: {summary.totalAllocated}
          Pending Return: {summary.totalOutstanding}
          Items: {summary.itemCount}
        </SummaryRow>
      )}

      {/* Allocations Table — or empty state */}
      {allocations.length === 0 ? (
        <EmptyState>No items sent for this event yet.</EmptyState>
      ) : (
        <Table>
          <thead>Item | Category | Sent | Pending Return | Status | Actions</thead>
          {allocations.map(allocation => (
            <tr>
              {allocation.item_name}
              {allocation.item_category}
              {allocation.allocated_quantity}
              {allocation.outstanding_quantity || 0}
              {allocation.is_active ? <Badge>Active</Badge> : <Badge>Closed</Badge>}
              {canReturn && outstanding > 0 && <Button>Process Return</Button>}
            </tr>
          ))}
        </Table>
      )}
    </>
  )}
</Card>

{/* Modals — rendered at end of component, before closing </div> */}
<AllocateInventoryModal ... />
<ReturnDamageLossModal ... />
```

### Label Naming Convention (Phase 1 simplification)

| Internal Term | User-Facing Label |
|---|---|
| `allocated_quantity` | **"Sent"** |
| `outstanding_quantity` | **"Pending Return"** |
| Allocate button | **"Send Items"** |
| Return button | **"Process Return"** |
| Section title | **"Event Inventory"** |
| Empty state | "No items sent for this event yet." |

---

## 7️⃣ Summary

| Aspect | Status |
|---|---|
| `eventId` available? | ✅ `id` from `useParams` |
| `outlet_id` available? | ✅ `event.outlet_id` |
| `getAllocationsByReference('event', id)` works? | ✅ Confirmed |
| Data includes `outstanding_quantity`? | ✅ Derived from view |
| `AllocateInventoryModal` reusable as-is? | ✅ All 8 props satisfiable |
| `ReturnDamageLossModal` reusable as-is? | ✅ All 10 props satisfiable |
| Refresh strategy? | Re-call `loadAllocations()` on success callbacks |
| Circular import risk? | ✅ None |
| Type mismatches? | ✅ None (minor optional→required fallbacks) |
| Role restrictions preserved? | ✅ Guard buttons with role check |
| Files to modify? | **1 file only** — `EventDetailPage.tsx` |

**Ready for implementation. Awaiting approval to proceed with code changes.**
