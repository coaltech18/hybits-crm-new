// ============================================================================
// ORDER SERVICE
// ============================================================================

import { supabase } from '@/lib/supabase';
import { CodeGeneratorService } from './codeGeneratorService';

export interface OrderFormData {
  customer_id: string;
  event_date: string;
  event_type: 'wedding' | 'corporate' | 'birthday' | 'anniversary' | 'other';
  event_duration: number;
  guest_count: number;
  location_type: 'indoor' | 'outdoor' | 'both';
  items: OrderItemFormData[];
  status: 'draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
}

export interface OrderItemFormData {
  item_id: string;
  quantity: number;
  rate: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name?: string;
  event_date: string;
  event_type: string;
  event_duration: number;
  guest_count: number;
  location_type: string;
  status: string;
  total_amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  items: OrderItemFormData[];
}

export class OrderService {
  /**
   * Create a new order
   */
  static async createOrder(orderData: OrderFormData): Promise<Order> {
    try {
      // Generate order number automatically
      const orderNumber = await CodeGeneratorService.generateCode('order');

      const insertData = {
        order_number: orderNumber,
        customer_id: orderData.customer_id,
        event_date: orderData.event_date,
        event_type: orderData.event_type,
        event_duration: orderData.event_duration,
        guest_count: orderData.guest_count,
        location_type: orderData.location_type,
        status: orderData.status,
        total_amount: orderData.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0),
        notes: orderData.notes || null,
        created_by: (await supabase.auth.getUser()).data.user?.id
      };

      const { data, error } = await supabase
        .from('rental_orders')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating order:', error);
        throw new Error(error.message);
      }

      // Create order items
      if (orderData.items.length > 0) {
        const orderItems = orderData.items.map(item => ({
          order_id: data.id,
          item_id: item.item_id,
          quantity: item.quantity,
          rate: item.rate,
          total_amount: item.quantity * item.rate
        }));

        const { error: itemsError } = await supabase
          .from('rental_order_items')
          .insert(orderItems);

        if (itemsError) {
          console.error('Error creating order items:', itemsError);
          throw new Error(itemsError.message);
        }
      }

      return {
        ...data,
        items: orderData.items
      };
    } catch (error: any) {
      console.error('Error in createOrder:', error);
      throw new Error(error.message || 'Failed to create order');
    }
  }

  /**
   * Get all orders
   */
  static async getOrders(): Promise<Order[]> {
    try {
      const { data, error } = await supabase
        .from('rental_orders')
        .select(`
          *,
          customers(contact_person),
          rental_order_items(
            *,
            inventory_items(name, item_code)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
        throw new Error(error.message);
      }

      return (data || []).map((order: any) => ({
        id: order.id,
        order_number: order.order_number,
        customer_id: order.customer_id,
        customer_name: order.customers?.contact_person,
        event_date: order.event_date,
        event_type: order.event_type,
        event_duration: order.event_duration,
        guest_count: order.guest_count,
        location_type: order.location_type,
        status: order.status,
        total_amount: order.total_amount,
        notes: order.notes,
        created_at: order.created_at,
        updated_at: order.updated_at,
        items: order.rental_order_items || []
      }));
    } catch (error: any) {
      console.error('Error in getOrders:', error);
      throw new Error(error.message || 'Failed to fetch orders');
    }
  }

  /**
   * Get a single order by ID
   */
  static async getOrder(id: string): Promise<Order> {
    try {
      const { data, error } = await supabase
        .from('rental_orders')
        .select(`
          *,
          customers(contact_person),
          rental_order_items(
            *,
            inventory_items(name, item_code)
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching order:', error);
        throw new Error(error.message);
      }

      return {
        id: data.id,
        order_number: data.order_number,
        customer_id: data.customer_id,
        customer_name: data.customers?.contact_person,
        event_date: data.event_date,
        event_type: data.event_type,
        event_duration: data.event_duration,
        guest_count: data.guest_count,
        location_type: data.location_type,
        status: data.status,
        total_amount: data.total_amount,
        notes: data.notes,
        created_at: data.created_at,
        updated_at: data.updated_at,
        items: data.rental_order_items || []
      };
    } catch (error: any) {
      console.error('Error in getOrder:', error);
      throw new Error(error.message || 'Failed to fetch order');
    }
  }
}
