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
      return (data || []).map((customer: any) => {
        // Parse the address string into components
        const addressParts = (customer.address || '').split(', ');
        return {
          id: customer.id,
          code: customer.customer_code || customer.code,
          name: customer.contact_person || customer.name,
          email: customer.email,
          phone: customer.phone,
          company: customer.company_name || customer.company,
          address: {
            street: addressParts[0] || '',
            city: addressParts[1] || '',
            state: addressParts[2] || '',
            pincode: addressParts[3] || '',
            country: addressParts[4] || 'India'
          },
          gstin: customer.gstin || '',
          status: customer.is_active ? 'active' : 'inactive',
          created_at: customer.created_at,
          updated_at: customer.updated_at
        };
      });
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
        .maybeSingle();

      if (error) {
        console.error('DB error fetching customers:', error);
        throw new Error('Database error');
      }

      if (!data) {
        console.warn('customers row not found for filter id:', id);
        throw new Error('Customer not found');
      }

      // Map database fields to our interface
      // Parse the address string into components
      const addressParts = (data.address || '').split(', ');
      return {
        id: data.id,
        code: data.customer_code || data.code,
        name: data.contact_person || data.name,
        email: data.email,
        phone: data.phone,
        company: data.company_name || data.company,
        address: {
          street: addressParts[0] || '',
          city: addressParts[1] || '',
          state: addressParts[2] || '',
          pincode: addressParts[3] || '',
          country: addressParts[4] || 'India'
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
      // Combine address fields into a single address string
      const fullAddress = [
        customerData.address.street,
        customerData.address.city,
        customerData.address.state,
        customerData.address.pincode,
        customerData.address.country
      ].filter(Boolean).join(', ');

      const insertData = {
        customer_code: customerCode,
        contact_person: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        company_name: customerData.company || null,
        address: fullAddress,
        gstin: customerData.gstin || null,
        customer_type: 'individual', // Default type
        is_active: customerData.status === 'active',
        created_by: (await supabase.auth.getUser()).data.user?.id
      };

      const { data, error } = await supabase
        .from('customers')
        .insert(insertData)
        .select()
        .maybeSingle();

      if (error) {
        console.error('DB error fetching customers:', error);
        throw new Error('Database error');
      }

      if (!data) {
        console.warn('customers row not found after insert');
        throw new Error('Failed to create customer');
      }

      // Map response to our interface
      // Parse the address string back into components (for display purposes)
      const addressParts = (data.address || '').split(', ');
      return {
        id: data.id,
        code: data.customer_code,
        name: data.contact_person,
        email: data.email,
        phone: data.phone,
        company: data.company_name,
        address: {
          street: addressParts[0] || '',
          city: addressParts[1] || '',
          state: addressParts[2] || '',
          pincode: addressParts[3] || '',
          country: addressParts[4] || 'India'
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
      if (customerData.address) {
        // Combine address fields into a single address string
        const fullAddress = [
          customerData.address.street,
          customerData.address.city,
          customerData.address.state,
          customerData.address.pincode,
          customerData.address.country
        ].filter(Boolean).join(', ');
        updateData.address = fullAddress;
      }
      if (customerData.gstin !== undefined) updateData.gstin = customerData.gstin;
      if (customerData.status) updateData.is_active = customerData.status === 'active';

      const { data, error } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        console.error('DB error fetching customers:', error);
        throw new Error('Database error');
      }

      if (!data) {
        console.warn('customers row not found for filter id:', id);
        throw new Error('Customer not found');
      }

      // Map response to our interface
      // Parse the address string back into components (for display purposes)
      const addressParts = (data.address || '').split(', ');
      return {
        id: data.id,
        code: data.customer_code,
        name: data.contact_person,
        email: data.email,
        phone: data.phone,
        company: data.company_name,
        address: {
          street: addressParts[0] || '',
          city: addressParts[1] || '',
          state: addressParts[2] || '',
          pincode: addressParts[3] || '',
          country: addressParts[4] || 'India'
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
