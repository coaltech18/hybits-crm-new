// ============================================================================
// ORDER SERVICE
// ============================================================================

import { supabase } from '@/lib/supabase';
import { CodeGeneratorService } from './codeGeneratorService';
import { Order, OrderStatus } from '@/types';

export interface OrderFormData {
  customer_id: string;
  event_date: string;
  event_type: 'wedding' | 'corporate' | 'birthday' | 'anniversary' | 'other';
  event_duration: number;
  guest_count: number;
  location_type: 'indoor' | 'outdoor' | 'both';
  items: OrderItemFormData[];
  status: 'pending' | 'confirmed' | 'items_dispatched' | 'items_returned' | 'completed' | 'cancelled';
  notes?: string;
}

export interface OrderItemFormData {
  item_id: string;
  quantity: number;
  rate: number;
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
        delivery_date: orderData.event_date, // Use event_date as delivery_date for now
        return_date: orderData.event_date, // Use event_date as return_date for now
        delivery_address: 'TBD', // TODO: Get from customer or form
        total_amount: orderData.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0),
        security_deposit: 0,
        gst_amount: 0,
        status: orderData.status,
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
        id: data.id,
        order_number: data.order_number,
        customer_id: data.customer_id,
        customer_name: '', // Will be populated when fetching with joins
        event_date: data.event_date,
        event_type: data.event_type || 'other', // Default value if column doesn't exist
        event_duration: data.event_duration || 0, // Default value if column doesn't exist
        guest_count: data.guest_count || 0, // Default value if column doesn't exist
        location_type: data.location_type || 'indoor', // Default value if column doesn't exist
        status: data.status,
        payment_status: data.payment_status || 'pending',
        total_amount: data.total_amount || 0,
        notes: data.notes,
        created_at: data.created_at,
        updated_at: data.updated_at,
        items: orderData.items.map((item, index) => ({
          id: `temp-${index}`,
          item_id: item.item_id,
          item_name: 'Unknown Item', // Will be populated when fetching with joins
          quantity: item.quantity,
          rate: item.rate,
          amount: item.quantity * item.rate
        }))
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
        customer_name: order.customers?.contact_person || '',
        event_date: order.event_date,
        event_type: order.event_type || 'other', // Default value if column doesn't exist
        event_duration: order.event_duration || 0, // Default value if column doesn't exist
        guest_count: order.guest_count || 0, // Default value if column doesn't exist
        location_type: order.location_type || 'indoor', // Default value if column doesn't exist
        status: order.status,
        payment_status: order.payment_status || 'pending',
        total_amount: order.total_amount || 0,
        notes: order.notes,
        created_at: order.created_at,
        updated_at: order.updated_at,
        items: (order.rental_order_items || []).map((item: any) => ({
          id: item.id,
          item_id: item.item_id,
          item_name: item.inventory_items?.name || 'Unknown Item',
          quantity: item.quantity,
          rate: item.rate,
          amount: item.quantity * item.rate
        }))
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
        customer_name: data.customers?.contact_person || '',
        event_date: data.event_date,
        event_type: data.event_type || 'other', // Default value if column doesn't exist
        event_duration: data.event_duration || 0, // Default value if column doesn't exist
        guest_count: data.guest_count || 0, // Default value if column doesn't exist
        location_type: data.location_type || 'indoor', // Default value if column doesn't exist
        status: data.status,
        payment_status: data.payment_status || 'pending',
        total_amount: data.total_amount || 0,
        notes: data.notes,
        created_at: data.created_at,
        updated_at: data.updated_at,
        items: (data.rental_order_items || []).map((item: any) => ({
          id: item.id,
          item_id: item.item_id,
          item_name: item.inventory_items?.name || 'Unknown Item',
          quantity: item.quantity,
          rate: item.rate,
          amount: item.quantity * item.rate
        }))
      };
    } catch (error: any) {
      console.error('Error in getOrder:', error);
      throw new Error(error.message || 'Failed to fetch order');
    }
  }

  /**
   * Update order status
   */
  static async updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    try {
      console.log(`Updating order ${id} status to ${status}`);
      
      const { data, error } = await supabase
        .from('rental_orders')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(`
          *,
          customers:customer_id (
            contact_person,
            email,
            phone
          ),
          rental_order_items (
            *,
            inventory_items:item_id (
              name,
              rental_price_per_day
            )
          )
        `)
        .single();

      if (error) {
        console.error('Error updating order status:', error);
        throw new Error(error.message);
      }

      return {
        id: data.id,
        order_number: data.order_number,
        customer_id: data.customer_id,
        customer_name: data.customers?.contact_person || '',
        event_date: data.event_date,
        event_type: data.event_type || 'other',
        event_duration: data.event_duration || 0,
        guest_count: data.guest_count || 0,
        location_type: data.location_type || 'indoor',
        status: data.status,
        payment_status: data.payment_status || 'pending',
        total_amount: data.total_amount || 0,
        notes: data.notes,
        created_at: data.created_at,
        updated_at: data.updated_at,
        items: (data.rental_order_items || []).map((item: any) => ({
          id: item.id,
          item_id: item.item_id,
          item_name: item.inventory_items?.name || 'Unknown Item',
          quantity: item.quantity,
          rate: item.rate,
          amount: item.quantity * item.rate
        }))
      };
    } catch (error: any) {
      console.error('Error in updateOrderStatus:', error);
      throw new Error(error.message || 'Failed to update order status');
    }
  }

  /**
   * Add items to an order
   */
  static async addOrderItems(orderId: string, items: OrderItemFormData[]): Promise<void> {
    try {
      console.log(`Adding ${items.length} items to order ${orderId}`);
      
      const orderItems = items.map(item => ({
        order_id: orderId,
        item_id: item.item_id,
        quantity: item.quantity,
        rate: item.rate,
        rental_days: 1, // Default to 1 day, can be calculated based on event duration
        total_price: item.quantity * item.rate
      }));

      const { error } = await supabase
        .from('rental_order_items')
        .insert(orderItems);

      if (error) {
        console.error('Error adding order items:', error);
        throw new Error(error.message);
      }

      // Update total amount
      const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
      await supabase
        .from('rental_orders')
        .update({ 
          total_amount: totalAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

    } catch (error: any) {
      console.error('Error in addOrderItems:', error);
      throw new Error(error.message || 'Failed to add order items');
    }
  }
}
