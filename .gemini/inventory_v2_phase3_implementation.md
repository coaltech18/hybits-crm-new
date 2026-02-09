# Inventory v2.0 Phase 3: Implementation Plan

> **Status:** LOCKED  
> **Last Updated:** 2026-02-09  
> **Prerequisites:** Phase 1 & Phase 2 complete

---

## Table of Contents

1. [Screen Hierarchy](#1-screen-hierarchy)
2. [API Contracts](#2-api-contracts)
3. [Component Architecture](#3-component-architecture)
4. [User Flows by Role](#4-user-flows-by-role)
5. [Error & Edge Cases](#5-error--edge-cases)
6. [Performance Considerations](#6-performance-considerations)
7. [Implementation Checklist](#7-implementation-checklist)

---

## 1. Screen Hierarchy

```
/inventory
├── /                           → Stock Overview Dashboard
├── /items                      → Item Master List
│   ├── /new                    → Create Item (Modal)
│   └── /:id                    → Item Detail
│       ├── /movements          → Movement History (Tab)
│       ├── /allocations        → Allocation History (Tab)
│       └── /edit               → Edit Item (Modal)
├── /allocations                → Current Allocations List
│   └── /:id/process            → Process Return Modal
├── /audit                      → Audit Hub
│   ├── /new                    → Start New Audit
│   ├── /:id                    → Audit Detail
│   └── /approvals              → Admin Approval Queue
└── /reports                    → Reports Hub
    ├── /stock-summary          → Stock Summary Report
    ├── /outstanding            → Outstanding Allocations
    ├── /damage-loss            → Damage & Loss Report
    ├── /adjustments            → Adjustment History
    └── /valuation              → Inventory Valuation (Optional)
```

---

## 2. API Contracts

### 2.1 Stock Overview Dashboard

#### GET `/api/inventory/overview`

**Request:**
```typescript
interface OverviewRequest {
  outlet_id?: string;  // Optional filter
}
```

**Response:**
```typescript
interface OverviewResponse {
  summary: {
    total_quantity: number;
    available_quantity: number;
    allocated_quantity: number;
    damaged_quantity: number;
    in_repair_quantity: number;
    lost_quantity: number;  // Cumulative
  };
  attention: {
    unlocked_balance_count: number;
    high_damage_rate_count: number;  // Items with damage > 5%
    outstanding_allocations_count: number;
    audit_in_progress: boolean;
  };
  recent_movements: MovementSummary[];  // Last 10
  lifecycle_breakdown: {
    draft: number;
    active: number;
    discontinued: number;
    archived: number;
  };
}

interface MovementSummary {
  id: string;
  created_at: string;
  item_name: string;
  movement_category: string;
  movement_type: string;
  quantity: number;
  reference_type: string;
  reference_name: string;
}
```

**Service Implementation:**
```typescript
// Use existing views + aggregate queries
// inventory_stock_summary → summary
// inventory_movements → recent_movements
// inventory_items → attention counts
```

---

### 2.2 Item Master List

#### GET `/api/inventory/items`

**Request:**
```typescript
interface ItemListRequest {
  outlet_id?: string;
  category?: string;
  lifecycle_status?: 'draft' | 'active' | 'discontinued' | 'archived' | 'all';
  opening_unlocked?: boolean;  // Filter: opening_balance_confirmed = false
  search?: string;             // Name search
  page?: number;               // Default: 1
  limit?: number;              // Default: 20
  sort_by?: 'name' | 'total_quantity' | 'created_at';
  sort_order?: 'asc' | 'desc';
}
```

**Response:**
```typescript
interface ItemListResponse {
  items: InventoryItemV2[];
  pagination: {
    page: number;
    limit: number;
    total_count: number;
    total_pages: number;
  };
  filters_applied: {
    outlet_id?: string;
    category?: string;
    lifecycle_status?: string;
  };
}

interface InventoryItemV2 {
  id: string;
  outlet_id: string;
  outlet_name: string;
  outlet_code: string;
  name: string;
  category: string;
  material?: string;
  unit: string;
  total_quantity: number;
  available_quantity: number;
  allocated_quantity: number;
  damaged_quantity: number;
  in_repair_quantity: number;
  lost_quantity: number;
  lifecycle_status: 'draft' | 'active' | 'discontinued' | 'archived';
  opening_balance_confirmed: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

**Service:** `inventoryServiceV2.getInventoryItemsV2()`

---

### 2.3 Item Detail

#### GET `/api/inventory/items/:id`

**Response:**
```typescript
interface ItemDetailResponse {
  item: InventoryItemV2;
  
  // Derived stats
  stats: {
    damage_rate: number;           // damaged / total * 100
    allocation_rate: number;       // allocated / total * 100
    days_since_last_movement: number;
    total_movements_count: number;
    active_allocations_count: number;
  };
  
  // Actions available based on state
  actions: {
    can_add_stock: boolean;        // draft or active
    can_allocate: boolean;         // active AND available > 0
    can_adjust: boolean;           // depends on role + lock
    can_send_to_repair: boolean;   // damaged > 0
    can_return_from_repair: boolean; // in_repair > 0
    can_discontinue: boolean;      // allocated = 0
    can_reactivate: boolean;       // discontinued
    can_archive: boolean;          // admin + total = 0 + 1yr inactive
    can_delete: boolean;           // no customer history + total = 0
  };
  
  // Warnings
  warnings: string[];
}
```

#### GET `/api/inventory/items/:id/movements`

**Request:**
```typescript
interface MovementListRequest {
  page?: number;
  limit?: number;
  movement_category?: string;
  date_from?: string;
  date_to?: string;
}
```

**Response:**
```typescript
interface MovementListResponse {
  movements: InventoryMovement[];
  pagination: Pagination;
}

interface InventoryMovement {
  id: string;
  created_at: string;
  movement_category: string;
  movement_type: string;
  quantity: number;
  reference_type: 'subscription' | 'event' | 'manual';
  reference_id?: string;
  reference_name?: string;  // Joined from subscription/event
  reason_code?: string;
  notes?: string;
  created_by: string;
  created_by_name: string;  // Joined from user_profiles
}
```

#### GET `/api/inventory/items/:id/allocations`

**Response:**
```typescript
interface ItemAllocationResponse {
  allocations: AllocationDetail[];
  pagination: Pagination;
}

interface AllocationDetail {
  allocation_id: string;
  reference_type: 'subscription' | 'event';
  reference_id: string;
  reference_name: string;
  allocated_quantity: number;
  outstanding_quantity: number;  // calculated
  days_outstanding: number;      // now() - created_at
  is_active: boolean;
  created_at: string;
}
```

---

### 2.4 Stock Actions (All via Movements)

#### POST `/api/inventory/movements/stock-in`

**Request:**
```typescript
interface StockInRequest {
  outlet_id: string;
  inventory_item_id: string;
  quantity: number;
  reason_code: 'opening_balance' | 'new_purchase' | 'gift_received' | 'transfer_in';
  notes?: string;
}
```

**Response:**
```typescript
interface MovementResponse {
  success: boolean;
  movement: InventoryMovement;
  updated_item: InventoryItemV2;  // Refreshed quantities
}
```

**Service:** `inventoryMovementServiceV2.createStockInV2()`

---

#### POST `/api/inventory/movements/allocate`

**Request:**
```typescript
interface AllocateRequest {
  outlet_id: string;
  inventory_item_id: string;
  quantity: number;
  reference_type: 'subscription' | 'event';
  reference_id: string;
  reason_code?: 'subscription_start' | 'event_dispatch' | 'additional_dispatch';
  notes?: string;
}
```

**Pre-validation:**
- Item lifecycle_status = 'active'
- available_quantity >= quantity
- No active audit in progress (warning)

**Response:** `MovementResponse`

**Service:** `inventoryMovementServiceV2.allocateInventoryV2()`

---

#### POST `/api/inventory/movements/return`

**Request:**
```typescript
interface ReturnRequest {
  outlet_id: string;
  inventory_item_id: string;
  quantity: number;
  reference_type: 'subscription' | 'event';
  reference_id: string;
  is_damaged: boolean;
  reason_code?: 'normal_return' | 'early_return' | 'client_damage' | 'transit_damage';
  notes?: string;
}
```

**Pre-validation:**
- quantity <= outstanding for this allocation

**Response:** `MovementResponse`

**Service:** `inventoryMovementServiceV2.returnInventoryV2()`

---

#### POST `/api/inventory/movements/writeoff`

**Request:**
```typescript
interface WriteOffRequest {
  outlet_id: string;
  inventory_item_id: string;
  quantity: number;
  reason_code: string;  // damage or loss codes
  reference_type?: 'subscription' | 'event' | 'manual';
  reference_id?: string;
  notes: string;  // MANDATORY
}
```

**Response:** `MovementResponse`

**Service:** `inventoryMovementServiceV2.writeOffInventoryV2()`

---

#### POST `/api/inventory/movements/adjust`

**Request:**
```typescript
interface AdjustRequest {
  outlet_id: string;
  inventory_item_id: string;
  quantity: number;
  is_negative: boolean;
  reason_code: 'audit_surplus' | 'audit_shortage' | 'found_stock' | 'count_correction' | 'opening_balance_correction';
  notes: string;  // MANDATORY
}
```

**Access Control:**
- Positive: Manager or Admin
- Negative: Admin ONLY
- After lock: Admin ONLY

**Response:** `MovementResponse`

**Service:** `inventoryMovementServiceV2.adjustInventoryV2()`

---

#### POST `/api/inventory/movements/repair`

**Request:**
```typescript
interface RepairRequest {
  outlet_id: string;
  inventory_item_id: string;
  quantity: number;
  action: 'send' | 'return_fixed' | 'return_unfixable';
  notes?: string;
}
```

**Response:** `MovementResponse`

**Service:** `inventoryMovementServiceV2.processRepairV2()`

---

### 2.5 Allocations List

#### GET `/api/inventory/allocations`

**Request:**
```typescript
interface AllocationListRequest {
  outlet_id?: string;
  reference_type?: 'subscription' | 'event';
  outstanding_only?: boolean;  // Filter: outstanding_quantity > 0
  item_id?: string;
  page?: number;
  limit?: number;
}
```

**Response:**
```typescript
interface AllocationListResponse {
  allocations: AllocationWithDetails[];
  pagination: Pagination;
  summary: {
    total_allocated: number;
    total_outstanding: number;
  };
}

interface AllocationWithDetails {
  allocation_id: string;
  outlet_id: string;
  outlet_name: string;
  inventory_item_id: string;
  item_name: string;
  item_category: string;
  lifecycle_status: string;
  reference_type: 'subscription' | 'event';
  reference_id: string;
  reference_name: string;  // Client name or event name
  allocated_quantity: number;
  outstanding_quantity: number;
  days_outstanding: number;
  is_active: boolean;
  created_at: string;
}
```

**Source:** `inventory_allocations_with_details` view

---

### 2.6 Monthly Audit

#### GET `/api/inventory/audit`

**Request:**
```typescript
interface AuditListRequest {
  outlet_id?: string;
  status?: 'draft' | 'counting' | 'review' | 'pending_approval' | 'approved' | 'rejected';
  period?: string;  // YYYY-MM
}
```

**Response:**
```typescript
interface AuditListResponse {
  audits: AuditSummary[];
  can_create_new: boolean;  // false if active audit exists for outlet
}

interface AuditSummary {
  id: string;
  outlet_id: string;
  outlet_name: string;
  period: string;
  status: AuditStatus;
  items_counted: number;
  items_total: number;
  variance_positive: number;
  variance_negative: number;
  created_by: string;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
}

type AuditStatus = 'draft' | 'counting' | 'review' | 'pending_approval' | 'approved' | 'rejected';
```

---

#### POST `/api/inventory/audit`

**Create new audit:**
```typescript
interface CreateAuditRequest {
  outlet_id: string;
  period: string;  // YYYY-MM
}
```

**Response:**
```typescript
interface CreateAuditResponse {
  audit: Audit;
  count_sheet: AuditLineItem[];
}

interface Audit {
  id: string;
  outlet_id: string;
  period: string;
  status: AuditStatus;
  created_by: string;
  created_at: string;
}

interface AuditLineItem {
  id: string;
  audit_id: string;
  inventory_item_id: string;
  item_name: string;
  item_category: string;
  system_quantity: number;
  physical_quantity?: number;  // Entered by user
  variance?: number;           // Calculated
  reason_code?: string;
  notes?: string;
  status: 'pending' | 'counted' | 'reviewed';
}
```

---

#### PUT `/api/inventory/audit/:id/count`

**Update counts:**
```typescript
interface UpdateCountRequest {
  line_items: {
    line_item_id: string;
    physical_quantity: number;
  }[];
}
```

**Response:** Updated `AuditLineItem[]`

---

#### PUT `/api/inventory/audit/:id/review`

**Add reasons for variances:**
```typescript
interface ReviewRequest {
  line_items: {
    line_item_id: string;
    reason_code: string;
    notes: string;
  }[];
}
```

---

#### POST `/api/inventory/audit/:id/submit`

**Submit for approval:**
- If all variances positive → Auto-approve, create movements
- If any negative → Status = `pending_approval`

**Response:**
```typescript
interface SubmitAuditResponse {
  audit: Audit;
  auto_approved: boolean;
  movements_created?: InventoryMovement[];  // If auto-approved
  pending_approvals?: AuditLineItem[];      // If pending
}
```

---

#### POST `/api/inventory/audit/:id/approve`

**Admin approves:**
```typescript
interface ApproveAuditRequest {
  approved: boolean;
  rejection_reason?: string;
}
```

**On approve:** Creates adjustment movements for all variances

---

### 2.7 Reports

#### GET `/api/inventory/reports/stock-summary`

**Request:**
```typescript
interface StockSummaryRequest {
  outlet_id?: string;
  category?: string;
  lifecycle_status?: string[];
  format?: 'json' | 'csv';
}
```

**Response:**
```typescript
interface StockSummaryReport {
  generated_at: string;
  filters: object;
  data: {
    item_id: string;
    item_name: string;
    category: string;
    outlet_name: string;
    unit: string;
    total: number;
    available: number;
    allocated: number;
    damaged: number;
    in_repair: number;
    lost: number;
    lifecycle_status: string;
  }[];
  totals: {
    total: number;
    available: number;
    allocated: number;
    damaged: number;
    in_repair: number;
    lost: number;
  };
}
```

---

#### GET `/api/inventory/reports/outstanding`

**Request:**
```typescript
interface OutstandingReportRequest {
  outlet_id?: string;
  reference_type?: 'subscription' | 'event';
  days_overdue?: number;  // Filter: days_outstanding > X
  format?: 'json' | 'csv';
}
```

**Response:**
```typescript
interface OutstandingReport {
  generated_at: string;
  data: {
    item_name: string;
    reference_name: string;
    reference_type: string;
    allocated_date: string;
    allocated_quantity: number;
    outstanding_quantity: number;
    days_outstanding: number;
    outlet_name: string;
  }[];
  summary: {
    total_allocated: number;
    total_outstanding: number;
    avg_days_outstanding: number;
  };
}
```

---

#### GET `/api/inventory/reports/damage-loss`

**Request:**
```typescript
interface DamageLossReportRequest {
  outlet_id?: string;
  date_from?: string;
  date_to?: string;
  reason_code?: string;
  format?: 'json' | 'csv';
}
```

**Response:**
```typescript
interface DamageLossReport {
  generated_at: string;
  data: {
    date: string;
    item_name: string;
    quantity: number;
    type: 'damage' | 'loss';
    reason_code: string;
    reason_label: string;
    reference_name?: string;
    notes: string;
    reported_by: string;
    outlet_name: string;
  }[];
  summary: {
    total_damaged: number;
    total_lost: number;
    by_reason: { reason: string; count: number }[];
  };
}
```

---

#### GET `/api/inventory/reports/adjustments`

**Request:**
```typescript
interface AdjustmentReportRequest {
  outlet_id?: string;
  date_from?: string;
  date_to?: string;
  direction?: 'positive' | 'negative';
  format?: 'json' | 'csv';
}
```

**Response:**
```typescript
interface AdjustmentReport {
  generated_at: string;
  data: {
    date: string;
    item_name: string;
    quantity: number;
    direction: 'positive' | 'negative';
    reason_code: string;
    notes: string;
    created_by: string;
    approved_by?: string;
    audit_reference?: string;
    outlet_name: string;
  }[];
  summary: {
    total_positive: number;
    total_negative: number;
    net_adjustment: number;
  };
}
```

---

## 3. Component Architecture

### 3.1 Directory Structure

```
src/
├── pages/
│   └── inventory/
│       ├── index.tsx                    # Stock Overview
│       ├── items/
│       │   ├── index.tsx                # Item List
│       │   └── [id].tsx                 # Item Detail
│       ├── allocations/
│       │   └── index.tsx                # Allocations List
│       ├── audit/
│       │   ├── index.tsx                # Audit Hub
│       │   ├── [id].tsx                 # Audit Detail
│       │   └── approvals.tsx            # Admin Approval Queue
│       └── reports/
│           ├── index.tsx                # Reports Hub
│           ├── stock-summary.tsx
│           ├── outstanding.tsx
│           ├── damage-loss.tsx
│           └── adjustments.tsx
│
├── components/
│   └── inventory/
│       ├── common/
│       │   ├── LifecycleBadge.tsx       # Status badge component
│       │   ├── OpeningLockIndicator.tsx # 🔒/🔓 indicator
│       │   ├── StockBreakdown.tsx       # Mini stock cards
│       │   ├── MovementTypeIcon.tsx     # Icons per category
│       │   └── QuantityInput.tsx        # With validation
│       │
│       ├── overview/
│       │   ├── SummaryCards.tsx         # Top stats
│       │   ├── AttentionAlerts.tsx      # Clickable alerts
│       │   ├── RecentMovements.tsx      # Activity feed
│       │   └── LifecycleChart.tsx       # Donut chart
│       │
│       ├── items/
│       │   ├── ItemTable.tsx            # Main table
│       │   ├── ItemFilters.tsx          # Filter bar
│       │   ├── ItemRow.tsx              # Table row
│       │   ├── ItemDetailHeader.tsx     # Item info + actions
│       │   ├── ItemMovementsTab.tsx     # Movements tab
│       │   ├── ItemAllocationsTab.tsx   # Allocations tab
│       │   ├── CreateItemModal.tsx      # Add/edit form
│       │   └── ItemActions.tsx          # Action dropdown
│       │
│       ├── movements/
│       │   ├── StockInModal.tsx         # Add stock modal
│       │   ├── AllocateModal.tsx        # Allocate modal
│       │   ├── ReturnModal.tsx          # Return modal
│       │   ├── WriteOffModal.tsx        # Damage/loss modal
│       │   ├── AdjustModal.tsx          # Adjustment modal
│       │   ├── RepairModal.tsx          # Repair flow modal
│       │   └── MovementRow.tsx          # Movement list row
│       │
│       ├── allocations/
│       │   ├── AllocationTable.tsx      # Main table
│       │   ├── AllocationFilters.tsx    # Filter bar
│       │   ├── ProcessReturnModal.tsx   # Process return/damage/loss
│       │   └── AllocationRow.tsx        # Table row
│       │
│       ├── audit/
│       │   ├── AuditList.tsx            # Audit list
│       │   ├── AuditCountSheet.tsx      # Count entry grid
│       │   ├── AuditReviewPanel.tsx     # Variance review
│       │   ├── AuditSummary.tsx         # Final summary
│       │   ├── AuditApprovalCard.tsx    # Admin approval card
│       │   └── AuditLockWarning.tsx     # Warning banner
│       │
│       └── reports/
│           ├── ReportCard.tsx           # Report selection card
│           ├── ReportFilters.tsx        # Common filters
│           ├── ReportTable.tsx          # Generic data table
│           └── ExportButton.tsx         # CSV/PDF export
│
├── hooks/
│   └── inventory/
│       ├── useInventoryOverview.ts      # Overview data
│       ├── useInventoryItems.ts         # Items with filters
│       ├── useInventoryItem.ts          # Single item
│       ├── useInventoryMovements.ts     # Movements list
│       ├── useInventoryAllocations.ts   # Allocations list
│       ├── useInventoryAudit.ts         # Audit CRUD
│       └── useInventoryReports.ts       # Report generation
│
└── services/
    └── inventory/
        ├── inventoryServiceV2.ts        # EXISTING
        ├── inventoryMovementServiceV2.ts # EXISTING
        ├── inventoryAuditService.ts     # NEW: Audit operations
        └── inventoryReportService.ts    # NEW: Report generation
```

---

### 3.2 Component Hierarchy

```
<InventoryLayout>
│
├── <StockOverviewPage>
│   ├── <PageHeader title="Inventory Overview" />
│   ├── <OutletSelector />
│   ├── <SummaryCards />
│   │   ├── <StatCard label="Total" value={2450} />
│   │   ├── <StatCard label="Available" value={1200} />
│   │   ├── <StatCard label="Allocated" value={950} />
│   │   └── <StatCard label="Attention" value={12} color="warning" />
│   ├── <AttentionAlerts>
│   │   ├── <AlertItem link="/items?unlocked=true" />
│   │   └── <AlertItem link="/allocations?outstanding=true" />
│   ├── <RecentMovements>
│   │   └── <MovementRow /> × N
│   └── <LifecycleChart />
│
├── <ItemListPage>
│   ├── <PageHeader title="Inventory Items" actions={<AddItemBtn />} />
│   ├── <ItemFilters />
│   │   ├── <OutletSelect />
│   │   ├── <CategorySelect />
│   │   ├── <StatusSelect />
│   │   └── <SearchInput />
│   ├── <ItemTable>
│   │   └── <ItemRow> × N
│   │       ├── <LifecycleBadge status={item.lifecycle_status} />
│   │       ├── <OpeningLockIndicator locked={item.opening_balance_confirmed} />
│   │       └── <ItemActions onAction={...} />
│   └── <Pagination />
│
├── <ItemDetailPage>
│   ├── <BackButton />
│   ├── <ItemDetailHeader>
│   │   ├── <ItemInfo />
│   │   ├── <LifecycleBadge />
│   │   └── <ActionButtons />
│   ├── <StockBreakdown>
│   │   ├── <QuantityCard label="Total" />
│   │   ├── <QuantityCard label="Available" />
│   │   ├── <QuantityCard label="Allocated" />
│   │   ├── <QuantityCard label="Damaged" color="warning" />
│   │   └── <QuantityCard label="In Repair" color="info" />
│   ├── <Tabs>
│   │   ├── <Tab label="Movements">
│   │   │   └── <ItemMovementsTab />
│   │   ├── <Tab label="Allocations">
│   │   │   └── <ItemAllocationsTab />
│   │   └── <Tab label="Audit History">
│   │       └── <ItemAuditHistory />
│   └── <ActionModals />
│       ├── <StockInModal />
│       ├── <AllocateModal />
│       ├── <AdjustModal />
│       └── <RepairModal />
│
├── <AllocationsPage>
│   ├── <PageHeader title="Current Allocations" />
│   ├── <AllocationFilters />
│   ├── <AllocationTable>
│   │   └── <AllocationRow> × N
│   │       ├── <ItemName />
│   │       ├── <ReferenceName />
│   │       ├── <OutstandingBadge />
│   │       ├── <DaysOutstanding />
│   │       └── <ProcessButton />
│   └── <ProcessReturnModal />
│
├── <AuditPage>
│   ├── <PageHeader title="Monthly Audit" />
│   ├── <AuditLockWarning /> // If active audit
│   ├── <AuditList>
│   │   └── <AuditCard> × N
│   └── <CreateAuditButton />
│
├── <AuditDetailPage>
│   ├── <AuditHeader status={audit.status} />
│   ├── <AuditProgress />
│   ├── <AuditCountSheet>
│   │   └── <CountRow> × N
│   │       ├── <ItemName />
│   │       ├── <SystemQuantity />
│   │       ├── <PhysicalQuantityInput />
│   │       ├── <VarianceDisplay />
│   │       └── <ReasonSelect /> // If variance
│   ├── <AuditSummary />
│   └── <AuditActions>
│       ├── <SaveDraftButton />
│       ├── <SubmitButton />
│       └── <CancelButton />
│
└── <ReportsPage>
    ├── <PageHeader title="Reports" />
    └── <ReportGrid>
        ├── <ReportCard title="Stock Summary" icon="📊" />
        ├── <ReportCard title="Outstanding Allocations" icon="📋" />
        ├── <ReportCard title="Damage & Loss" icon="⚠️" />
        └── <ReportCard title="Adjustments" icon="🔧" />
```

---

## 4. User Flows by Role

### 4.1 Admin Flows

#### A1: Complete Lifecycle Management
```
Admin → Item List → Item Detail → Action Menu
     → Discontinue / Reactivate / Archive / Delete
     → Confirm via modal
     → Service call → DB trigger validates → Response
```

#### A2: Negative Adjustment Approval
```
Admin → Audit Approvals → Pending List
     → Review variance details
     → Approve / Reject (with reason)
     → On approve: Adjustment movements created
```

#### A3: Force Negative Adjustment
```
Admin → Item Detail → Adjust Stock
     → Select "Negative Adjustment"
     → Enter quantity, reason, notes
     → Submit (no additional approval needed)
```

### 4.2 Manager Flows

#### M1: Daily Operations
```
Manager → Stock Overview
       → Check attention items
       → Click "5 items unlocked" → Filtered item list
       → Review each, decide: confirm or adjust
```

#### M2: Process Subscription Returns
```
Manager → Allocations → Outstanding filter
       → Find subscription
       → Click "Process"
       → Select: Return Good / Return Damaged / Mark Lost
       → Enter quantity, reason, notes
       → Submit → Movement created
```

#### M3: Monthly Audit
```
Manager → Audit → New Audit
       → Select outlet & period
       → Count sheet generated
       → Enter physical counts
       → Save draft (can resume later)
       → Review variances, add reasons
       → Submit for approval (if negatives)
       → Or auto-approved (if all positive)
```

### 4.3 Accountant Flows

#### C1: View Reports
```
Accountant → Reports → Stock Summary
          → Filter by outlet, category
          → View / Export CSV
```

#### C2: Review Damage & Loss
```
Accountant → Reports → Damage & Loss
          → Filter date range
          → Export for accounting
```

#### C3: Verify Adjustments
```
Accountant → Reports → Adjustments
          → Cross-reference with audit records
          → Verify approvals
```

---

## 5. Error & Edge Cases

### 5.1 Stock Operation Errors

| Scenario | Error Message | UI Behavior |
|----------|---------------|-------------|
| Allocate > available | "Insufficient stock. Available: X" | Disable submit, show error |
| Allocate inactive item | "Only ACTIVE items can be allocated" | Button disabled |
| Return > outstanding | "Cannot return more than outstanding: X" | Input validation |
| Negative adjust (non-admin) | "Only admins can make negative adjustments" | Button hidden |
| Adjust locked item (non-admin) | "Opening balance locked. Admin required." | Show warning, disable |
| Delete with history | "Cannot delete. Has allocation history." | Show error, suggest discontinue |
| Delete with stock | "Cannot delete. Dispose stock first." | Show error |

### 5.2 Audit Errors

| Scenario | Error Message | UI Behavior |
|----------|---------------|-------------|
| Create audit (one exists) | "Active audit in progress for this period" | Disable create button |
| Movement during audit | "Audit in progress. Stock may have changed." | Warning modal |
| Submit without all counts | "Complete all counts before submitting" | Validation error |
| Variance without reason | "Reason required for all variances" | Validation error |
| Negative without notes | "Notes required for negative adjustments" | Validation error |

### 5.3 Navigation Edge Cases

| Scenario | Behavior |
|----------|----------|
| Item archived, user navigates to detail | Show read-only banner, disable all actions |
| User navigates to outlet they don't have access to | Redirect to overview with error toast |
| Audit approved, user goes back to count | Show read-only, status: Approved |
| Allocation closed, user tries to process | "Allocation is no longer active" error |

---

## 6. Performance Considerations

### 6.1 Query Optimization

| Screen | Strategy |
|--------|----------|
| Stock Overview | Single aggregated query on `inventory_stock_summary` |
| Item List | Paginated (20 items), indexed on outlet_id, lifecycle_status |
| Item Detail | Single item fetch, lazy-load tabs |
| Movements | Paginated (50), indexed on inventory_item_id, created_at |
| Allocations | Use view `inventory_allocations_with_details` |
| Reports | Server-side generation, streaming for large exports |

### 6.2 Caching Strategy

| Data | TTL | Invalidation |
|------|-----|--------------|
| Overview summary | 60s | On any movement |
| Item list | 30s | On item CRUD |
| Item detail | 30s | On related movement |
| Reports | No cache | Generate on-demand |

### 6.3 Real-time Considerations

| Feature | Approach |
|---------|----------|
| Movement notifications | Supabase realtime on `inventory_movements` |
| Audit count sync | Realtime on `audit_line_items` |
| Approval notifications | Realtime on `inventory_audits` |

### 6.4 Pagination Rules

| Table | Default Page Size | Max Page Size |
|-------|-------------------|---------------|
| Items | 20 | 100 |
| Movements | 50 | 200 |
| Allocations | 20 | 100 |
| Audit line items | All (no pagination) | - |
| Reports | 100 | 1000 (then force export) |

---

## 7. Implementation Checklist

### 7.1 Phase 3A: Core UI (Week 1-2)

- [ ] Stock Overview Dashboard
  - [ ] Summary cards
  - [ ] Attention alerts (with deep links)
  - [ ] Recent movements feed
  - [ ] Lifecycle breakdown chart

- [ ] Item Master
  - [ ] Item list with filters
  - [ ] Lifecycle badges
  - [ ] Create/edit item modal
  - [ ] Action dropdown

- [ ] Item Detail
  - [ ] Stock breakdown
  - [ ] Movements tab
  - [ ] Allocations tab (with days outstanding)
  - [ ] Action modals (stock in, allocate, adjust, repair)

### 7.2 Phase 3B: Allocations & Returns (Week 2-3)

- [ ] Allocations List
  - [ ] Table with filters
  - [ ] Outstanding filter
  - [ ] Days outstanding column

- [ ] Process Returns Modal
  - [ ] Return good
  - [ ] Return damaged
  - [ ] Mark as damaged
  - [ ] Mark as lost
  - [ ] Reason + notes

### 7.3 Phase 3C: Audit Workflow (Week 3-4)

- [ ] Audit Service (NEW)
  - [ ] Create audit
  - [ ] Update counts
  - [ ] Submit for approval
  - [ ] Approve/reject

- [ ] Audit UI
  - [ ] Audit list
  - [ ] Count sheet
  - [ ] Variance review
  - [ ] Admin approval queue
  - [ ] Audit lock warning

### 7.4 Phase 3D: Reports (Week 4)

- [ ] Report Service (NEW)
  - [ ] Stock summary
  - [ ] Outstanding allocations
  - [ ] Damage & loss
  - [ ] Adjustment history

- [ ] Report UI
  - [ ] Report hub
  - [ ] Filter panels
  - [ ] Data tables
  - [ ] CSV export

### 7.5 Phase 3E: Polish (Week 5)

- [ ] Empty states
- [ ] Loading states
- [ ] Error boundaries
- [ ] Tooltips & help text
- [ ] Keyboard navigation
- [ ] Mobile responsiveness

---

## Micro Additions (LOCKED)

| # | Feature | Location |
|---|---------|----------|
| A | Attention cards with deep links | `AttentionAlerts.tsx` |
| B | Days outstanding column | `ItemAllocationsTab.tsx`, `AllocationRow.tsx` |
| C | Audit lock warning/block | `AuditLockWarning.tsx`, movement modals |

---

## Database Changes Required

### New Table: `inventory_audits`

```sql
CREATE TABLE inventory_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  period VARCHAR(7) NOT NULL,  -- YYYY-MM
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'counting', 'review', 'pending_approval', 'approved', 'rejected')),
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  approved_by UUID REFERENCES user_profiles(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ,
  
  UNIQUE (outlet_id, period)
);
```

### New Table: `inventory_audit_line_items`

```sql
CREATE TABLE inventory_audit_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES inventory_audits(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  system_quantity INTEGER NOT NULL,
  physical_quantity INTEGER,
  variance INTEGER GENERATED ALWAYS AS (physical_quantity - system_quantity) STORED,
  reason_code VARCHAR(50),
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'counted', 'reviewed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (audit_id, inventory_item_id)
);
```

### Indexes

```sql
CREATE INDEX idx_audits_outlet_period ON inventory_audits(outlet_id, period);
CREATE INDEX idx_audits_status ON inventory_audits(status);
CREATE INDEX idx_audit_items_audit ON inventory_audit_line_items(audit_id);
CREATE INDEX idx_audit_items_item ON inventory_audit_line_items(inventory_item_id);
```

---

**Ready for implementation!**
