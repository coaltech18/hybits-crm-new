// ============================================================================
// INVENTORY SERVICE
// ============================================================================

import { supabase } from '@/lib/supabase';
import { InventoryItem, InventoryItemFormData } from '@/types';
import { getSignedUrl } from './imageService';

class InventoryService {
  /**
   * Get all inventory items (with outlet filtering for non-admin users)
   */
  async getInventoryItems(options?: { 
    outletId?: string; 
    userRole?: 'admin' | 'manager' | 'accountant';
    includeSharedItems?: boolean;
  }): Promise<InventoryItem[]> {
    try {
      console.log('Fetching inventory items from database...', 'Options:', options);
      let query = supabase
        .from('inventory_items')
        .select('*');

      // Filter by outlet_id if provided
      if (options?.outletId) {
        // Only admins with explicit flag can see NULL outlet_id items (shared items)
        if (options.userRole === 'admin' && options.includeSharedItems) {
          query = query.or(`outlet_id.eq.${options.outletId},outlet_id.is.null`);
        } else {
          // Managers and admins without flag: strict outlet filtering (no NULL items)
          query = query.eq('outlet_id', options.outletId);
        }
      }
      // If no outletId provided (admin/accountant), show all items including NULL outlet_id

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error in query:', error);
        throw new Error(error.message);
      }
      
      const itemsData = data;

      console.log('Raw data from database:', itemsData);
      console.log('Number of items found:', itemsData?.length || 0);

      // Map database fields to interface fields - use new schema
      // Also convert storage paths to signed URLs for images
      const mappedItems = await Promise.all((itemsData || []).map(async (item: any) => {
        // Convert image_url from storage path to signed URL if it's a storage path
        let imageUrl = item.image_url || null;
        let thumbnailUrl = item.thumbnail_url || null;
        
        // Log raw database values for debugging
        console.log(`[${item.item_code || item.id}] Raw DB values - image_url:`, imageUrl, 'thumbnail_url:', thumbnailUrl);
        
        // Helper function to check if URL needs conversion
        const needsConversion = (url: string | null): boolean => {
          if (!url || url.trim() === '') {
            console.log(`  → URL is empty/null, skipping conversion`);
            return false;
          }
          // If it's already a full URL (http/https) or a public asset path, don't convert
          if (url.startsWith('http://') || url.startsWith('https://')) {
            console.log(`  → URL is already a full URL, skipping conversion`);
            return false;
          }
          if (url.startsWith('/assets/') || url.startsWith('/public/')) {
            console.log(`  → URL is a public asset, skipping conversion`);
            return false;
          }
          // If it's a storage path (contains slashes but not starting with http), convert it
          console.log(`  → URL needs conversion (storage path)`);
          return true;
        };
        
        // Convert image_url from storage path to signed URL
        if (needsConversion(imageUrl)) {
          try {
            // Log what's stored in database
            console.log(`[${item.item_code || item.id}] Database image_url:`, imageUrl);
            
            // Remove leading slash if present
            let cleanPath = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
            
            // Handle old format paths: inventory/default/filename -> try to find actual path
            const signedResult = await getSignedUrl(cleanPath, 3600 * 24); // 24 hour expiry
            
            if (signedResult.url) {
              imageUrl = signedResult.url;
              console.log(`✓ [${item.item_code || item.id}] Converted image URL:`, cleanPath, '->', signedResult.url.substring(0, 50) + '...');
            } else {
              const errorMsg = signedResult.error?.message || 'Unknown error';
              const errorStatus = signedResult.error?.statusCode || signedResult.error?.status;
              console.warn(`✗ [${item.item_code || item.id}] Failed to get signed URL for image:`, cleanPath);
              console.warn('  Error:', errorMsg, 'Status:', errorStatus);
              console.warn('  Full error:', signedResult.error);
              
              // If it's a 400/404 error, the file likely doesn't exist at that path
              if (errorStatus === 400 || errorStatus === 404) {
                console.warn('  → File not found in storage. Path may be incorrect or file was deleted.');
                console.warn('  → Check Supabase Storage to verify the file exists and update the database path if needed.');
              }
              
              imageUrl = null; // Set to null so fallback image shows
            }
          } catch (err: any) {
            console.warn(`✗ [${item.item_code || item.id}] Error getting signed URL for image:`, imageUrl, 'Error:', err?.message || err);
            imageUrl = null; // Set to null so fallback image shows
          }
        }
        
        // Convert thumbnail_url if it exists and is a storage path
        if (needsConversion(thumbnailUrl)) {
          try {
            // Remove leading slash if present
            let cleanPath = thumbnailUrl.startsWith('/') ? thumbnailUrl.substring(1) : thumbnailUrl;
            const signedResult = await getSignedUrl(cleanPath, 3600 * 24); // 24 hour expiry
            
            if (signedResult.url) {
              thumbnailUrl = signedResult.url;
              console.log('✓ Converted thumbnail URL:', cleanPath, '->', signedResult.url.substring(0, 50) + '...');
            } else {
              const errorMsg = signedResult.error?.message || 'Unknown error';
              console.warn('✗ Failed to get signed URL for thumbnail:', cleanPath, 'Error:', errorMsg);
              thumbnailUrl = imageUrl; // Fallback to main image
            }
          } catch (err: any) {
            console.warn('✗ Error getting signed URL for thumbnail:', thumbnailUrl, 'Error:', err?.message || err);
            thumbnailUrl = imageUrl; // Fallback to main image
          }
        }

        return {
          ...item,
          code: item.item_code, // Auto-generated by trigger
          unit_price: item.unit_price || 0,
          location_id: item.outlet_id || 'main-warehouse',
          condition: item.condition || 'excellent',
          last_movement: item.updated_at,
          image_url: imageUrl || undefined,
          thumbnail_url: thumbnailUrl || imageUrl || undefined
        };
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
        .maybeSingle();

      if (error) {
        console.error('DB error fetching inventory_items:', error);
        throw new Error('Database error');
      }

      if (!data) {
        console.warn('inventory_items row not found for filter id:', id);
        return null;
      }

      // Convert image_url from storage path to signed URL if it's a storage path
      let imageUrl = data.image_url || null;
      let thumbnailUrl = data.thumbnail_url || null;
      
      // Helper function to check if URL needs conversion
      const needsConversion = (url: string | null): boolean => {
        if (!url || url.trim() === '') return false;
        // If it's already a full URL (http/https) or a public asset path, don't convert
        if (url.startsWith('http://') || url.startsWith('https://')) return false;
        if (url.startsWith('/assets/') || url.startsWith('/public/')) return false;
        // If it's a storage path (contains slashes but not starting with http), convert it
        return true;
      };
      
      // Convert image_url from storage path to signed URL
      if (needsConversion(imageUrl)) {
        try {
          // Remove leading slash if present
          const cleanPath = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
          const signedResult = await getSignedUrl(cleanPath, 3600 * 24); // 24 hour expiry
          if (signedResult.url) {
            imageUrl = signedResult.url;
            console.log('Converted image URL:', cleanPath, '->', signedResult.url);
          } else {
            console.warn('Failed to get signed URL for image:', cleanPath, signedResult.error);
            imageUrl = null; // Set to null so fallback image shows
          }
        } catch (err) {
          console.warn('Error getting signed URL for image:', imageUrl, err);
          imageUrl = null; // Set to null so fallback image shows
        }
      }
      
      // Convert thumbnail_url if it exists and is a storage path
      if (needsConversion(thumbnailUrl)) {
        try {
          // Remove leading slash if present
          const cleanPath = thumbnailUrl.startsWith('/') ? thumbnailUrl.substring(1) : thumbnailUrl;
          const signedResult = await getSignedUrl(cleanPath, 3600 * 24); // 24 hour expiry
          if (signedResult.url) {
            thumbnailUrl = signedResult.url;
            console.log('Converted thumbnail URL:', cleanPath, '->', signedResult.url);
          } else {
            console.warn('Failed to get signed URL for thumbnail:', cleanPath, signedResult.error);
            thumbnailUrl = imageUrl; // Fallback to main image
          }
        } catch (err) {
          console.warn('Error getting signed URL for thumbnail:', thumbnailUrl, err);
          thumbnailUrl = imageUrl; // Fallback to main image
        }
      }

      // Map database fields to interface fields - use new schema
      return {
        ...data,
        code: data.item_code, // Auto-generated by trigger
        unit_price: data.unit_price || 0,
        location_id: data.outlet_id || 'main-warehouse',
        condition: data.condition || 'excellent',
        last_movement: data.updated_at,
        image_url: imageUrl || undefined,
        thumbnail_url: thumbnailUrl || imageUrl || undefined
      };
    } catch (error: any) {
      console.error('Error in getInventoryItem:', error);
      throw new Error(error.message || 'Failed to fetch inventory item');
    }
  }

  /**
   * Create new inventory item
   */
  async createInventoryItem(itemData: InventoryItemFormData & { outlet_id?: string }): Promise<InventoryItem> {
    try {
      console.log('Creating inventory item with data:', itemData);
      
      // Item code will be auto-generated by database trigger (ITEM-OUTCODE-001)
      
      // Get current user for outlet_id
      const { data: { user } } = await supabase.auth.getUser();
      const outletId = itemData.outlet_id || (user?.user_metadata?.outlet_id);

      // Only insert fields that exist in the database schema
      const insertData: any = {
        // item_code will be auto-generated by trigger
        name: itemData.name,
        description: itemData.description,
        category: itemData.category,
        condition: itemData.condition || 'excellent',
        total_quantity: itemData.total_quantity,
        available_quantity: itemData.available_quantity || itemData.total_quantity,
        reserved_quantity: 0,
        unit_price: itemData.unit_price,
        gst_rate: (itemData as any).gst_rate || 0,
        hsn_code: (itemData as any).hsn_code,
        reorder_point: itemData.reorder_point || 0,
      };

      // Add outlet_id if provided
      if (outletId) {
        insertData.outlet_id = outletId;
      }

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
        .maybeSingle();

      if (error) {
        console.error('DB error fetching inventory_items:', error);
        throw new Error('Database error');
      }

      if (!data) {
        console.warn('inventory_items row not found after insert');
        throw new Error('Failed to create inventory item');
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
        .maybeSingle();

      if (error) {
        console.error('DB error fetching inventory_items:', error);
        throw new Error('Database error');
      }

      if (!data) {
        console.warn('inventory_items row not found for filter id:', id);
        throw new Error('Inventory item not found');
      }

      return data;
    } catch (error: any) {
      console.error('Error in updateInventoryItem:', error);
      throw new Error(error.message || 'Failed to update inventory item');
    }
  }

  /**
   * Delete inventory item
   * Checks if item is referenced in orders before deleting
   */
  async deleteInventoryItem(id: string): Promise<void> {
    try {
      // First, check if this item is referenced in any orders
      const { data: orderItems, error: checkError } = await supabase
        .from('rental_order_items')
        .select('id')
        .eq('item_id', id)
        .limit(1);

      if (checkError) {
        console.error('Error checking item references:', checkError);
        throw new Error(checkError.message);
      }

      if (orderItems && orderItems.length > 0) {
        throw new Error('Cannot delete item: It is currently used in rental orders. Please remove it from all orders first.');
      }

      // If not referenced, proceed with deletion
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
