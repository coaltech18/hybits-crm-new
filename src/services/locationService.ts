// ============================================================================
// LOCATION SERVICE
// ============================================================================

import { Location } from '@/types';
import { supabase } from '@/lib/supabase';
import { CodeGeneratorService } from './codeGeneratorService';

export interface LocationFormData {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone?: string;
  email?: string;
  gstin?: string;
  manager_id?: string;
  is_active?: boolean;
}

class LocationService {
  /**
   * Get all locations
   */
  static async getLocations(): Promise<Location[]> {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map((location: any) => ({
        id: location.id,
        code: location.location_code,
        name: location.name,
        address: {
          street: location.address,
          city: location.city,
          state: location.state,
          pincode: location.pincode,
          country: 'India'
        },
        contact_person: location.manager_id ? 'Manager' : 'N/A',
        contact_phone: location.phone || '',
        contact_email: location.email || '',
        manager_id: location.manager_id,
        is_active: location.is_active,
        created_at: location.created_at,
        updated_at: location.updated_at
      }));
    } catch (error) {
      console.error('Error fetching locations:', error);
      throw error;
    }
  }

  /**
   * Get location by ID
   */
  static async getLocationById(id: string): Promise<Location | null> {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw error;
      }

      return {
        id: data.id,
        code: data.location_code,
        name: data.name,
        address: {
          street: data.address,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          country: 'India'
        },
        contact_person: data.manager_id ? 'Manager' : 'N/A',
        contact_phone: data.phone || '',
        contact_email: data.email || '',
        manager_id: data.manager_id,
        is_active: data.is_active,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    } catch (error) {
      console.error('Error fetching location:', error);
      throw error;
    }
  }

  /**
   * Create new location
   */
  static async createLocation(locationData: LocationFormData): Promise<Location> {
    try {
      // Generate location code automatically
      const locationCode = await CodeGeneratorService.generateCode('location');

      const insertData = {
        location_code: locationCode,
        name: locationData.name,
        address: locationData.address,
        city: locationData.city,
        state: locationData.state,
        pincode: locationData.pincode,
        phone: locationData.phone,
        email: locationData.email,
        gstin: locationData.gstin,
        manager_id: locationData.manager_id || null,
        is_active: locationData.is_active ?? true,
        settings: {}
      };

      const { data, error } = await supabase
        .from('locations')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        code: data.location_code,
        name: data.name,
        address: {
          street: data.address,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          country: 'India'
        },
        contact_person: data.manager_id ? 'Manager' : 'N/A',
        contact_phone: data.phone || '',
        contact_email: data.email || '',
        manager_id: data.manager_id,
        is_active: data.is_active,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    } catch (error) {
      console.error('Error creating location:', error);
      throw error;
    }
  }

  /**
   * Update location
   */
  static async updateLocation(id: string, updates: Partial<LocationFormData>): Promise<Location> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.name) updateData.name = updates.name;
      if (updates.address) updateData.address = updates.address;
      if (updates.city) updateData.city = updates.city;
      if (updates.state) updateData.state = updates.state;
      if (updates.pincode) updateData.pincode = updates.pincode;
      if (updates.phone) updateData.phone = updates.phone;
      if (updates.email) updateData.email = updates.email;
      if (updates.gstin) updateData.gstin = updates.gstin;
      if (updates.manager_id !== undefined) updateData.manager_id = updates.manager_id;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

      const { data, error } = await supabase
        .from('locations')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        code: data.location_code,
        name: data.name,
        address: {
          street: data.address,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          country: 'India'
        },
        contact_person: data.manager_id ? 'Manager' : 'N/A',
        contact_phone: data.phone || '',
        contact_email: data.email || '',
        manager_id: data.manager_id,
        is_active: data.is_active,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    } catch (error) {
      console.error('Error updating location:', error);
      throw error;
    }
  }

  /**
   * Delete location
   */
  static async deleteLocation(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting location:', error);
      throw error;
    }
  }

  /**
   * Get location statistics
   */
  static async getLocationStats(locationId: string): Promise<{
    totalCustomers: number;
    totalOrders: number;
    totalRevenue: number;
    activeInventory: number;
  }> {
    try {
      // Get customers count for this location
      const { count: customersCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('primary_location_id', locationId);

      // Get orders count for this location
      const { count: ordersCount } = await supabase
        .from('rental_orders')
        .select('*', { count: 'exact', head: true })
        .eq('location_id', locationId);

      // Get total revenue for this location
      const { data: revenueData } = await supabase
        .from('invoices')
        .select('total_amount')
        .eq('location_id', locationId)
        .eq('payment_status', 'paid');

      const totalRevenue = revenueData?.reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0) || 0;

      // Get active inventory count for this location
      const { count: inventoryCount } = await supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .gt('available_quantity', 0);

      return {
        totalCustomers: customersCount || 0,
        totalOrders: ordersCount || 0,
        totalRevenue,
        activeInventory: inventoryCount || 0
      };
    } catch (error) {
      console.error('Error fetching location stats:', error);
      throw error;
    }
  }
}

export default LocationService;
