// ============================================================================
// ITEMS TABLE COMPONENT
// ============================================================================

import React from 'react';
import { SubscriptionItem } from '@/types/billing';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Icon from '@/components/AppIcon';

interface ItemsTableProps {
  items: SubscriptionItem[];
  onItemsChange: (items: SubscriptionItem[]) => void;
  onTotalChange: (total: number) => void;
}

const ItemsTable: React.FC<ItemsTableProps> = ({
  items,
  onItemsChange,
  onTotalChange
}) => {
  const addItem = () => {
    const newItem: SubscriptionItem = {
      id: `item_${Date.now()}`,
      name: '',
      size: '',
      price_per_piece: 0,
      quantity: 0,
      total: 0
    };
    
    const updatedItems = [...items, newItem];
    onItemsChange(updatedItems);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return; // Keep at least one item
    
    const updatedItems = items.filter(item => item.id !== id);
    onItemsChange(updatedItems);
  };

  const updateItem = (id: string, field: keyof Omit<SubscriptionItem, 'id' | 'total'>, value: string | number) => {
    const updatedItems = items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // Recalculate total when price or quantity changes
        if (field === 'price_per_piece' || field === 'quantity') {
          updatedItem.total = updatedItem.price_per_piece * updatedItem.quantity;
        }
        
        return updatedItem;
      }
      return item;
    });
    
    onItemsChange(updatedItems);
    
    // Calculate and update total
    const total = updatedItems.reduce((sum, item) => sum + item.total, 0);
    onTotalChange(total);
  };

  const totalDishValue = items.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Items</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
        >
          <Icon name="plus" size={16} className="mr-2" />
          Add Item
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Item
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Size
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Price per piece
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                      placeholder="e.g., SS Idly Plate"
                      className="w-full"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      value={item.size}
                      onChange={(e) => updateItem(item.id, 'size', e.target.value)}
                      placeholder="e.g., 6.5"
                      className="w-full"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      value={item.price_per_piece}
                      onChange={(e) => updateItem(item.id, 'price_per_piece', Number(e.target.value))}
                      placeholder="0"
                      min={0}
                      step={0.01}
                      className="w-full"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                      placeholder="0"
                      min={0}
                      className="w-full"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-foreground">
                      ₹{item.total.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      disabled={items.length <= 1}
                    >
                      <Icon name="trash" size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/50">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right font-semibold text-foreground">
                  Total Dish Value:
                </td>
                <td className="px-4 py-3 font-bold text-foreground">
                  ₹{totalDishValue.toLocaleString()}
                </td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {items.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Icon name="package" size={48} className="mx-auto mb-4" />
          <p>No items added yet. Click "Add Item" to get started.</p>
        </div>
      )}
    </div>
  );
};

export default ItemsTable;
