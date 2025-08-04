import { supabase } from '../lib/supabase';

export class InventoryService {
  static async getInventoryItems(filters = {}) {
    try {
      let query = supabase?.from('inventory_items')?.select('*')?.order('created_at', { ascending: false });

      // Apply filters
      if (filters?.category && filters?.category !== 'all') {
        query = query?.eq('category', filters?.category);
      }

      if (filters?.location && filters?.location !== 'all') {
        query = query?.ilike('location', `%${filters?.location}%`);
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

  static async getInventoryItem(id) {
    try {
      const { data, error } = await supabase?.from('inventory_items')?.select('*')?.eq('id', id)?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error loading inventory item:', error);
      throw error;
    }
  }

  static async createInventoryItem(itemData) {
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

  static async updateInventoryItem(id, updates) {
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

  static async updateStockQuantities(id, quantities) {
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

  static async deleteInventoryItem(id) {
    try {
      const { error } = await supabase?.from('inventory_items')?.delete()?.eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      throw error;
    }
  }

  static async getCategories() {
    try {
      const { data, error } = await supabase?.from('inventory_items')?.select('category')?.order('category');

      if (error) throw error;

      // Get unique categories and count items
      const categoryData = {};
      data?.forEach(item => {
        const category = item?.category;
        categoryData[category] = (categoryData?.[category] || 0) + 1;
      });

      const categories = [
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

  static async getStockAlerts() {
    try {
      const { data, error } = await supabase?.from('inventory_items')?.select('*')?.or('available_quantity.lte.reorder_point,available_quantity.eq.0');

      if (error) throw error;

      return data?.map(item => ({
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

  static async createStockMovement(itemId, movementData) {
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

  static async getStockMovements(itemId) {
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