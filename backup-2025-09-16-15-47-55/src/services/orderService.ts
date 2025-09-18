import { supabase } from '../lib/supabase';

interface OrderFilters {
  status?: string;
  paymentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

interface OrderItem {
  id: string;
  order_id: string;
  item_id: string;
  quantity: number;
  rental_days: number;
  unit_price: number;
  total_price: number;
  inventory_items?: {
    name: string;
    item_code: string;
    category: string;
  };
}

interface Customer {
  id: string;
  company_name?: string;
  contact_person: string;
  phone: string;
  email: string;
}

interface RentalOrder {
  id: string;
  order_number: string;
  customer_id: string;
  event_date: string;
  delivery_date?: string;
  return_date?: string;
  delivery_address?: string;
  total_amount: number;
  security_deposit?: number;
  gst_amount: number;
  status: string;
  payment_status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  customers?: Customer;
  rental_order_items?: OrderItem[];
  created_by_profile?: {
    full_name: string;
  };
}

interface OrderData {
  customer_id: string;
  event_date: string;
  delivery_date?: string;
  return_date?: string;
  delivery_address?: string;
  security_deposit?: number;
  notes?: string;
  items: {
    item_id: string;
    quantity: number;
    rental_days: number;
    unit_price: number;
    total_price: number;
  }[];
}

interface OrderStatistics {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  totalRevenue: number;
  pendingPayments: number;
}

export class OrderService {
  static async getRentalOrders(filters: OrderFilters = {}): Promise<RentalOrder[]> {
    try {
      let query = supabase?.from('rental_orders')?.select(`
          *,
          customers(company_name, contact_person, phone),
          rental_order_items(
            *,
            inventory_items(name, item_code, category)
          ),
          created_by_profile:user_profiles!created_by(full_name)
        `)?.order('created_at', { ascending: false });

      // Apply filters
      if (filters?.status && filters?.status !== 'all') {
        query = query?.eq('status', filters?.status);
      }

      if (filters?.paymentStatus && filters?.paymentStatus !== 'all') {
        query = query?.eq('payment_status', filters?.paymentStatus);
      }

      if (filters?.dateFrom) {
        query = query?.gte('event_date', filters?.dateFrom);
      }

      if (filters?.dateTo) {
        query = query?.lte('event_date', filters?.dateTo);
      }

      if (filters?.search) {
        query = query?.or(`order_number.ilike.%${filters?.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading rental orders:', error);
      throw error;
    }
  }

  static async getRentalOrder(id: string): Promise<RentalOrder> {
    try {
      const { data, error } = await supabase?.from('rental_orders')?.select(`
          *,
          customers(*),
          rental_order_items(
            *,
            inventory_items(*)
          ),
          created_by_profile:user_profiles!created_by(full_name)
        `)?.eq('id', id)?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error loading rental order:', error);
      throw error;
    }
  }

  static async createRentalOrder(orderData: OrderData): Promise<RentalOrder> {
    try {
      // Generate order number
      const timestamp = Date.now()?.toString()?.slice(-6);
      const orderNumber = `ORD-${timestamp}`;

      // Calculate totals
      const subtotal = orderData?.items?.reduce((sum, item) => sum + item?.total_price, 0) || 0;
      const gstAmount = subtotal * 0.18; // 18% GST
      const totalAmount = subtotal + gstAmount;

      const { data: order, error: orderError } = await supabase?.from('rental_orders')?.insert([{
          order_number: orderNumber,
          customer_id: orderData?.customer_id,
          event_date: orderData?.event_date,
          delivery_date: orderData?.delivery_date,
          return_date: orderData?.return_date,
          delivery_address: orderData?.delivery_address,
          total_amount: totalAmount,
          security_deposit: orderData?.security_deposit || 0,
          gst_amount: gstAmount,
          notes: orderData?.notes,
          created_by: (await supabase?.auth?.getUser())?.data?.user?.id
        }])?.select()?.single();

      if (orderError) throw orderError;

      // Create order items
      if (orderData?.items?.length > 0) {
        const orderItems = orderData?.items?.map(item => ({
          order_id: order?.id,
          item_id: item?.item_id,
          quantity: item?.quantity,
          rental_days: item?.rental_days,
          unit_price: item?.unit_price,
          total_price: item?.total_price
        }));

        const { error: itemsError } = await supabase?.from('rental_order_items')?.insert(orderItems);

        if (itemsError) throw itemsError;

        // Update inventory reserved quantities
        for (const item of orderData?.items) {
          await this.updateInventoryReservation(item?.item_id, item?.quantity, 'add');
        }
      }

      return order;
    } catch (error) {
      console.error('Error creating rental order:', error);
      throw error;
    }
  }

  static async updateRentalOrder(id: string, updates: Partial<RentalOrder>): Promise<RentalOrder> {
    try {
      const { data, error } = await supabase?.from('rental_orders')?.update({
          ...updates,
          updated_at: new Date()
        })?.eq('id', id)?.select()?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating rental order:', error);
      throw error;
    }
  }

  static async updateOrderStatus(id: string, status: string): Promise<RentalOrder> {
    try {
      const { data, error } = await supabase?.from('rental_orders')?.update({ 
          status,
          updated_at: new Date()
        })?.eq('id', id)?.select()?.single();

      if (error) throw error;

      // Handle inventory updates based on status
      if (status === 'cancelled') {
        await this.releaseOrderInventory(id);
      }

      return data;
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  static async updatePaymentStatus(id: string, paymentStatus: string): Promise<RentalOrder> {
    try {
      const { data, error } = await supabase?.from('rental_orders')?.update({ 
          payment_status: paymentStatus,
          updated_at: new Date()
        })?.eq('id', id)?.select()?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating payment status:', error);
      throw error;
    }
  }

  static async deleteRentalOrder(id: string): Promise<void> {
    try {
      // Release inventory first
      await this.releaseOrderInventory(id);

      const { error } = await supabase?.from('rental_orders')?.delete()?.eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting rental order:', error);
      throw error;
    }
  }

  static async updateInventoryReservation(itemId: string, quantity: number, operation: 'add' | 'subtract' = 'add'): Promise<void> {
    try {
      const { data: item } = await supabase?.from('inventory_items')?.select('reserved_quantity, total_quantity')?.eq('id', itemId)?.single();

      if (item) {
        const newReserved = operation === 'add' 
          ? item?.reserved_quantity + quantity
          : Math.max(0, item?.reserved_quantity - quantity);
        
        const newAvailable = item?.total_quantity - newReserved;

        await supabase?.from('inventory_items')?.update({ 
            reserved_quantity: newReserved,
            available_quantity: newAvailable,
            updated_at: new Date()
          })?.eq('id', itemId);
      }
    } catch (error) {
      console.error('Error updating inventory reservation:', error);
      throw error;
    }
  }

  static async releaseOrderInventory(orderId: string): Promise<void> {
    try {
      const { data: orderItems } = await supabase?.from('rental_order_items')?.select('item_id, quantity')?.eq('order_id', orderId);

      for (const item of orderItems || []) {
        await this.updateInventoryReservation(item?.item_id, item?.quantity, 'subtract');
      }
    } catch (error) {
      console.error('Error releasing order inventory:', error);
      throw error;
    }
  }

  static async getOrderStatistics(): Promise<OrderStatistics> {
    try {
      const { data, error } = await supabase?.from('rental_orders')?.select('status, total_amount, payment_status');

      if (error) throw error;

      const stats: OrderStatistics = {
        total: data?.length || 0,
        pending: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
        totalRevenue: 0,
        pendingPayments: 0
      };

      data?.forEach((order: any) => {
        stats[order.status as keyof OrderStatistics] = (stats?.[order?.status as keyof OrderStatistics] || 0) + 1;
        stats.totalRevenue += order?.total_amount || 0;
        
        if (order?.payment_status === 'pending' || order?.payment_status === 'partial') {
          stats.pendingPayments += order?.total_amount || 0;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error loading order statistics:', error);
      throw error;
    }
  }
}
