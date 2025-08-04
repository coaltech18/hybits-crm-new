import { supabase } from '../lib/supabase';

export class CustomerService {
  static async getCustomers(filters = {}) {
    try {
      let query = supabase?.from('customers')?.select('*')?.eq('is_active', true)?.order('created_at', { ascending: false });

      // Apply filters
      if (filters?.customerType && filters?.customerType !== 'all') {
        query = query?.eq('customer_type', filters?.customerType);
      }

      if (filters?.search) {
        query = query?.or(`company_name.ilike.%${filters?.search}%,contact_person.ilike.%${filters?.search}%,phone.ilike.%${filters?.search}%,email.ilike.%${filters?.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading customers:', error);
      throw error;
    }
  }

  static async getCustomer(id) {
    try {
      const { data, error } = await supabase?.from('customers')?.select('*')?.eq('id', id)?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error loading customer:', error);
      throw error;
    }
  }

  static async createCustomer(customerData) {
    try {
      // Generate customer code
      const timestamp = Date.now()?.toString()?.slice(-6);
      const customerCode = `CUST-${timestamp}`;

      const { data, error } = await supabase?.from('customers')?.insert([{
          ...customerData,
          customer_code: customerCode,
          created_by: (await supabase?.auth?.getUser())?.data?.user?.id
        }])?.select()?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  }

  static async updateCustomer(id, updates) {
    try {
      const { data, error } = await supabase?.from('customers')?.update({
          ...updates,
          updated_at: new Date()
        })?.eq('id', id)?.select()?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  }

  static async deleteCustomer(id) {
    try {
      const { error } = await supabase?.from('customers')?.update({ is_active: false })?.eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  }

  static async getCustomerOrders(customerId) {
    try {
      const { data, error } = await supabase?.from('rental_orders')?.select(`
          *,
          rental_order_items(
            *,
            inventory_items(name, item_code)
          )
        `)?.eq('customer_id', customerId)?.order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading customer orders:', error);
      throw error;
    }
  }

  static async getCustomerInvoices(customerId) {
    try {
      const { data, error } = await supabase?.from('invoices')?.select('*')?.eq('customer_id', customerId)?.order('invoice_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading customer invoices:', error);
      throw error;
    }
  }

  static async updateCustomerBalance(customerId, amount, operation = 'add') {
    try {
      const customer = await this.getCustomer(customerId);
      const currentBalance = customer?.outstanding_balance || 0;
      const newBalance = operation === 'add' 
        ? currentBalance + amount 
        : Math.max(0, currentBalance - amount);

      const { data, error } = await supabase?.from('customers')?.update({ 
          outstanding_balance: newBalance,
          updated_at: new Date()
        })?.eq('id', customerId)?.select()?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating customer balance:', error);
      throw error;
    }
  }
}