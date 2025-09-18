import { supabase } from '../lib/supabase';

interface InventoryFilters {
  category?: string;
  location_id?: string;
  condition?: string;
  search?: string;
}

interface Location {
  id: string;
  location_code: string;
  name: string;
  city: string;
  state: string;
}

interface InventoryItem {
  id: string;
  item_code: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  brand?: string;
  model?: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  total_quantity: number;
  available_quantity: number;
  reserved_quantity: number;
  reorder_point: number;
  max_stock: number;
  location_id: string;
  condition: string;
  supplier?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  locations?: Location;
}

interface ItemData {
  item_code?: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  brand?: string;
  model?: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  total_quantity: number;
  reorder_point: number;
  max_stock: number;
  location_id: string;
  condition: string;
  supplier?: string;
}

interface StockQuantities {
  total_quantity: number;
  reserved_quantity?: number;
}

interface Category {
  id: string;
  name: string;
  itemCount: number;
  stockLevel: string;
}

interface StockAlert {
  id: string;
  type: string;
  priority: string;
  itemCode: string;
  itemName: string;
  message: string;
  currentStock: number;
  reorderPoint: number;
  location: string;
  createdAt: string;
}

interface StockMovement {
  id: string;
  item_id: string;
  movement_type: string;
  quantity: number;
  reason?: string;
  reference_id?: string;
  created_at: string;
  created_by?: string;
  created_by_profile?: {
    full_name: string;
  };
}

interface MovementData {
  movement_type: string;
  quantity: number;
  reason?: string;
  reference_id?: string;
}

export class InventoryService {
  static async getInventoryItems(filters: InventoryFilters = {}): Promise<InventoryItem[]> {
    try {
      let query = supabase
        ?.from('inventory_items')
        ?.select(`
          *,
          locations (
            id,
            location_code,
            name,
            city,
            state
          )
        `)
        ?.order('created_at', { ascending: false });

      // Apply filters
      if (filters?.category && filters?.category !== 'all') {
        query = query?.eq('category', filters?.category);
      }

      if (filters?.location_id && filters?.location_id !== 'all') {
        query = query?.eq('location_id', filters?.location_id);
      }

      if (filters?.condition && filters?.condition !== 'all') {
        query = query?.eq('condition', filters?.condition);
      }

      if (filters?.search) {
        query = query?.or(`name.ilike.%${filters?.search}%,item_code.ilike.%${filters?.search}%,description.ilike.%${filters?.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading inventory items:', error);
      throw error;
    }
  }

  static async getInventoryItem(id: string): Promise<InventoryItem> {
    try {
      const { data, error } = await supabase?.from('inventory_items')?.select('*')?.eq('id', id)?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error loading inventory item:', error);
      throw error;
    }
  }

  static async createInventoryItem(itemData: ItemData): Promise<InventoryItem> {
    try {
      const { data, error } = await supabase?.from('inventory_items')?.insert([{
          ...itemData,
          available_quantity: itemData?.total_quantity || 0,
          created_by: (await supabase?.auth?.getUser())?.data?.user?.id
        }])?.select()?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating inventory item:', error);
      throw error;
    }
  }

  static async updateInventoryItem(id: string, updates: Partial<ItemData>): Promise<InventoryItem> {
    try {
      const { data, error } = await supabase?.from('inventory_items')?.update({
          ...updates,
          updated_at: new Date()
        })?.eq('id', id)?.select()?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating inventory item:', error);
      throw error;
    }
  }

  static async updateStockQuantities(id: string, quantities: StockQuantities): Promise<InventoryItem> {
    try {
      const availableQuantity = quantities?.total_quantity - (quantities?.reserved_quantity || 0);
      
      const { data, error } = await supabase?.from('inventory_items')?.update({
          total_quantity: quantities?.total_quantity,
          reserved_quantity: quantities?.reserved_quantity || 0,
          available_quantity: availableQuantity,
          updated_at: new Date()
        })?.eq('id', id)?.select()?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating stock quantities:', error);
      throw error;
    }
  }

  static async deleteInventoryItem(id: string): Promise<void> {
    try {
      const { error } = await supabase?.from('inventory_items')?.delete()?.eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      throw error;
    }
  }

  static async getCategories(): Promise<Category[]> {
    try {
      const { data, error } = await supabase?.from('inventory_items')?.select('category')?.order('category');

      if (error) throw error;

      // Get unique categories and count items
      const categoryData: {[key: string]: number} = {};
      data?.forEach((item: any) => {
        const category = item?.category;
        categoryData[category] = (categoryData?.[category] || 0) + 1;
      });

      const categories: Category[] = [
        { id: 'all', name: 'All Items', itemCount: data?.length || 0, stockLevel: 'good' }
      ];

      Object.entries(categoryData)?.forEach(([category, count]) => {
        categories?.push({
          id: category,
          name: category?.charAt(0)?.toUpperCase() + category?.slice(1),
          itemCount: count,
          stockLevel: 'good' // This would need more complex logic in real implementation
        });
      });

      return categories;
    } catch (error) {
      console.error('Error loading categories:', error);
      throw error;
    }
  }

  static async getStockAlerts(): Promise<StockAlert[]> {
    try {
      const { data, error } = await supabase?.from('inventory_items')?.select('*')?.or('available_quantity.lte.reorder_point,available_quantity.eq.0');

      if (error) throw error;

      return data?.map((item: any) => ({
        id: `ALERT-${item?.id}`,
        type: item?.available_quantity === 0 ? 'critical' : 'low',
        priority: item?.available_quantity === 0 ? 'high' : 'medium',
        itemCode: item?.item_code,
        itemName: item?.name,
        message: item?.available_quantity === 0 
          ? 'Item is completely out of stock'
          : 'Stock level below reorder point',
        currentStock: item?.available_quantity,
        reorderPoint: item?.reorder_point,
        location: item?.location,
        createdAt: new Date()?.toISOString()
      })) || [];
    } catch (error) {
      console.error('Error loading stock alerts:', error);
      throw error;
    }
  }

  static async createStockMovement(itemId: string, movementData: MovementData): Promise<StockMovement> {
    try {
      const { data, error } = await supabase?.from('stock_movements')?.insert([{
          item_id: itemId,
          ...movementData,
          created_by: (await supabase?.auth?.getUser())?.data?.user?.id
        }])?.select()?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating stock movement:', error);
      throw error;
    }
  }

  static async getStockMovements(itemId: string): Promise<StockMovement[]> {
    try {
      const { data, error } = await supabase?.from('stock_movements')?.select(`
          *,
          created_by_profile:user_profiles!created_by(full_name)
        `)?.eq('item_id', itemId)?.order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading stock movements:', error);
      throw error;
    }
  }
}
