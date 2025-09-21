// ============================================================================
// OUTLET SERVICE (Using Locations Table)
// ============================================================================

import { Outlet, OutletFormData } from '@/types';
import { supabase } from '@/lib/supabase';
import { CodeGeneratorService } from './codeGeneratorService';

class OutletService {
  /**
   * Get all outlets (locations)
   */
  static async getAllOutlets(): Promise<Outlet[]> {
    try {
      console.log('Fetching outlets from locations table...');
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching outlets:', error);
        throw error;
      }

      console.log('Raw locations data:', data);
      console.log('Number of locations found:', data?.length || 0);

      const mappedOutlets = data.map((location: any) => ({
        id: location.id,
        code: location.location_code,
        name: location.name,
        address: {
          street: location.address,
          city: location.city,
          state: location.state,
          pincode: location.pincode,
          country: 'India' // Default country
        },
        contact_person: location.manager_id ? 'Manager' : 'N/A',
        contact_phone: location.phone || '',
        contact_email: location.email || '',
        manager_id: location.manager_id,
        is_active: location.is_active,
        created_at: location.created_at,
        updated_at: location.updated_at
      }));

      console.log('Mapped outlets:', mappedOutlets);
      return mappedOutlets;
    } catch (error) {
      console.error('Error fetching outlets:', error);
      throw error;
    }
  }

  /**
   * Get outlet by ID
   */
  static async getOutletById(id: string): Promise<Outlet | null> {
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
      console.error('Error fetching outlet:', error);
      throw error;
    }
  }

  /**
   * Create new outlet (location)
   */
  static async createOutlet(outletData: OutletFormData): Promise<Outlet> {
    try {
      // Generate location code automatically
      const locationCode = await CodeGeneratorService.generateCode('location');

      const insertData = {
        location_code: locationCode,
        name: outletData.name,
        address: outletData.street,
        city: outletData.city,
        state: outletData.state,
        pincode: outletData.pincode,
        phone: outletData.contact_phone,
        email: outletData.contact_email,
        gstin: outletData.gstin,
        manager_id: outletData.manager_id || null,
        is_active: true,
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
      console.error('Error creating outlet:', error);
      throw error;
    }
  }

  /**
   * Update outlet
   */
  static async updateOutlet(id: string, updates: Partial<OutletFormData>): Promise<Outlet> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.name) updateData.name = updates.name;
      if (updates.street) updateData.address = updates.street;
      if (updates.city) updateData.city = updates.city;
      if (updates.state) updateData.state = updates.state;
      if (updates.pincode) updateData.pincode = updates.pincode;
      if (updates.contact_phone) updateData.phone = updates.contact_phone;
      if (updates.contact_email) updateData.email = updates.contact_email;
      if (updates.gstin) updateData.gstin = updates.gstin;
      if (updates.manager_id !== undefined) updateData.manager_id = updates.manager_id;

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
      console.error('Error updating outlet:', error);
      throw error;
    }
  }

  /**
   * Delete outlet
   */
  static async deleteOutlet(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting outlet:', error);
      throw error;
    }
  }

  /**
   * Get outlet statistics
   */
  static async getOutletStats(outletId: string): Promise<{
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
        .eq('primary_location_id', outletId);

      // Get orders count for this location
      const { count: ordersCount } = await supabase
        .from('rental_orders')
        .select('*', { count: 'exact', head: true })
        .eq('location_id', outletId);

      // Get total revenue for this location
      const { data: revenueData } = await supabase
        .from('invoices')
        .select('total_amount')
        .eq('location_id', outletId)
        .eq('payment_status', 'paid');

      const totalRevenue = revenueData?.reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0) || 0;

      // Get active inventory count for this location
      const { count: inventoryCount } = await supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
        .eq('location_id', outletId)
        .gt('available_quantity', 0);

      return {
        totalCustomers: customersCount || 0,
        totalOrders: ordersCount || 0,
        totalRevenue,
        activeInventory: inventoryCount || 0
      };
    } catch (error) {
      console.error('Error fetching outlet stats:', error);
      throw error;
    }
  }

  /**
   * Get outlets by manager ID
   */
  static async getOutletsByManager(managerId: string): Promise<Outlet[]> {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('manager_id', managerId)
        .eq('is_active', true)
        .order('name');

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
        contact_person: 'Manager',
        contact_phone: location.phone || '',
        contact_email: location.email || '',
        manager_id: location.manager_id,
        is_active: location.is_active,
        created_at: location.created_at,
        updated_at: location.updated_at
      }));
    } catch (error) {
      console.error('Error fetching outlets by manager:', error);
      throw error;
    }
  }
}

export default OutletService;