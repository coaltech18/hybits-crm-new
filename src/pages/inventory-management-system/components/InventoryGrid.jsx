import React, { useState, useMemo } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const InventoryGrid = ({ 
  items, 
  selectedItems, 
  onItemSelect, 
  onSelectAll, 
  onStockUpdate, 
  onItemEdit,
  sortConfig,
  onSort 
}) => {
  const [editingItem, setEditingItem] = useState(null);
  const [editValues, setEditValues] = useState({});

  const getConditionColor = (condition) => {
    switch (condition) {
      case 'new': return 'text-success bg-success/10';
      case 'good': return 'text-primary bg-primary/10';
      case 'damaged': return 'text-error bg-error/10';
      case 'maintenance': return 'text-warning bg-warning/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getStockLevelIndicator = (current, reorderPoint) => {
    if (current === 0) return { color: 'text-error', icon: 'XCircle' };
    if (current <= reorderPoint * 0.5) return { color: 'text-error', icon: 'AlertTriangle' };
    if (current <= reorderPoint) return { color: 'text-warning', icon: 'AlertCircle' };
    return { color: 'text-success', icon: 'CheckCircle' };
  };

  const handleEditStart = (item) => {
    setEditingItem(item?.id);
    setEditValues({
      currentStock: item?.currentStock,
      reorderPoint: item?.reorderPoint,
      condition: item?.condition
    });
  };

  const handleEditSave = (itemId) => {
    onStockUpdate(itemId, editValues);
    setEditingItem(null);
    setEditValues({});
  };

  const handleEditCancel = () => {
    setEditingItem(null);
    setEditValues({});
  };

  const getSortIcon = (column) => {
    if (sortConfig?.key !== column) return 'ArrowUpDown';
    return sortConfig?.direction === 'asc' ? 'ArrowUp' : 'ArrowDown';
  };

  const formatDate = (date) => {
    return new Date(date)?.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="flex-1 overflow-hidden">
      <div className="h-full overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-muted border-b border-border z-10">
            <tr>
              <th className="w-12 p-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedItems?.length === items?.length && items?.length > 0}
                  onChange={onSelectAll}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                />
              </th>
              {[
                { key: 'itemCode', label: 'Item Code', width: 'w-32' },
                { key: 'description', label: 'Description', width: 'w-64' },
                { key: 'category', label: 'Category', width: 'w-32' },
                { key: 'currentStock', label: 'Current Stock', width: 'w-28' },
                { key: 'reserved', label: 'Reserved', width: 'w-24' },
                { key: 'available', label: 'Available', width: 'w-24' },
                { key: 'condition', label: 'Condition', width: 'w-28' },
                { key: 'location', label: 'Location', width: 'w-32' },
                { key: 'reorderPoint', label: 'Reorder Point', width: 'w-28' },
                { key: 'lastMovement', label: 'Last Movement', width: 'w-32' },
                { key: 'actions', label: 'Actions', width: 'w-32' }
              ]?.map((column) => (
                <th key={column?.key} className={`${column?.width} p-3 text-left`}>
                  {column?.key !== 'actions' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSort(column?.key)}
                      className="h-auto p-0 font-medium text-foreground hover:text-primary"
                      iconName={getSortIcon(column?.key)}
                      iconPosition="right"
                    >
                      {column?.label}
                    </Button>
                  ) : (
                    <span className="font-medium text-foreground">{column?.label}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items?.map((item) => {
              const stockIndicator = getStockLevelIndicator(item?.currentStock, item?.reorderPoint);
              const isEditing = editingItem === item?.id;
              
              return (
                <tr 
                  key={item?.id} 
                  className="border-b border-border hover:bg-muted/50 transition-colors"
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedItems?.includes(item?.id)}
                      onChange={() => onItemSelect(item?.id)}
                      className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm font-medium text-foreground">{item?.itemCode}</span>
                      <Icon 
                        name={stockIndicator?.icon} 
                        size={14} 
                        className={stockIndicator?.color}
                      />
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                        <Icon name={item?.icon} size={16} className="text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{item?.name}</p>
                        <p className="text-xs text-muted-foreground">{item?.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="text-sm text-muted-foreground">{item?.category}</span>
                  </td>
                  <td className="p-3">
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editValues?.currentStock}
                        onChange={(e) => setEditValues(prev => ({ ...prev, currentStock: parseInt(e?.target?.value) || 0 }))}
                        className="w-20 h-8 text-sm"
                      />
                    ) : (
                      <span className="font-medium text-foreground">{item?.currentStock}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="text-sm text-warning">{item?.reserved}</span>
                  </td>
                  <td className="p-3">
                    <span className="text-sm font-medium text-success">{item?.available}</span>
                  </td>
                  <td className="p-3">
                    {isEditing ? (
                      <select
                        value={editValues?.condition}
                        onChange={(e) => setEditValues(prev => ({ ...prev, condition: e?.target?.value }))}
                        className="text-xs px-2 py-1 rounded border border-border bg-surface"
                      >
                        <option value="new">New</option>
                        <option value="good">Good</option>
                        <option value="damaged">Damaged</option>
                        <option value="maintenance">Maintenance</option>
                      </select>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded font-medium ${getConditionColor(item?.condition)}`}>
                        {item?.condition?.charAt(0)?.toUpperCase() + item?.condition?.slice(1)}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="text-sm text-muted-foreground">{item?.location}</span>
                  </td>
                  <td className="p-3">
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editValues?.reorderPoint}
                        onChange={(e) => setEditValues(prev => ({ ...prev, reorderPoint: parseInt(e?.target?.value) || 0 }))}
                        className="w-20 h-8 text-sm"
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">{item?.reorderPoint}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="text-sm text-muted-foreground">{formatDate(item?.lastMovement)}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center space-x-1">
                      {isEditing ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditSave(item?.id)}
                            className="h-8 w-8"
                          >
                            <Icon name="Check" size={14} className="text-success" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleEditCancel}
                            className="h-8 w-8"
                          >
                            <Icon name="X" size={14} className="text-error" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditStart(item)}
                            className="h-8 w-8"
                          >
                            <Icon name="Edit3" size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onItemEdit(item)}
                            className="h-8 w-8"
                          >
                            <Icon name="Eye" size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryGrid;