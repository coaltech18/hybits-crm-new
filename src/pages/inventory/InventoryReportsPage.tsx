import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getInventoryItems } from '@/services/inventoryService';
import {
  getStockSummaryReport,
  exportStockSummaryCSV,
  getAllocationReport,
  exportAllocationReportCSV,
  getDamageLossReport,
  exportDamageLossCSV,
  getMovementHistoryReport,
  exportMovementHistoryCSV,
} from '@/services/inventoryReportService';
import type { InventoryItem, Outlet } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { BarChart3, Download } from 'lucide-react';

// ================================================================
// INVENTORY REPORTS PAGE
// ================================================================
// CRITICAL RULES:
// - Reports are READ-ONLY
// - Data from DB views ONLY (no UI calculations)
// - CSV export mandatory for all reports
// - Role-based outlet filtering
// ================================================================

type ReportTab = 'stock' | 'allocation' | 'damage' | 'movements';

export default function InventoryReportsPage() {
  const { user, outlets } = useAuth();
  const [activeTab, setActiveTab] = useState<ReportTab>('stock');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userRole = user?.role || '';
  const showOutletFilter = userRole === 'admin' || userRole === 'accountant';
  const availableOutlets: Outlet[] = outlets || [];

  const tabs = [
    { id: 'stock' as const, label: 'Stock Summary' },
    { id: 'allocation' as const, label: 'Allocation' },
    { id: 'damage' as const, label: 'Damage & Loss' },
    { id: 'movements' as const, label: 'Movements' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BarChart3 className="w-8 h-8" />
          Inventory Reports
        </h1>
        <p className="text-muted-foreground mt-1">
          Production-grade inventory reporting with CSV exports
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Tabs */}
      <Card>
        <div className="flex flex-wrap gap-2 border-b pb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${activeTab === tab.id
                ? 'bg-primary text-white'
                : 'bg-muted hover:bg-muted/80'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Report Content */}
      {activeTab === 'stock' && (
        <StockSummaryReport
          userId={user?.id || ''}
          userRole={userRole}
          showOutletFilter={showOutletFilter}
          outlets={availableOutlets}
          loading={loading}
          setLoading={setLoading}
          setError={setError}
        />
      )}

      {activeTab === 'allocation' && (
        <AllocationReportTab
          userId={user?.id || ''}
          userRole={userRole}
          showOutletFilter={showOutletFilter}
          outlets={availableOutlets}
          loading={loading}
          setLoading={setLoading}
          setError={setError}
        />
      )}

      {activeTab === 'damage' && (
        <DamageLossReportTab
          userId={user?.id || ''}
          userRole={userRole}
          showOutletFilter={showOutletFilter}
          outlets={availableOutlets}
          loading={loading}
          setLoading={setLoading}
          setError={setError}
        />
      )}

      {activeTab === 'movements' && (
        <MovementHistoryReportTab
          userId={user?.id || ''}
          userRole={userRole}
          showOutletFilter={showOutletFilter}
          outlets={availableOutlets}
          loading={loading}
          setLoading={setLoading}
          setError={setError}
        />
      )}
    </div>
  );
}

// ================================================================
// STOCK SUMMARY REPORT TAB
// ================================================================

interface ReportTabProps {
  userId: string;
  userRole: string;
  showOutletFilter: boolean;
  outlets: any[];
  loading: boolean;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

function StockSummaryReport({
  userId,
  showOutletFilter,
  outlets,
  setLoading,
  setError,
}: ReportTabProps) {
  const [data, setData] = useState<any[]>([]);
  const [outletId, setOutletId] = useState('');
  const [category, setCategory] = useState('');
  const [isActive, setIsActive] = useState('true');

  useEffect(() => {
    loadData();
  }, [userId, outletId, category, isActive]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const filters: any = {};
      if (outletId) filters.outlet_id = outletId;
      if (category) filters.category = category;
      if (isActive !== '') filters.is_active = isActive === 'true';

      const reportData = await getStockSummaryReport(userId, filters);
      setData(reportData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    try {
      const filters: any = {};
      if (outletId) filters.outlet_id = outletId;
      if (category) filters.category = category;
      if (isActive !== '') filters.is_active = isActive === 'true';

      const csv = await exportStockSummaryCSV(userId, filters);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `stock-summary-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export CSV');
    }
  }

  const totalItems = data.length;
  const totalAvailable = data.reduce((sum, row) => sum + (row.available_quantity || 0), 0);
  const totalAllocated = data.reduce((sum, row) => sum + (row.allocated_quantity || 0), 0);
  const totalDamaged = data.reduce((sum, row) => sum + (row.damaged_quantity || 0), 0);
  const totalLost = data.reduce((sum, row) => sum + (row.lost_quantity || 0), 0);

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <p className="text-sm text-muted-foreground">Total Items</p>
          <p className="text-2xl font-bold">{totalItems}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Available</p>
          <p className="text-2xl font-bold text-green-600">{totalAvailable}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Allocated</p>
          <p className="text-2xl font-bold text-brand-primary">{totalAllocated}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Damaged</p>
          <p className="text-2xl font-bold text-orange-600">{totalDamaged}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Lost</p>
          <p className="text-2xl font-bold text-red-600">{totalLost}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Filters</h3>
          <Button onClick={handleExport} disabled={data.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {showOutletFilter && (
            <Select
              label="Outlet"
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
            >
              <option value="">All Outlets</option>
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </Select>
          )}

          <Input
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Filter by category"
          />

          <Select
            label="Status"
            value={isActive}
            onChange={(e) => setIsActive(e.target.value)}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
            <option value="">All</option>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <h3 className="font-semibold mb-4">Stock Summary</h3>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No data found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 px-2">Item</th>
                  <th className="text-left py-2 px-2">Category</th>
                  {showOutletFilter && <th className="text-left py-2 px-2">Outlet</th>}
                  <th className="text-right py-2 px-2">Total</th>
                  <th className="text-right py-2 px-2">Available</th>
                  <th className="text-right py-2 px-2">Allocated</th>
                  <th className="text-right py-2 px-2">Damaged</th>
                  <th className="text-right py-2 px-2">Lost</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-2 px-2 font-medium">{row.item_name}</td>
                    <td className="py-2 px-2">
                      <Badge variant="default">{row.category}</Badge>
                    </td>
                    {showOutletFilter && <td className="py-2 px-2 text-sm">{row.outlet_name}</td>}
                    <td className="text-right py-2 px-2">{row.total_quantity}</td>
                    <td className="text-right py-2 px-2 text-green-600 font-semibold">{row.available_quantity}</td>
                    <td className="text-right py-2 px-2 text-brand-primary">{row.allocated_quantity}</td>
                    <td className="text-right py-2 px-2 text-orange-600">{row.damaged_quantity}</td>
                    <td className="text-right py-2 px-2 text-red-600">{row.lost_quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

// ================================================================
// ALLOCATION REPORT TAB
// ================================================================

function AllocationReportTab({ userId, showOutletFilter, outlets, setLoading, setError }: ReportTabProps) {
  const [data, setData] = useState<any[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [outletId, setOutletId] = useState('');
  const [referenceType, setReferenceType] = useState('');
  const [itemId, setItemId] = useState('');

  useEffect(() => {
    loadItems();
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [userId, outletId, referenceType, itemId]);

  async function loadItems() {
    try {
      const itemData = await getInventoryItems(userId, { is_active: true });
      setItems(itemData);
    } catch (err) {
      console.error('Failed to load items:', err);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const filters: any = {};
      if (outletId) filters.outlet_id = outletId;
      if (referenceType) filters.reference_type = referenceType;
      if (itemId) filters.inventory_item_id = itemId;

      const reportData = await getAllocationReport(userId, filters);
      setData(reportData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    try {
      const filters: any = {};
      if (outletId) filters.outlet_id = outletId;
      if (referenceType) filters.reference_type = referenceType;
      if (itemId) filters.inventory_item_id = itemId;

      const csv = await exportAllocationReportCSV(userId, filters);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `allocation-report-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export CSV');
    }
  }

  const totalAllocated = data.reduce((sum, row) => sum + (row.allocated_quantity || 0), 0);
  const totalOutstanding = data.reduce((sum, row) => sum + (row.outstanding_quantity || 0), 0);

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-muted-foreground">Active Allocations</p>
          <p className="text-2xl font-bold">{data.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Total Allocated</p>
          <p className="text-2xl font-bold text-brand-primary">{totalAllocated}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Total Outstanding</p>
          <p className="text-2xl font-bold text-orange-600">{totalOutstanding}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Filters</h3>
          <Button onClick={handleExport} disabled={data.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {showOutletFilter && (
            <Select
              label="Outlet"
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
            >
              <option value="">All Outlets</option>
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </Select>
          )}

          <Select
            label="Reference Type"
            value={referenceType}
            onChange={(e) => setReferenceType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="subscription">Subscription</option>
            <option value="event">Event</option>
          </Select>

          <Select
            label="Item"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
          >
            <option value="">All Items</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.category})
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <h3 className="font-semibold mb-4">Current Allocations</h3>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No allocations found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 px-2">Item</th>
                  <th className="text-left py-2 px-2">Category</th>
                  {showOutletFilter && <th className="text-left py-2 px-2">Outlet</th>}
                  <th className="text-left py-2 px-2">Reference</th>
                  <th className="text-right py-2 px-2">Allocated</th>
                  <th className="text-right py-2 px-2">Outstanding</th>
                  <th className="text-center py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-2 px-2 font-medium">{row.item_name}</td>
                    <td className="py-2 px-2">
                      <Badge variant="default">{row.item_category}</Badge>
                    </td>
                    {showOutletFilter && <td className="py-2 px-2 text-sm">{row.outlet_name}</td>}
                    <td className="py-2 px-2 text-sm">
                      <div>
                        <Badge variant="default">{row.reference_type}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">{row.reference_name}</p>
                      </div>
                    </td>
                    <td className="text-right py-2 px-2 font-semibold">{row.allocated_quantity}</td>
                    <td className="text-right py-2 px-2 text-orange-600 font-semibold">{row.outstanding_quantity}</td>
                    <td className="text-center py-2 px-2">
                      {row.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Closed</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

// ================================================================
// DAMAGE & LOSS REPORT TAB
// ================================================================

function DamageLossReportTab({ userId, showOutletFilter, outlets, setLoading, setError }: ReportTabProps) {
  const [data, setData] = useState<any[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [outletId, setOutletId] = useState('');
  const [movementType, setMovementType] = useState('');
  const [itemId, setItemId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadItems();
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [userId, outletId, movementType, itemId, dateFrom, dateTo]);

  async function loadItems() {
    try {
      const itemData = await getInventoryItems(userId, { is_active: true });
      setItems(itemData);
    } catch (err) {
      console.error('Failed to load items:', err);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const filters: any = {};
      if (outletId) filters.outlet_id = outletId;
      if (movementType) filters.movement_type = movementType;
      if (itemId) filters.inventory_item_id = itemId;
      if (dateFrom) filters.date_from = dateFrom;
      if (dateTo) filters.date_to = dateTo;

      const reportData = await getDamageLossReport(userId, filters);
      setData(reportData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    try {
      const filters: any = {};
      if (outletId) filters.outlet_id = outletId;
      if (movementType) filters.movement_type = movementType;
      if (itemId) filters.inventory_item_id = itemId;
      if (dateFrom) filters.date_from = dateFrom;
      if (dateTo) filters.date_to = dateTo;

      const csv = await exportDamageLossCSV(userId, filters);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `damage-loss-report-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export CSV');
    }
  }

  const totalIncidents = data.reduce((sum, row) => sum + (row.incident_count || 0), 0);
  const totalQuantity = data.reduce((sum, row) => sum + (row.total_quantity || 0), 0);

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <p className="text-sm text-muted-foreground">Total Incidents</p>
          <p className="text-2xl font-bold">{totalIncidents}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Total Quantity Affected</p>
          <p className="text-2xl font-bold text-red-600">{totalQuantity}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Filters</h3>
          <Button onClick={handleExport} disabled={data.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {showOutletFilter && (
            <Select
              label="Outlet"
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
            >
              <option value="">All Outlets</option>
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </Select>
          )}

          <Select
            label="Type"
            value={movementType}
            onChange={(e) => setMovementType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="damage">Damage</option>
            <option value="loss">Loss</option>
          </Select>

          <Select
            label="Item"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
          >
            <option value="">All Items</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.category})
              </option>
            ))}
          </Select>

          <Input
            type="date"
            label="From Date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />

          <Input
            type="date"
            label="To Date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </Card>

      {/* Table */}
      <Card>
        <h3 className="font-semibold mb-4">Damage & Loss History</h3>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No incidents found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Item</th>
                  {showOutletFilter && <th className="text-left py-2 px-2">Outlet</th>}
                  <th className="text-left py-2 px-2">Type</th>
                  <th className="text-right py-2 px-2">Incidents</th>
                  <th className="text-right py-2 px-2">Quantity</th>
                  <th className="text-left py-2 px-2">Reference</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-2 px-2 text-sm">{row.report_date}</td>
                    <td className="py-2 px-2">
                      <div>
                        <p className="font-medium">{row.item_name}</p>
                        <p className="text-xs text-muted-foreground">{row.item_category}</p>
                      </div>
                    </td>
                    {showOutletFilter && <td className="py-2 px-2 text-sm">{row.outlet_name}</td>}
                    <td className="py-2 px-2">
                      <Badge variant={row.movement_type === 'loss' ? 'destructive' : 'warning'}>
                        {row.movement_type.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="text-right py-2 px-2">{row.incident_count}</td>
                    <td className="text-right py-2 px-2 font-semibold text-red-600">{row.total_quantity}</td>
                    <td className="py-2 px-2 text-sm">
                      <div>
                        <Badge variant="default">{row.reference_type}</Badge>
                        {row.reference_name && (
                          <p className="text-xs text-muted-foreground mt-1">{row.reference_name}</p>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

// ================================================================
// MOVEMENT HISTORY REPORT TAB
// ================================================================

function MovementHistoryReportTab({ userId, showOutletFilter, outlets, setLoading, setError }: ReportTabProps) {
  const [data, setData] = useState<any[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [outletId, setOutletId] = useState('');
  const [movementType, setMovementType] = useState('');
  const [itemId, setItemId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadItems();
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [userId, outletId, movementType, itemId, dateFrom, dateTo]);

  async function loadItems() {
    try {
      const itemData = await getInventoryItems(userId, { is_active: true });
      setItems(itemData);
    } catch (err) {
      console.error('Failed to load items:', err);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const filters: any = {};
      if (outletId) filters.outlet_id = outletId;
      if (movementType) filters.movement_type = movementType;
      if (itemId) filters.inventory_item_id = itemId;
      if (dateFrom) filters.date_from = dateFrom;
      if (dateTo) filters.date_to = dateTo;

      const reportData = await getMovementHistoryReport(userId, filters);
      setData(reportData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    try {
      const filters: any = {};
      if (outletId) filters.outlet_id = outletId;
      if (movementType) filters.movement_type = movementType;
      if (itemId) filters.inventory_item_id = itemId;
      if (dateFrom) filters.date_from = dateFrom;
      if (dateTo) filters.date_to = dateTo;

      const csv = await exportMovementHistoryCSV(userId, filters);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `movement-history-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export CSV');
    }
  }

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
        <Card>
          <p className="text-sm text-muted-foreground">Total Movements</p>
          <p className="text-2xl font-bold">{data.length}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Filters</h3>
          <Button onClick={handleExport} disabled={data.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {showOutletFilter && (
            <Select
              label="Outlet"
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
            >
              <option value="">All Outlets</option>
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </Select>
          )}

          <Select
            label="Movement Type"
            value={movementType}
            onChange={(e) => setMovementType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="stock_in">Stock In</option>
            <option value="allocation">Allocation</option>
            <option value="return">Return</option>
            <option value="damage">Damage</option>
            <option value="loss">Loss</option>
            <option value="adjustment">Adjustment</option>
          </Select>

          <Select
            label="Item"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
          >
            <option value="">All Items</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.category})
              </option>
            ))}
          </Select>

          <Input
            type="date"
            label="From Date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />

          <Input
            type="date"
            label="To Date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </Card>

      {/* Table */}
      <Card>
        <h3 className="font-semibold mb-4">Complete Movement History (Immutable Audit Trail)</h3>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No movements found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 px-2">Date/Time</th>
                  <th className="text-left py-2 px-2">Item</th>
                  {showOutletFilter && <th className="text-left py-2 px-2">Outlet</th>}
                  <th className="text-left py-2 px-2">Type</th>
                  <th className="text-right py-2 px-2">Qty</th>
                  <th className="text-left py-2 px-2">Reference</th>
                  <th className="text-left py-2 px-2">Notes</th>
                  <th className="text-left py-2 px-2">User</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-2 px-2">
                      <div>
                        <p>{new Date(row.created_at).toLocaleDateString()}</p>
                        <p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleTimeString()}</p>
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <div>
                        <p className="font-medium">{row.item_name}</p>
                        <p className="text-xs text-muted-foreground">{row.item_category}</p>
                      </div>
                    </td>
                    {showOutletFilter && <td className="py-2 px-2">{row.outlet_name}</td>}
                    <td className="py-2 px-2">
                      <Badge variant="default">{row.movement_type.replace('_', ' ').toUpperCase()}</Badge>
                    </td>
                    <td className="text-right py-2 px-2 font-semibold">{row.quantity}</td>
                    <td className="py-2 px-2">
                      <div>
                        <Badge variant="secondary">{row.reference_type}</Badge>
                        {row.reference_name && (
                          <p className="text-xs text-muted-foreground mt-1">{row.reference_name}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2 max-w-xs truncate">{row.notes || '-'}</td>
                    <td className="py-2 px-2">{row.created_by_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
