import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { getInventoryMovements } from '@/services/inventoryMovementService';
import { getInventoryItems } from '@/services/inventoryService';
import type { InventoryMovement, InventoryItem, MovementType } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { History, Download } from 'lucide-react';
import Papa from 'papaparse';

// ================================================================
// INVENTORY MOVEMENTS PAGE
// ================================================================
// CRITICAL RULES:
// - Read-only for all roles
// - All data from DB (inventory_movements_with_details view)
// - CSV export matches table data exactly
// - Manager sees assigned outlets only (RLS enforced)
// ================================================================

export default function InventoryMovementsPage() {
  const { user, outlets } = useAuth();
  const [searchParams] = useSearchParams();
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [outletId, setOutletId] = useState('');
  const [itemId, setItemId] = useState(searchParams.get('item') || '');
  const [movementType, setMovementType] = useState<MovementType | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const userRole = user?.role || '';
  const showOutletFilter = userRole === 'admin' || userRole === 'accountant';
  const availableOutlets = outlets || [];

  useEffect(() => {
    loadItems();
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [user?.id, outletId, itemId, movementType, dateFrom, dateTo]);

  async function loadItems() {
    if (!user?.id) return;

    try {
      const data = await getInventoryItems(user.id, { is_active: true });
      setItems(data);
    } catch (err) {
      console.error('Failed to load items:', err);
    }
  }

  async function loadData() {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      const filters: any = {};
      if (outletId) filters.outlet_id = outletId;
      if (itemId) filters.inventory_item_id = itemId;
      if (movementType) filters.movement_type = movementType;
      if (dateFrom) filters.date_from = dateFrom;
      if (dateTo) filters.date_to = dateTo;

      const data = await getInventoryMovements(user.id, filters);
      setMovements(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load movements');
    } finally {
      setLoading(false);
    }
  }

  function getMovementTypeBadge(type: MovementType) {
    const colors: Record<MovementType, string> = {
      stock_in: 'bg-green-100 text-green-800',
      allocation: 'bg-brand-primary/20 text-brand-primary',
      return: 'bg-purple-100 text-purple-800',
      damage: 'bg-orange-100 text-orange-800',
      loss: 'bg-red-100 text-red-800',
      adjustment: 'bg-yellow-100 text-yellow-800',
    };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${colors[type]}`}>
        {type.replace('_', ' ').toUpperCase()}
      </span>
    );
  }

  function exportToCSV() {
    const csvData = movements.map(m => ({
      Date: new Date(m.created_at).toLocaleDateString(),
      Time: new Date(m.created_at).toLocaleTimeString(),
      Item: m.item_name || '',
      Category: m.item_category || '',
      Outlet: m.outlet_name || '',
      'Movement Type': m.movement_type,
      Quantity: m.quantity,
      'Reference Type': m.reference_type,
      'Reference Name': m.reference_name || '',
      Notes: m.notes || '',
      'Created By': m.created_by_name || '',
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory-movements-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (loading && movements.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <History className="w-8 h-8" />
            Inventory Movements
          </h1>
          <p className="text-muted-foreground mt-1">
            Complete movement history (read-only)
          </p>
        </div>

        {movements.length > 0 && (
          <Button onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Filters */}
      <Card>
        <h3 className="font-semibold mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {showOutletFilter && (
            <Select
              label="Outlet"
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
            >
              <option value="">All Outlets</option>
              {availableOutlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </Select>
          )}

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

          <Select
            label="Movement Type"
            value={movementType}
            onChange={(e) => setMovementType(e.target.value as MovementType | '')}
          >
            <option value="">All Types</option>
            <option value="stock_in">Stock In</option>
            <option value="allocation">Allocation</option>
            <option value="return">Return</option>
            <option value="damage">Damage</option>
            <option value="loss">Loss</option>
            <option value="adjustment">Adjustment</option>
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

          {(outletId || itemId || movementType || dateFrom || dateTo) && (
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setOutletId('');
                  setItemId('');
                  setMovementType('');
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Movements Table */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Movement History</h3>
          <p className="text-sm text-muted-foreground">{movements.length} movements</p>
        </div>

        {movements.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No movements found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-3 px-4">Date/Time</th>
                  <th className="text-left py-3 px-4">Item</th>
                  {showOutletFilter && <th className="text-left py-3 px-4">Outlet</th>}
                  <th className="text-left py-3 px-4">Type</th>
                  <th className="text-right py-3 px-4">Quantity</th>
                  <th className="text-left py-3 px-4">Reference</th>
                  <th className="text-left py-3 px-4">Notes</th>
                  <th className="text-left py-3 px-4">User</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4 text-sm">
                      <div>
                        <p>{new Date(movement.created_at).toLocaleDateString()}</p>
                        <p className="text-muted-foreground text-xs">
                          {new Date(movement.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-sm">{movement.item_name}</p>
                        <p className="text-xs text-muted-foreground">{movement.item_category}</p>
                      </div>
                    </td>
                    {showOutletFilter && (
                      <td className="py-3 px-4 text-sm">{movement.outlet_name}</td>
                    )}
                    <td className="py-3 px-4">{getMovementTypeBadge(movement.movement_type)}</td>
                    <td className="text-right py-3 px-4 font-semibold">{movement.quantity}</td>
                    <td className="py-3 px-4 text-sm">
                      {movement.reference_type !== 'manual' && (
                        <div>
                          <Badge variant="default">{movement.reference_type}</Badge>
                          {movement.reference_name && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {movement.reference_name}
                            </p>
                          )}
                        </div>
                      )}
                      {movement.reference_type === 'manual' && (
                        <span className="text-muted-foreground">Manual</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm">{movement.notes || '-'}</td>
                    <td className="py-3 px-4 text-sm">{movement.created_by_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
