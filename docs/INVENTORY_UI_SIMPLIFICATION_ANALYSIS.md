# INVENTORY MODULE — UI SIMPLIFICATION ANALYSIS (Phase 1)

> Generated: 2026-02-24
> Scope: UI analysis only — NO database, trigger, or service function changes proposed.
> Source: Full codebase review of pages, services, components, routes, and sidebar.

---

## 1️⃣ CURRENT UI STRUCTURE

---

### 1.1 — InventoryOverviewPage (`/inventory`)

**File:** `src/pages/inventory/InventoryOverviewPage.tsx` (801 lines)

**Data Shown:**
| Section | Data |
|---|---|
| Summary Cards (6) | Total Stock, Available, Allocated, Damaged, In Repair, Lost (Cumulative) — aggregated from `inventory_stock_summary` view |
| Discontinued Items | Separate summary card — only shown if discontinued items have `total_quantity > 0` |
| Attention Items | Unlocked opening balance count, Outstanding allocations count, Damaged items count, Items in repair count |
| Recent Movements (10) | Last 10 movements for active items — item name, category, quantity, time ago |
| Lifecycle Breakdown | Bar chart showing Active / Draft / Discontinued / Archived item counts |
| Quick Actions (4) | Links to: Manage Items, Allocations, Monthly Audit, Reports |

**Actions User Can Perform:**
- Filter by Outlet (Admin/Accountant only)
- Click attention items → deep links to relevant filtered views
- Navigate to Items, Allocations, Audit, Reports pages

**Service Functions Called:**
- Direct Supabase queries to: `inventory_stock_summary`, `inventory_items`, `inventory_allocations_with_details`, `inventory_movements`
- `hasActiveAudit()` from `inventoryAuditService`
- `getPendingApprovalsCount()` from `inventoryAuditService`

**Role Access (Route):** `admin`, `manager`, `accountant`

**Role-Specific UI:**
- Outlet filter: Admin + Accountant only
- Pending approvals alert: Admin only
- All data visible to all roles (no write actions on this page)

---

### 1.2 — InventoryItemsPage (`/inventory/items`)

**File:** `src/pages/inventory/InventoryItemsPage.tsx` (339 lines)

**Data Shown:**
| Section | Data |
|---|---|
| Summary Cards | Re-uses `InventorySummaryCards` component (shows totals for filtered items) |
| Filters | Outlet (Admin/Accountant), Category, Active/Inactive toggle |
| Items Table | Name, Category, Material, Outlet, Total, Available, Allocated, Damaged, Lost, Actions |

**Actions User Can Perform:**
- Add new item (opens `AddEditInventoryItemModal`)
- Edit item (opens `AddEditInventoryItemModal` in edit mode)
- Deactivate item (confirmation modal → `deactivateInventoryItem()`)
- Click item name → navigate to Item Detail page
- View Item Details button → navigate to Item Detail page

**Service Functions Called:**
- `getInventoryItems()` from `inventoryService`
- `getInventoryCategories()` from `inventoryService`
- `deactivateInventoryItem()` from `inventoryService`

**Role Access (Route):** `admin`, `manager`, `accountant`

**Role-Specific UI:**
- Accountant: **Read-only** — no Add, Edit, or Deactivate buttons
- Manager: Full access, default outlet pre-selected
- Admin: Full access, sees all outlets

---

### 1.3 — InventoryItemDetailPage (`/inventory/items/:id`)

**File:** `src/pages/inventory/InventoryItemDetailPage.tsx` (487 lines)

**Data Shown:**
| Section | Data |
|---|---|
| Header | Item name, lifecycle badge, category, material, unit, outlet |
| Stock Summary | `StockBreakdown` component with: Total, Available, Allocated, Damaged, In Repair, Lost |
| Action Buttons (7) | Add Stock, Allocate, Receive Back, Mark Damaged, Mark Lost, Dispose Damaged, Adjust Stock |
| Movement History | Full table: Date/Time, Action (friendly label), Quantity, Reference, Notes, By |

**Actions User Can Perform (via modals):**
| Action | Modal | Service | Conditions |
|---|---|---|---|
| Add Stock | `AddStockModal` | `addStockV2()` from `inventoryMovementServiceV2` | Non-archived items |
| Allocate | `AllocateItemModal` | `allocateInventoryV2()` from `inventoryMovementServiceV2` | Active items with available > 0 |
| Receive Back | `ReceiveBackModal` | `returnInventoryV2()` from `inventoryMovementServiceV2` | Items with allocated > 0 |
| Mark Damaged | `MarkDamagedModal` | `markDamagedV2()` or similar | Items with available > 0 |
| Mark Lost | `MarkLostModal` | `markLostV2()` or similar | Items with available > 0 or allocated > 0 |
| Dispose Damaged | `DisposeDamagedModal` | writeoff movement | Items with damaged > 0 |
| Adjust Stock | `AdjustStockModal` | adjustment movement | **Admin only** |

**Service Functions Called:**
- `getInventoryItemByIdV2()` from `inventoryServiceV2`
- `getInventoryMovements()` from `inventoryMovementService` (V1!)

**Role Access (Route):** `admin`, `manager`, `accountant`

**Role-Specific UI:**
- Accountant: See data only, no action buttons
- Manager: All actions except Adjust Stock
- Admin: All actions including Adjust Stock

---

### 1.4 — InventoryMovementsPage (`/inventory/movements`)

**File:** `src/pages/inventory/InventoryMovementsPage.tsx` (319 lines)

**Data Shown:**
| Section | Data |
|---|---|
| Filters | Outlet, Item, Movement Type (dropdown with all 6 types), Date From, Date To |
| Movements Table | Date/Time, Item (name + category), Outlet, Type (badge), Quantity, Reference (type + name), Notes, User |

**Actions User Can Perform:**
- Filter movements by outlet, item, type, date range
- Export to CSV (all visible rows)
- Clear Filters

**Service Functions Called:**
- `getInventoryMovements()` from `inventoryMovementService` (V1)
- `getInventoryItems()` from `inventoryService` (for filter dropdown)

**Role Access (Route):** `admin`, `manager`, `accountant`

**Role-Specific UI:**
- Page is **read-only for ALL roles**
- Manager sees only assigned outlet data (RLS enforced)
- Movement type filter uses raw enum values: `stock_in`, `allocation`, `return`, `damage`, `loss`, `adjustment`

---

### 1.5 — InventoryAllocationPage (`/inventory/allocate`)

**File:** `src/pages/inventory/InventoryAllocationPage.tsx` (369 lines)

**Data Shown:**
| Section | Data |
|---|---|
| Search Panel | Reference type selector (Subscription / Event), text search for client/event name |
| Search Results | Clickable list of matching subscriptions/events |
| Reference Info | Selected reference name, Total Allocated count, Outstanding count |
| Allocations Table | Item name, Category, Allocated quantity, Outstanding quantity, Status (Active/Closed), Actions |

**Actions User Can Perform:**
- Select reference type (subscription or event)
- Search for subscription (by client name) or event (by event name)
- Select a reference → view its allocations
- Allocate Items (opens `AllocateInventoryModal`)
- Return/Damage/Loss per allocation row (opens `ReturnDamageLossModal`)
- Back to search

**Service Functions Called:**
- Direct Supabase queries for search: `subscriptions` table, `events` table
- `getAllocationsByReference()` from `allocationService`
- `getAllocationSummary()` from `allocationService`
- `AllocateInventoryModal` → uses V1 movement service internally
- `ReturnDamageLossModal` → uses `returnInventory()`, `markDamage()`, `markLoss()` from V1 movement service

**Role Access (Route):** `admin`, `manager` **(Accountant EXCLUDED from route)**

**Role-Specific UI:**
- Accountant: Cannot access (route blocks)
- The page *also* checks `isAccountant` internally for button visibility (belt-and-suspenders)

---

### 1.6 — InventoryAuditPage (`/inventory/audit`)

**File:** `src/pages/inventory/InventoryAuditPage.tsx` (454 lines)

**Data Shown:**
| Section | Data |
|---|---|
| Pending Approvals Alert | Admin only — count of audits in `pending_approval` status |
| Filters | Outlet (Admin/Accountant), Status |
| Audits Table | Period, Outlet, Status (badge), Progress (bar + count), Variance (+/-), Created date/by, Actions (View/Continue) |

**Actions User Can Perform:**
- Create new audit (modal: select outlet + period → `createAudit()`)
- Navigate to audit detail (`/inventory/audit/:id`)
- Filter by outlet and status

**Service Functions Called:**
- `getAudits()` from `inventoryAuditService`
- `canCreateAudit()` from `inventoryAuditService`
- `createAudit()` from `inventoryAuditService`

**Role Access (Route):** `admin`, `manager`, `accountant`

**Role-Specific UI:**
- Accountant: Can view audits but **cannot** create new ones
- Admin: Sees pending approvals alert, can approve/reject in detail page
- Manager: Can create and count but cannot approve

---

### Also exists but not in scope question:

| Page | Route | Notes |
|---|---|---|
| `InventoryAuditDetailPage` | `/inventory/audit/:id` | Audit counting, review, approval |
| `InventoryReportsPage` | `/inventory/reports` | Report generation & download |

---

## 2️⃣ EVENT → INVENTORY INTEGRATION

---

### Current Integration Status: ⚠️ HOOKS EXIST BUT ARE NEVER CALLED

**Critical Finding:** The file `src/services/inventoryIntegrationHooks.ts` exports 5 functions for event lifecycle integration, but **none of them are imported or called anywhere in the application**. The grep for `inventoryIntegrationHooks` across all `.ts` and `.tsx` files returns zero results.

The `eventService.ts` functions (`completeEvent()`, `cancelEvent()`) do **NOT** call any inventory hooks. The `EventDetailPage.tsx` has **no inventory references** whatsoever.

### Designed Flow (NOT ACTIVE):

| Event Status Change | Hook Function | Designed Behavior | Actual Behavior |
|---|---|---|---|
| Event Created | *(none)* | No hook exists for creation | Nothing happens |
| Event → `planned` | `onEventPlanned()` | **PLACEHOLDER** — logs only. Needs `event_items` table that doesn't exist. | **Never called** |
| Event → `completed` | `onEventCompleted()` | Logs that allocations need return processing. Manual return expected via UI. | **Never called** |
| Event → `cancelled` | `onEventCancelled()` | Auto-returns all outstanding items, closes allocations. | **Never called** |

### Subscription Integration Status:

| Status Change | Hook Function | Designed Behavior | Actual Behavior |
|---|---|---|---|
| Subscription → `active` | `onSubscriptionActivated()` | **PLACEHOLDER** — logs only. Needs `subscription_items` table. | **Never called** |
| Subscription → `cancelled` | `onSubscriptionCancelled()` | Auto-returns outstanding, closes allocations. | **Never called from UI.** BUT the DB trigger `handle_subscription_inventory_v2()` on the `subscriptions` table handles cancellation at DB level. |

### Summary:
- **Allocation does NOT happen automatically** — users must go to `/inventory/allocate` or ItemDetailPage → Allocate modal
- **Return processing is fully manual** — users must go to `/inventory/allocate` → select reference → Return/Damage/Loss per item, OR go to ItemDetailPage → Receive Back
- **No event_items or subscription_items tables exist** — so auto-allocation is impossible without schema changes

---

## 3️⃣ ALLOCATION FLOW

---

### When Allocation Rows Are Created

There are **two independent paths** for creating allocations:

**Path A: Via InventoryAllocationPage** (`/inventory/allocate`)
1. User searches for a subscription or event
2. Opens `AllocateInventoryModal` → selects items and quantities
3. Modal calls V1 `allocateInventory()` which → inserts `inventory_movements` row (type=`allocation`)
4. DB trigger `sync_allocation_on_movement()` → UPSERTS into `inventory_allocations` table
5. DB trigger `update_inventory_quantities_v2()` → `-available`, `+allocated`

**Path B: Via InventoryItemDetailPage** (`/inventory/items/:id`)
1. User clicks "Allocate" button on an item
2. Opens `AllocateItemModal` → selects reference (subscription/event), enters quantity
3. Modal calls V2 `allocateInventoryV2()` which → inserts `inventory_movements` row
4. Same DB triggers fire as Path A

### How Allocation Rows Are Closed

| Mechanism | How | When |
|---|---|---|
| **Auto-close** | DB trigger `sync_allocation_on_movement()` | When `outstanding_quantity` reaches 0 (all items returned/damaged/lost) |
| **Manual close** | `closeAllocation()` or `closeAllocationsByReference()` from `allocationService` | Called by integration hooks (currently unused) |
| **Subscription DB trigger** | `handle_subscription_inventory_v2()` | When subscription is cancelled (DB-level only) |

### Partial Returns

**YES, partial returns are supported:**
- Each return/damage/loss movement reduces the outstanding quantity
- Outstanding is calculated as: `allocated_qty - SUM(return + damage + loss movements)`
- The allocation remains `is_active = true` until outstanding reaches 0
- Multiple partial returns can be made against the same allocation

### Where Return UI Exists Currently

| Location | How It Works |
|---|---|
| **InventoryAllocationPage** → `ReturnDamageLossModal` | User searches for subscription/event → sees allocations → clicks "Return/Damage/Loss" per row → modal with action type, quantity, notes |
| **InventoryItemDetailPage** → `ReceiveBackModal` | User navigates to item → clicks "Receive Back" → modal loads active allocations for that item → user selects allocation, condition (good/damaged), quantity |

Both paths create movements via the V1 or V2 movement service, which triggers the same DB logic.

---

## 4️⃣ MOVEMENT VISIBILITY

---

### Which Roles Can Access Movement Page

| Role | Route Access | Data Scope |
|---|---|---|
| **Admin** | ✅ via `ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}` | All outlets |
| **Manager** | ✅ | Assigned outlets only (RLS) |
| **Accountant** | ✅ | All outlets (read-only) |

### Is Movement Page Essential for Managers?

**Analysis of what the movement page provides:**
- **Read-only audit trail** — shows every stock change with who/when/why
- **Filtering** — by outlet, item, movement type, date range
- **CSV Export** — for offline review or reporting

**Manager use cases:**
1. **"What happened to item X?"** → Filter by item → see full history. BUT: InventoryItemDetailPage ALREADY shows movement history per item.
2. **"Show me all allocations this month"** → Filter by type + date. Useful for operational review, but not critical. OverviewPage shows recent 10.
3. **"Export for records"** → CSV export. This is a convenience feature.

### What Breaks If Movement Page Is Hidden from Managers?

| Feature | Impact |
|---|---|
| Per-item movement history | ❌ **Nothing breaks** — ItemDetailPage already shows this |
| Cross-item movement search | ⚠️ **Lost** — no other page lets you filter movements across all items |
| CSV export of movements | ⚠️ **Lost** — no other page has this |
| Movement type filtering | ⚠️ **Lost** — cannot search for "all allocations" across items |
| Data integrity | ❌ **Nothing breaks** — page is read-only, no write operations |

**Verdict:** Hiding from managers is **safe** but may cause inconvenience for operational reporting. The ReportsPage may partially compensate. **Recommended:** Keep for Admin, consider hiding from Manager based on user feedback.

---

## 5️⃣ UI COUPLING RISKS

---

### Pages Tightly Coupled to Movement Types

| Page / Component | Coupling | Risk Level |
|---|---|---|
| `InventoryMovementsPage` | Filter dropdown hard-codes movement_type enum values: `stock_in`, `allocation`, `return`, `damage`, `loss`, `adjustment` | 🟡 Medium — if enum changes, dropdown breaks |
| `InventoryMovementsPage` | `getMovementTypeBadge()` maps movement_type → color/label | 🟡 Medium |
| `InventoryItemDetailPage` | `MOVEMENT_LABELS` maps movement_category → friendly label | 🟢 Low — graceful fallback |
| `InventoryItemDetailPage` | `MOVEMENT_TYPE_LABELS` maps movement_type → friendly label (fallback) | 🟢 Low |
| `InventoryOverviewPage` | `formatMovementCategory()` maps movement_category → label/color/icon | 🟢 Low — uses switch with default |

### Components That Depend on `movement_category`

| Component | Usage | Risk |
|---|---|---|
| `InventoryOverviewPage` | Reads `movement_category` for recent movements display | 🟢 Low — display only, with fallback |
| `InventoryItemDetailPage` | Primary label source, falls back to `movement_type` | 🟢 Low — dual fallback |
| `AddStockModal` | Comment says "No movement_category or reason_code exposed to user" — hardcodes internally | 🟢 Low |
| `AllocateItemModal` | Hardcodes `movement_category: 'outflow'` and `reason_code` based on reference type | 🟡 Medium — tightly coupled to V2 schema |

### UI That Directly Edits Quantities

**NONE.** ✅

- No page or component directly edits `inventory_items` quantity columns
- All quantity changes go through movement creation (service layer → DB triggers)
- The `InventoryItemsPage` comment explicitly states: "NO inline editing of quantities"
- `AddEditInventoryItemModal` only edits name, category, material, unit, outlet — NOT quantities

### UI That Bypasses Service Layer

| Component | Bypass | Risk |
|---|---|---|
| `InventoryOverviewPage` | Direct Supabase queries to `inventory_stock_summary`, `inventory_items`, `inventory_allocations_with_details`, `inventory_movements` views | 🟡 Medium — bypasses service layer for READ-ONLY queries. Acceptable for dashboard performance but creates maintenance burden. |
| `InventoryAllocationPage` | Direct Supabase queries for search (`subscriptions`, `events` tables) | 🟡 Medium — search logic not in a service |
| `AllocateItemModal` | Direct Supabase queries for reference search | 🟡 Medium — duplicates search logic from AllocationPage |
| `ReceiveBackModal` | Direct Supabase queries to load allocations | 🟡 Medium |

**Verdict:** Bypasses are all **read-only** queries. No write operation bypasses the service layer. However, these direct queries create maintenance risk if views or table names change.

---

## 6️⃣ SAFE UI SIMPLIFICATION PLAN

---

### 6.1 — What Can Be Safely Hidden

| Element | Location | Can Hide? | Impact |
|---|---|---|---|
| Movements Page link from OverviewPage quick actions | `InventoryOverviewPage` line ~641 | ✅ Safe | "View All →" link in Recent Movements section |
| Movement Type filter raw values | `InventoryMovementsPage` | ✅ Safe | Can rename to friendly labels without any backend impact |
| Lifecycle breakdown card | `InventoryOverviewPage` | ✅ Safe | Informational only, no downstream dependency |
| Discontinued items section | `InventoryOverviewPage` | ⚠️ Caution | Only hide if discontinued items are handled elsewhere. Useful alert for admins. |
| Lost (Cumulative) summary card | `InventoryOverviewPage` | ✅ Safe | Can be de-emphasized or hidden. In Repair may also be hidden if repair workflow isn't used. |

### 6.2 — What Can Be Safely Renamed

| Current Label | Suggested Rename | Location(s) | Risk |
|---|---|---|---|
| "Allocated" (summary card) | "In Use" or "Sent Out" | OverviewPage, ItemsPage, ItemDetailPage | ✅ Zero risk — display label only |
| "Outstanding" (allocation table) | "Pending Return" or "With Client" | AllocationPage, ReturnDamageLossModal | ✅ Zero risk — display label only |
| "allocation" movement type badge | "Sent Out" | MovementsPage, ItemDetailPage | ✅ Zero risk — already done in ItemDetailPage labels |
| "stock_in" movement type badge | "Added" or "Received" | MovementsPage | ✅ Zero risk — display label only |
| "Inventory Allocation" page title | "Send & Receive Items" or "Dishware Tracking" | AllocationPage | ✅ Zero risk |
| "Return/Damage/Loss" button text | "Process Return" | AllocationPage | ✅ Zero risk |
| "Receive Back" button text | "Record Return" | ItemDetailPage | ✅ Zero risk |
| "movement_category" internal refs | No user-facing change needed | Various | N/A — internal code only |

### 6.3 — Can AllocationPage Be Merged Into Event Flow?

**Current State:**
- EventDetailPage has **zero** inventory integration — no allocation UI, no return UI, no inventory references at all
- AllocationPage is completely standalone — users must search for events/subscriptions manually
- Integration hooks exist but are **never called**

**Assessment:**

| Option | Feasibility | Effort |
|---|---|---|
| **A. Embed allocation table in EventDetailPage** | ✅ Feasible | Medium — reuse `getAllocationsByReference('event', eventId)` and add a section showing allocations + "Allocate" and "Return" buttons |
| **B. Add "Manage Inventory" link to EventDetailPage** | ✅ Feasible | Low — deep-link to `/inventory/allocate?type=event&id={eventId}` |
| **C. Remove AllocationPage entirely** | ⚠️ Risky | Would lose subscription allocation management unless embedded in SubscriptionDetailPage too |
| **D. Keep AllocationPage but hide from sidebar** | ✅ Safe | No code changes, just remove nav visibility. Access via deep links from EventDetailPage. |

**Recommendation:** Option **A + D** — embed a lightweight allocation view in EventDetailPage (and SubscriptionDetailPage), then demote AllocationPage from primary navigation. Keep it accessible via direct URL for advanced use.

### 6.4 — Does Return UI Exist or Need to Be Created?

**Return UI EXISTS in two places:**

| Location | UI Component | What It Does |
|---|---|---|
| `/inventory/allocate` → per-allocation row | `ReturnDamageLossModal` | Select action (return/damage/loss), enter quantity, submit. Works against a specific allocation (subscription or event). |
| `/inventory/items/:id` → "Receive Back" button | `ReceiveBackModal` | Lists all active allocations for the item, user selects allocation, enters quantity, selects condition (good/damaged). |

**What's Missing:**
1. ❌ No return UI exists **inside** EventDetailPage — user must navigate to AllocationPage or ItemDetailPage
2. ❌ No "pending returns" notification in EventDetailPage after event completion
3. ❌ No bulk return option — each item must be returned individually
4. ❌ No return UI accessible from the event → inventory flow (the flows are completely disconnected)

**Recommendation for Phase 1:**
- Add a section in EventDetailPage that shows allocations and enables return processing inline (reuse `ReturnDamageLossModal` or `ReceiveBackModal`)
- This would unify the workflow without changing any service/database logic

---

## SUMMARY: SAFE CHANGES vs. AVOID

### ✅ SAFE TO DO IN PHASE 1 (UI Only)

| # | Change | Type |
|---|---|---|
| 1 | Rename "Allocated" → "In Use" across all summary cards | Label change |
| 2 | Rename "Outstanding" → "Pending Return" in allocation views | Label change |
| 3 | Rename movement type badges to friendly labels on MovementsPage (match ItemDetailPage style) | Label change |
| 4 | Hide/demote MovementsPage from sidebar or quick actions (keep route working) | Navigation change |
| 5 | Hide In Repair and Lost (Cumulative) summary cards if not actively used | Visibility toggle |
| 6 | Add "Manage Inventory" link or allocation section to EventDetailPage | UI integration |
| 7 | Add "Manage Inventory" link or allocation section to SubscriptionDetailPage | UI integration |
| 8 | Rename AllocationPage title to friendlier language | Label change |
| 9 | Rename "Return/Damage/Loss" button to "Process Return" | Label change |
| 10 | De-emphasize lifecycle breakdown on OverviewPage | Layout change |

### ❌ DO NOT CHANGE IN PHASE 1

| # | Item | Reason |
|---|---|---|
| 1 | Database schema (tables, columns, constraints) | Out of scope |
| 2 | DB triggers and functions | Out of scope |
| 3 | Movement creation/validation logic | Out of scope |
| 4 | Service functions (V1 or V2) | Out of scope |
| 5 | Allocation calculation logic | Derived from DB, not computed in UI |
| 6 | RLS policies | Out of scope |
| 7 | `movement_category` / `reason_code` values | Tied to trigger logic |
| 8 | Integration hooks (even though unused) | May be wired in Phase 2 |
| 9 | Audit flow | Working correctly, no simplification needed |

---

## DEPENDENCY MAP

```
EventDetailPage ──(ZERO integration)──→ Inventory
   └── Would benefit from: allocation table + return UI

AllocationPage ──→ allocationService ──→ inventory_allocations_with_details view
   └── AllocateInventoryModal ──→ V1 inventoryMovementService.allocateInventory()
   └── ReturnDamageLossModal ──→ V1 inventoryMovementService.returnInventory/markDamage/markLoss()

ItemDetailPage ──→ inventoryServiceV2.getInventoryItemByIdV2()
   └── Action Modals (7) ──→ V2 inventoryMovementServiceV2.* functions
   └── Movement History ──→ V1 inventoryMovementService.getInventoryMovements()

MovementsPage ──(pure read-only)──→ V1 inventoryMovementService.getInventoryMovements()

OverviewPage ──(direct Supabase queries)──→ views/tables
   └── inventoryAuditService.hasActiveAudit/getPendingApprovalsCount

AuditPage ──→ inventoryAuditService.* (completely independent)

Integration Hooks ──(EXPORTED but NEVER IMPORTED)──→ V1 inventoryMovementService + allocationService
```

---

*End of Analysis. Ready for Phase 1 implementation plan.*
