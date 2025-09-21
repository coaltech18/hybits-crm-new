// ============================================================================
// INVENTORY SERVICE
// ============================================================================

import { supabase } from '@/lib/supabase';
import { InventoryItem, InventoryItemFormData } from '@/types';
import { CodeGeneratorService } from './codeGeneratorService';

class InventoryService {
  /**
   * Get all inventory items
   */
  async getInventoryItems(): Promise<InventoryItem[]> {
    try {
      console.log('Fetching inventory items from database...');
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching inventory items:', error);
        throw new Error(error.message);
      }

      console.log('Raw data from database:', data);
      console.log('Number of items found:', data?.length || 0);

      // Map database fields to interface fields
      const mappedItems = (data || []).map((item: any) => ({
        ...item,
        code: item.item_code,
        unit_price: item.rental_price_per_day || item.unit_cost || 0,
        location_id: item.location || 'main-warehouse',
        condition: item.condition || 'good',
        last_movement: item.updated_at
      }));

      console.log('Mapped items:', mappedItems);
      return mappedItems;
    } catch (error: any) {
      console.error('Error in getInventoryItems:', error);
      throw new Error(error.message || 'Failed to fetch inventory items');
    }
  }

  /**
   * Get inventory item by ID
   */
  async getInventoryItem(id: string): Promise<InventoryItem | null> {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching inventory item:', error);
        throw new Error(error.message);
      }

      if (!data) return null;

      // Map database fields to interface fields
      return {
        ...data,
        code: data.item_code,
        unit_price: data.rental_price_per_day || data.unit_cost || 0,
        location_id: data.location || 'main-warehouse',
        condition: data.condition || 'good',
        last_movement: data.updated_at
      };
    } catch (error: any) {
      console.error('Error in getInventoryItem:', error);
      throw new Error(error.message || 'Failed to fetch inventory item');
    }
  }

  /**
   * Create new inventory item
   */
  async createInventoryItem(itemData: InventoryItemFormData): Promise<InventoryItem> {
    try {
      console.log('Creating inventory item with data:', itemData);
      
      // Generate item code automatically
      const itemCode = await CodeGeneratorService.generateCode('inventory_item');
      console.log('Generated item code:', itemCode);

      // Only insert fields that exist in the database schema
      const insertData: any = {
        item_code: itemCode,
        name: itemData.name,
        description: itemData.description,
        category: itemData.category,
        location: itemData.location_id, // Map location_id to location
        condition: itemData.condition,
        total_quantity: itemData.total_quantity,
        available_quantity: itemData.available_quantity || itemData.total_quantity,
        reserved_quantity: 0,
        reorder_point: itemData.reorder_point,
        rental_price_per_day: itemData.unit_price,
        unit_cost: itemData.unit_price,
      };

      // Add image fields if they exist in the database (from our migration)
      if (itemData.image_url) {
        insertData.image_url = itemData.image_url;
      }
      if (itemData.thumbnail_url) {
        insertData.thumbnail_url = itemData.thumbnail_url;
      }
      if (itemData.image_alt_text) {
        insertData.image_alt_text = itemData.image_alt_text;
      }

      console.log('Insert data prepared:', insertData);

      const { data, error } = await supabase
        .from('inventory_items')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating inventory item:', error);
        throw new Error(error.message);
      }

      console.log('Item created successfully:', data);

      // Map the response to match our interface
      const mappedItem = {
        ...data,
        code: data.item_code,
        unit_price: data.rental_price_per_day || data.unit_cost || 0,
        location_id: data.location || 'main-warehouse',
        condition: data.condition || 'good',
        last_movement: data.updated_at
      };

      console.log('Mapped item for return:', mappedItem);
      return mappedItem;
    } catch (error: any) {
      console.error('Error in createInventoryItem:', error);
      throw new Error(error.message || 'Failed to create inventory item');
    }
  }

  /**
   * Update inventory item
   */
  async updateInventoryItem(id: string, itemData: Partial<InventoryItemFormData>): Promise<InventoryItem> {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .update({
          ...itemData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating inventory item:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error: any) {
      console.error('Error in updateInventoryItem:', error);
      throw new Error(error.message || 'Failed to update inventory item');
    }
  }

  /**
   * Delete inventory item
   */
  async deleteInventoryItem(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting inventory item:', error);
        throw new Error(error.message);
      }
    } catch (error: any) {
      console.error('Error in deleteInventoryItem:', error);
      throw new Error(error.message || 'Failed to delete inventory item');
    }
  }


  /**
   * Update stock quantities
   */
  async updateStock(itemId: string, quantity: number, type: 'add' | 'remove' | 'set'): Promise<void> {
    try {
      const item = await this.getInventoryItem(itemId);
      if (!item) {
        throw new Error('Item not found');
      }

      let newQuantity = item.total_quantity;
      switch (type) {
        case 'add':
          newQuantity += quantity;
          break;
        case 'remove':
          newQuantity = Math.max(0, newQuantity - quantity);
          break;
        case 'set':
          newQuantity = quantity;
          break;
      }

      await this.updateInventoryItem(itemId, {
        total_quantity: newQuantity,
        available_quantity: newQuantity - item.reserved_quantity,
      });
    } catch (error: any) {
      console.error('Error in updateStock:', error);
      throw new Error(error.message || 'Failed to update stock');
    }
  }
}

export default new InventoryService();
