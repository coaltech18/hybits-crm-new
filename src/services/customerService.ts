// ============================================================================
// CUSTOMER SERVICE
// ============================================================================

import { supabase } from '@/lib/supabase';
import { Customer, CustomerFormData } from '@/types';
import { CodeGeneratorService } from './codeGeneratorService';

export class CustomerService {
  /**
   * Get all customers with optional filters
   */
  static async getCustomers(): Promise<Customer[]> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching customers:', error);
        throw new Error(error.message);
      }

      // Map database fields to our interface
      return (data || []).map((customer: any) => ({
        id: customer.id,
        code: customer.customer_code || customer.code,
        name: customer.contact_person || customer.name,
        email: customer.email,
        phone: customer.phone,
        company: customer.company_name || customer.company,
        address: {
          street: customer.address || customer.street || '',
          city: customer.city || '',
          state: customer.state || '',
          pincode: customer.pincode || '',
          country: customer.country || 'India'
        },
        gstin: customer.gstin || '',
        status: customer.is_active ? 'active' : 'inactive',
        created_at: customer.created_at,
        updated_at: customer.updated_at
      }));
    } catch (error: any) {
      console.error('Error in getCustomers:', error);
      throw new Error(error.message || 'Failed to fetch customers');
    }
  }

  /**
   * Get a single customer by ID
   */
  static async getCustomer(id: string): Promise<Customer> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching customer:', error);
        throw new Error(error.message);
      }

      // Map database fields to our interface
      return {
        id: data.id,
        code: data.customer_code || data.code,
        name: data.contact_person || data.name,
        email: data.email,
        phone: data.phone,
        company: data.company_name || data.company,
        address: {
          street: data.address || data.street || '',
          city: data.city || '',
          state: data.state || '',
          pincode: data.pincode || '',
          country: data.country || 'India'
        },
        gstin: data.gstin || '',
        status: data.is_active ? 'active' : 'inactive',
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    } catch (error: any) {
      console.error('Error in getCustomer:', error);
      throw new Error(error.message || 'Failed to fetch customer');
    }
  }

  /**
   * Create a new customer
   */
  static async createCustomer(customerData: CustomerFormData): Promise<Customer> {
    try {
      // Generate customer code automatically
      const customerCode = await CodeGeneratorService.generateCode('customer');

      // Map form data to database fields
      const insertData = {
        customer_code: customerCode,
        contact_person: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        company_name: customerData.company || null,
        address: customerData.address.street,
        city: customerData.address.city,
        state: customerData.address.state,
        pincode: customerData.address.pincode,
        country: customerData.address.country,
        gstin: customerData.gstin || null,
        customer_type: 'individual', // Default type
        is_active: customerData.status === 'active',
        created_by: (await supabase.auth.getUser()).data.user?.id
      };

      const { data, error } = await supabase
        .from('customers')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating customer:', error);
        throw new Error(error.message);
      }

      // Map response to our interface
      return {
        id: data.id,
        code: data.customer_code,
        name: data.contact_person,
        email: data.email,
        phone: data.phone,
        company: data.company_name,
        address: {
          street: data.address || '',
          city: data.city || '',
          state: data.state || '',
          pincode: data.pincode || '',
          country: data.country || 'India'
        },
        gstin: data.gstin || '',
        status: data.is_active ? 'active' : 'inactive',
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    } catch (error: any) {
      console.error('Error in createCustomer:', error);
      throw new Error(error.message || 'Failed to create customer');
    }
  }

  /**
   * Update an existing customer
   */
  static async updateCustomer(id: string, customerData: Partial<CustomerFormData>): Promise<Customer> {
    try {
      const updateData: any = {};

      if (customerData.name) updateData.contact_person = customerData.name;
      if (customerData.email) updateData.email = customerData.email;
      if (customerData.phone) updateData.phone = customerData.phone;
      if (customerData.company !== undefined) updateData.company_name = customerData.company;
      if (customerData.address?.street) updateData.address = customerData.address.street;
      if (customerData.address?.city) updateData.city = customerData.address.city;
      if (customerData.address?.state) updateData.state = customerData.address.state;
      if (customerData.address?.pincode) updateData.pincode = customerData.address.pincode;
      if (customerData.address?.country) updateData.country = customerData.address.country;
      if (customerData.gstin !== undefined) updateData.gstin = customerData.gstin;
      if (customerData.status) updateData.is_active = customerData.status === 'active';

      const { data, error } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating customer:', error);
        throw new Error(error.message);
      }

      // Map response to our interface
      return {
        id: data.id,
        code: data.customer_code,
        name: data.contact_person,
        email: data.email,
        phone: data.phone,
        company: data.company_name,
        address: {
          street: data.address || '',
          city: data.city || '',
          state: data.state || '',
          pincode: data.pincode || '',
          country: data.country || 'India'
        },
        gstin: data.gstin || '',
        status: data.is_active ? 'active' : 'inactive',
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    } catch (error: any) {
      console.error('Error in updateCustomer:', error);
      throw new Error(error.message || 'Failed to update customer');
    }
  }

  /**
   * Delete a customer (soft delete by setting is_active to false)
   */
  static async deleteCustomer(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ is_active: false })
        .eq('id', id);

      if (error) {
        console.error('Error deleting customer:', error);
        throw new Error(error.message);
      }
    } catch (error: any) {
      console.error('Error in deleteCustomer:', error);
      throw new Error(error.message || 'Failed to delete customer');
    }
  }

}
