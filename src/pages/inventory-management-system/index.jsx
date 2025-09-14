import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { InventoryService } from '../../services/inventoryService';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Breadcrumb from '../../components/ui/Breadcrumb';
import CategorySidebar from './components/CategorySidebar';
import InventoryHeader from './components/InventoryHeader';
import InventoryGrid from './components/InventoryGrid';
import StockAlertPanel from './components/StockAlertPanel';
import BulkActionModal from './components/BulkActionModal';

const InventoryManagementSystem = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, loading: authLoading, sidebarCollapsed, toggleSidebar } = useAuth();
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [bulkActionModal, setBulkActionModal] = useState({ isOpen: false, actionType: null });
  const [sortConfig, setSortConfig] = useState({ key: 'item_code', direction: 'asc' });
  const [filters, setFilters] = useState({
    condition: 'all',
    availability: 'all',
    stockLevel: 'all'
  });

  // State for Supabase data
  const [inventoryItems, setInventoryItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stockAlerts, setStockAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load data on component mount
  useEffect(() => {
    if (!authLoading && userProfile) {
      loadInventoryData();
      loadCategories();
      loadStockAlerts();
    }
    
    // Check for success message from item creation
    if (location.state?.message) {
      // You could show a toast notification here
      console.log(location.state.message);
    }
    
    // Add new item if created
    if (location.state?.newItem) {
      setInventoryItems(prev => [location.state.newItem, ...prev]);
    }
  }, [authLoading, userProfile, location.state]);

  const loadInventoryData = async () => {
    try {
      setLoading(true);
      const data = await InventoryService?.getInventoryItems();
      setInventoryItems(data);
    } catch (err) {
      setError('Failed to load inventory items');
      console.error('Error loading inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await InventoryService?.getCategories();
      setCategories(data);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const loadStockAlerts = async () => {
    try {
      const data = await InventoryService?.getStockAlerts();
      setStockAlerts(data);
    } catch (err) {
      console.error('Error loading stock alerts:', err);
    }
  };

  // Filter and sort inventory items
  const filteredItems = useMemo(() => {
    let filtered = inventoryItems?.filter(item => {
      // Location filter
      if (selectedLocation !== 'all' && !item?.location?.toLowerCase()?.includes(selectedLocation?.replace('warehouse-', '')?.replace('-', ' '))) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && item?.category?.toLowerCase() !== selectedCategory?.toLowerCase()) {
        return false;
      }

      // Search filter
      if (searchQuery && !item?.name?.toLowerCase()?.includes(searchQuery?.toLowerCase()) && 
          !item?.item_code?.toLowerCase()?.includes(searchQuery?.toLowerCase()) &&
          !item?.description?.toLowerCase()?.includes(searchQuery?.toLowerCase())) {
        return false;
      }

      // Condition filter
      if (filters?.condition !== 'all' && item?.condition !== filters?.condition) {
        return false;
      }

      // Availability filter
      if (filters?.availability !== 'all') {
        if (filters?.availability === 'available' && item?.available_quantity === 0) return false;
        if (filters?.availability === 'reserved' && item?.reserved_quantity === 0) return false;
        if (filters?.availability === 'out-of-stock' && item?.total_quantity > 0) return false;
      }

      // Stock level filter
      if (filters?.stockLevel !== 'all') {
        const ratio = item?.available_quantity / item?.reorder_point;
        if (filters?.stockLevel === 'critical' && item?.available_quantity > 0) return false;
        if (filters?.stockLevel === 'low' && (item?.available_quantity === 0 || ratio > 1)) return false;
        if (filters?.stockLevel === 'good' && ratio <= 1) return false;
      }

      return true;
    });

    // Sort items
    filtered?.sort((a, b) => {
      let aValue = a?.[sortConfig?.key];
      let bValue = b?.[sortConfig?.key];

      if (typeof aValue === 'string') {
        aValue = aValue?.toLowerCase();
        bValue = bValue?.toLowerCase();
      }

      if (sortConfig?.direction === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [inventoryItems, selectedLocation, selectedCategory, searchQuery, filters, sortConfig]);

  const handleItemSelect = (itemId) => {
    setSelectedItems(prev => 
      prev?.includes(itemId) 
        ? prev?.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems?.length === filteredItems?.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems?.map(item => item?.id));
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev?.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleFilterChange = (filterType, value) => {
    if (filterType === 'clear') {
      setFilters({
        condition: 'all',
        availability: 'all',
        stockLevel: 'all'
      });
      setSelectedCategory('all');
      setSearchQuery('');
    } else {
      setFilters(prev => ({ ...prev, [filterType]: value }));
    }
  };

  const handleBulkAction = (actionType) => {
    if (selectedItems?.length === 0) {
      alert('Please select items first');
      return;
    }
    setBulkActionModal({ isOpen: true, actionType });
  };

  const handleAddItem = () => {
    navigate('/inventory-item-creation');
  };

  const handleEditItem = (item) => {
    navigate('/inventory-item-creation', { state: { item } });
  };

  const handleBulkActionExecute = async (actionType, items, formData) => {
    try {
      console.log('Executing bulk action:', actionType, items, formData);
      // Implement bulk action logic here
      setSelectedItems([]);
      await loadInventoryData(); // Refresh data
    } catch (err) {
      console.error('Error executing bulk action:', err);
    }
  };

  const handleStockUpdate = async (itemId, updates) => {
    try {
      await InventoryService?.updateStockQuantities(itemId, updates);
      await loadInventoryData(); // Refresh data
      await loadStockAlerts(); // Refresh alerts
    } catch (err) {
      console.error('Error updating stock:', err);
    }
  };

  const handleAlertAction = (alertId, action) => {
    console.log('Alert action:', alertId, action);
    // Implement alert action logic
  };

  const handleDismissAlert = (alertId) => {
    console.log('Dismissing alert:', alertId);
    // Implement alert dismissal logic
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading inventory system...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <button 
            onClick={loadInventoryData}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={userProfile} />
      <Sidebar 
        isCollapsed={sidebarCollapsed} 
        onToggle={toggleSidebar}
        user={userProfile}
      />
      <main className={`transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-70'
      } pt-16`}>
        <div className="h-screen flex flex-col">
          <InventoryHeader
            selectedLocation={selectedLocation}
            onLocationChange={setSelectedLocation}
            stockAlerts={stockAlerts?.length}
            onBulkAction={handleBulkAction}
            onAddItem={handleAddItem}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onBarcodeScan={() => console.log('Barcode scan initiated')}
          />

          <div className="flex-1 flex overflow-hidden">
            <CategorySidebar
              categories={categories}
              selectedCategory={selectedCategory}
              onCategorySelect={setSelectedCategory}
              filters={filters}
              onFilterChange={handleFilterChange}
            />

            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-border">
                <Breadcrumb />
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <h2 className="text-lg font-semibold text-foreground">
                      Inventory Items ({filteredItems?.length})
                    </h2>
                    {selectedItems?.length > 0 && (
                      <span className="text-sm text-primary font-medium">
                        {selectedItems?.length} selected
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowAlerts(!showAlerts)}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        showAlerts 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {showAlerts ? 'Hide' : 'Show'} Alerts ({stockAlerts?.length})
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 overflow-hidden">
                  <InventoryGrid
                    items={filteredItems}
                    selectedItems={selectedItems}
                    onItemSelect={handleItemSelect}
                    onSelectAll={handleSelectAll}
                    onStockUpdate={handleStockUpdate}
                    onItemEdit={(item) => console.log('Edit item:', item)}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                </div>

                {showAlerts && (
                  <div className="w-96 border-l border-border p-4 overflow-y-auto">
                    <StockAlertPanel
                      alerts={stockAlerts}
                      onAlertAction={handleAlertAction}
                      onDismissAlert={handleDismissAlert}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <BulkActionModal
        isOpen={bulkActionModal?.isOpen}
        onClose={() => setBulkActionModal({ isOpen: false, actionType: null })}
        actionType={bulkActionModal?.actionType}
        selectedItems={selectedItems}
        onExecute={handleBulkActionExecute}
      />
    </div>
  );
};

export default InventoryManagementSystem;