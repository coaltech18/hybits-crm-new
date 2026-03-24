import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { getAllocationsByReference, getAllocationSummary } from '@/services/allocationService';
import type { InventoryAllocation, ReferenceType } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Package, Plus, ArrowLeft } from 'lucide-react';
import AllocateInventoryModal from '@/components/inventory/AllocateInventoryModal';
import ReturnDamageLossModal from '@/components/inventory/ReturnDamageLossModal';

// ================================================================
// INVENTORY ALLOCATION PAGE
// ================================================================
// CRITICAL RULES:
// - Allocate dishware to subscriptions or events
// - Outstanding quantity is DERIVED from DB (not calculated in UI)
// - Accountants are read-only
// ================================================================

export default function InventoryAllocationPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  // URL params for deep linking from Event/Subscription detail pages
  const paramType = searchParams.get('type');
  const paramRef = searchParams.get('ref');

  const [referenceType, setReferenceType] = useState<ReferenceType | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReference, setSelectedReference] = useState<{
    id: string;
    name: string;
    outlet_id: string;
  } | null>(null);

  // Reference search results
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Allocations
  const [allocations, setAllocations] = useState<InventoryAllocation[]>([]);
  const [summary, setSummary] = useState<{
    totalAllocated: number;
    totalOutstanding: number;
    itemCount: number;
  } | null>(null);
  const [allocationsLoading, setAllocationsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [returnAllocation, setReturnAllocation] = useState<InventoryAllocation | null>(null);

  const isAccountant = user?.role === 'accountant';

  // Auto-select reference from URL params on mount
  useEffect(() => {
    const isValidType = paramType === 'subscription' || paramType === 'event';
    const isValidRef = paramRef && paramRef.length > 0;
    if (isValidType && isValidRef && !selectedReference) {
      autoSelectReference(paramType as ReferenceType, paramRef);
    }
  }, []); // Run once on mount

  useEffect(() => {
    if (searchQuery && referenceType) {
      searchReferences();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, referenceType]);

  useEffect(() => {
    if (selectedReference && referenceType) {
      loadAllocations();
    }
  }, [selectedReference, referenceType]);

  async function searchReferences() {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);

      if (referenceType === 'subscription') {
        const { data } = await supabase
          .from('subscriptions')
          .select('id, client_id, outlet_id, status, clients(name)')
          .ilike('clients.name', `%${searchQuery}%`)
          .eq('is_active', true)
          .limit(10);

        setSearchResults(
          data?.map((s: any) => ({
            id: s.id,
            name: s.clients?.name || 'Unknown',
            outlet_id: s.outlet_id,
            status: s.status,
          })) || []
        );
      } else if (referenceType === 'event') {
        const { data } = await supabase
          .from('events')
          .select('id, event_name, outlet_id, status')
          .ilike('event_name', `%${searchQuery}%`)
          .neq('status', 'cancelled')
          .limit(10);

        setSearchResults(
          data?.map((e: any) => ({
            id: e.id,
            name: e.event_name,
            outlet_id: e.outlet_id,
            status: e.status,
          })) || []
        );
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearchLoading(false);
    }
  }

  // Auto-select reference from URL params (deep link from Event/Subscription detail pages)
  async function autoSelectReference(type: ReferenceType, refId: string) {
    try {
      setReferenceType(type);

      if (type === 'subscription') {
        const { data } = await supabase
          .from('subscriptions')
          .select('id, client_id, outlet_id, status, clients(name)')
          .eq('id', refId)
          .eq('is_active', true)
          .maybeSingle();

        if (data) {
          setSelectedReference({
            id: data.id,
            name: (data.clients as any)?.name || 'Unknown',
            outlet_id: data.outlet_id,
          });
        }
      } else if (type === 'event') {
        const { data } = await supabase
          .from('events')
          .select('id, event_name, outlet_id, status')
          .eq('id', refId)
          .maybeSingle();

        if (data) {
          setSelectedReference({
            id: data.id,
            name: data.event_name,
            outlet_id: data.outlet_id,
          });
        }
      }
    } catch (err) {
      console.error('Auto-select failed, falling back to manual search:', err);
      // Fail silently — user can still search manually
    }
  }

  async function loadAllocations() {
    if (!user?.id || !selectedReference || !referenceType) return;

    try {
      setAllocationsLoading(true);
      setError(null);

      const [allocationsData, summaryData] = await Promise.all([
        getAllocationsByReference(user.id, referenceType as ReferenceType, selectedReference.id),
        getAllocationSummary(user.id, referenceType as ReferenceType, selectedReference.id),
      ]);

      setAllocations(allocationsData);
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load allocations');
    } finally {
      setAllocationsLoading(false);
    }
  }

  function handleSelectReference(ref: any) {
    setSelectedReference(ref);
    setSearchQuery('');
    setSearchResults([]);
  }

  function handleBack() {
    setSelectedReference(null);
    setAllocations([]);
    setSummary(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="w-8 h-8" />
            Send / Receive Items
          </h1>
          <p className="text-muted-foreground mt-1">
            Send and receive dishware for subscriptions or events
          </p>
        </div>

        {selectedReference && !isAccountant && (
          <Button onClick={() => setShowAllocateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Allocate Items
          </Button>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {!selectedReference ? (
        /* Search for Reference */
        <Card>
          <h3 className="font-semibold mb-4">Select Subscription or Event</h3>

          <div className="space-y-4">
            <Select
              label="Reference Type"
              value={referenceType}
              onChange={(e) => setReferenceType(e.target.value as ReferenceType | '')}
            >
              <option value="">Select Type</option>
              <option value="subscription">Subscription</option>
              <option value="event">Event</option>
            </Select>

            {referenceType && (
              <Input
                label={`Search ${referenceType === 'subscription' ? 'by client name' : 'by event name'}`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Type to search...`}
              />
            )}

            {searchLoading && (
              <div className="flex items-center justify-center py-4">
                <Spinner />
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="border rounded divide-y">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleSelectReference(result)}
                    className="w-full text-left p-4 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{result.name}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {referenceType} - {result.status}
                        </p>
                      </div>
                      <Badge variant="default">Select</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>
      ) : (
        /* View Allocations */
        <>
          {/* Back button */}
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Search
          </Button>

          {/* Reference Info */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground capitalize">{referenceType}</p>
                <h3 className="text-xl font-bold">{selectedReference.name}</h3>
              </div>
              {summary && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Sent</p>
                  <p className="text-2xl font-bold text-brand-primary">{summary.totalAllocated}</p>
                  <p className="text-sm text-muted-foreground mt-1">Pending Return</p>
                  <p className="text-lg font-semibold text-orange-600">{summary.totalOutstanding}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Allocations Table */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Sent Items</h3>
              <p className="text-sm text-muted-foreground">
                {allocations.length} item{allocations.length !== 1 ? 's' : ''}
              </p>
            </div>

            {allocationsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : allocations.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No items sent out yet</p>
                {!isAccountant && (
                  <Button onClick={() => setShowAllocateModal(true)} className="mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Allocate Items
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-3 px-4">Item</th>
                      <th className="text-left py-3 px-4">Category</th>
                      <th className="text-right py-3 px-4">Sent</th>
                      <th className="text-right py-3 px-4">Pending Return</th>
                      <th className="text-center py-3 px-4">Status</th>
                      <th className="text-center py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map((allocation) => (
                      <tr key={allocation.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{allocation.item_name}</td>
                        <td className="py-3 px-4">
                          <Badge variant="default">{allocation.item_category}</Badge>
                        </td>
                        <td className="text-right py-3 px-4 font-semibold">
                          {allocation.allocated_quantity}
                        </td>
                        <td className="text-right py-3 px-4 text-orange-600 font-semibold">
                          {allocation.outstanding_quantity || 0}
                        </td>
                        <td className="text-center py-3 px-4">
                          {allocation.is_active ? (
                            <Badge variant="success">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Closed</Badge>
                          )}
                        </td>
                        <td className="text-center py-3 px-4">
                          {allocation.is_active &&
                            (allocation.outstanding_quantity || 0) > 0 &&
                            !isAccountant && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setReturnAllocation(allocation)}
                              >
                                Process Return
                              </Button>
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
      )}

      {/* Allocate Modal */}
      {showAllocateModal && selectedReference && selectedReference.outlet_id && referenceType && (
        <AllocateInventoryModal
          isOpen={showAllocateModal}
          onClose={() => setShowAllocateModal(false)}
          onSuccess={() => {
            loadAllocations();
            showToast('Inventory allocated successfully', 'success');
          }}
          userId={user?.id || ''}
          outletId={selectedReference.outlet_id}
          referenceType={referenceType as ReferenceType}
          referenceId={selectedReference.id}
          referenceName={selectedReference.name}
        />
      )}

      {/* Return/Damage/Loss Modal */}
      {returnAllocation && selectedReference && selectedReference.outlet_id && referenceType && (
        <ReturnDamageLossModal
          isOpen={!!returnAllocation}
          onClose={() => setReturnAllocation(null)}
          onSuccess={() => {
            loadAllocations();
            showToast('Return processed successfully', 'success');
          }}
          userId={user?.id || ''}
          outletId={selectedReference.outlet_id}
          inventoryItemId={returnAllocation.inventory_item_id}
          itemName={returnAllocation.item_name || ''}
          referenceType={referenceType as ReferenceType}
          referenceId={selectedReference.id}
          outstandingQuantity={returnAllocation.outstanding_quantity || 0}
        />
      )}
    </div>
  );
}
