import { supabase } from '../lib/supabase';

export class LocationService {
  // Get all locations accessible to the current user
  static async getUserLocations() {
    try {
      // Use direct query instead of RPC function since it doesn't exist
      const { data, error } = await supabase
        .from('locations')
        .select(`
          id,
          location_code,
          name,
          city,
          state,
          location_users!inner(role)
        `)
        .eq('is_active', true);

      if (error) throw error;
      
      return data?.map(location => ({
        id: location.id,
        code: location.location_code,
        name: location.name,
        city: location.city,
        state: location.state,
        access_level: location.location_users?.[0]?.role || 'viewer'
      })) || [];
    } catch (error) {
      console.error('Error loading user locations:', error);
      // Return empty array as fallback to prevent app crashes
      return [];
    }
  }

  // Get all locations (admin only)
  static async getAllLocations() {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading all locations:', error);
      throw error;
    }
  }

  // Get location by ID
  static async getLocationById(id) {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error loading location:', error);
      throw error;
    }
  }

  // Create new location (admin/manager only)
  static async createLocation(locationData) {
    try {
      const { data, error } = await supabase
        .from('locations')
        .insert([{
          location_code: locationData.location_code,
          name: locationData.name,
          address: locationData.address,
          city: locationData.city,
          state: locationData.state,
          pincode: locationData.pincode,
          phone: locationData.phone,
          email: locationData.email,
          manager_id: locationData.manager_id
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating location:', error);
      throw error;
    }
  }

  // Update location (admin/manager only)
  static async updateLocation(id, updates) {
    try {
      const { data, error } = await supabase
        .from('locations')
        .update({
          ...updates,
          updated_at: new Date()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating location:', error);
      throw error;
    }
  }

  // Deactivate location (admin only)
  static async deactivateLocation(id) {
    try {
      const { data, error } = await supabase
        .from('locations')
        .update({
          is_active: false,
          updated_at: new Date()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error deactivating location:', error);
      throw error;
    }
  }

  // Get user location access
  static async getUserLocationAccess(userId) {
    try {
      const { data, error } = await supabase
        .from('location_users')
        .select(`
          *,
          locations (
            id,
            location_code,
            name,
            city,
            state
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading user location access:', error);
      throw error;
    }
  }

  // Grant location access to user (admin only)
  static async grantLocationAccess(userId, locationId, role, grantedBy) {
    try {
      const { data, error } = await supabase
        .from('location_users')
        .upsert([{
          user_id: userId,
          location_id: locationId,
          role: role,
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error granting location access:', error);
      throw error;
    }
  }

  // Revoke location access from user (admin only)
  static async revokeLocationAccess(userId, locationId) {
    try {
      const { data, error } = await supabase
        .from('location_users')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('location_id', locationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error revoking location access:', error);
      throw error;
    }
  }

  // Get location statistics
  static async getLocationStats(locationId) {
    try {
      const [inventoryCount, ordersCount, customersCount] = await Promise.all([
        supabase
          .from('inventory_items')
          .select('id', { count: 'exact' })
          .eq('location_id', locationId),
        
        supabase
          .from('rental_orders')
          .select('id', { count: 'exact' })
          .eq('location_id', locationId),
        
        supabase
          .from('customers')
          .select('id', { count: 'exact' })
          .eq('location_id', locationId)
      ]);

      return {
        inventory_items: inventoryCount.count || 0,
        rental_orders: ordersCount.count || 0,
        customers: customersCount.count || 0
      };
    } catch (error) {
      console.error('Error loading location stats:', error);
      throw error;
    }
  }

  // Transfer inventory between locations
  static async transferInventory(itemIds, fromLocationId, toLocationId, transferredBy) {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .update({
          location_id: toLocationId,
          updated_at: new Date()
        })
        .in('id', itemIds)
        .select();

      if (error) throw error;

      // Log the transfer in stock movements
      const stockMovements = itemIds.map(itemId => ({
        item_id: itemId,
        movement_type: 'transfer',
        quantity: 0, // Transfer doesn't change quantity
        reference_type: 'location_transfer',
        reference_id: toLocationId,
        notes: `Transferred from location ${fromLocationId} to ${toLocationId}`,
        created_by: transferredBy
      }));

      await supabase
        .from('stock_movements')
        .insert(stockMovements);

      return data;
    } catch (error) {
      console.error('Error transferring inventory:', error);
      throw error;
    }
  }
}
