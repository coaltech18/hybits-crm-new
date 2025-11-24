// ============================================================================
// DASHBOARD SERVICE
// ============================================================================

import { supabase } from '@/lib/supabase';
import { DashboardStats } from '@/types';

export interface DashboardStatsExtended extends DashboardStats {
  pendingOrders: number;
  lowStockItems: number;
  overdueInvoices: number;
}

export interface RecentOrder {
  id: string;
  order_number: string;
  customer_name: string;
  amount: number;
  status: string;
  created_at: string;
}

class DashboardService {
  /**
   * Get aggregated statistics across all outlets (for admin)
   */
  static async getAggregatedStats(): Promise<DashboardStatsExtended> {
    try {
      // Get total customers across all outlets
      const { count: totalCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Get total orders across all outlets
      const { count: totalOrders } = await supabase
        .from('rental_orders')
        .select('*', { count: 'exact', head: true });

      // Get pending orders count
      const { count: pendingOrders } = await supabase
        .from('rental_orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'confirmed', 'items_dispatched']);

      // Get total revenue (paid invoices) across all outlets
      const { data: revenueData } = await supabase
        .from('invoices')
        .select('total_amount')
        .eq('payment_status', 'paid');

      const totalRevenue = revenueData?.reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0) || 0;

      // Get low stock items (available_quantity <= reorder_point) across all outlets
      // Using a raw query approach since Supabase doesn't support column comparison in lte
      const { data: inventoryData } = await supabase
        .from('inventory_items')
        .select('available_quantity, reorder_point')
        .not('reorder_point', 'is', null)
        .gt('reorder_point', 0);

      const lowStockItems = inventoryData?.filter(item => 
        item.available_quantity <= item.reorder_point
      ).length || 0;

      // Get overdue invoices (due_date < today and payment_status != 'paid')
      const today = new Date().toISOString().split('T')[0];
      const { count: overdueInvoices } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .lt('due_date', today)
        .neq('payment_status', 'paid');

      return {
        totalCustomers: totalCustomers || 0,
        totalOrders: totalOrders || 0,
        totalRevenue,
        pendingOrders: pendingOrders || 0,
        lowStockItems: lowStockItems || 0,
        overdueInvoices: overdueInvoices || 0,
      };
    } catch (error) {
      console.error('Error fetching aggregated stats:', error);
      throw error;
    }
  }

  /**
   * Get outlet-specific statistics
   */
  static async getOutletStats(outletId: string): Promise<DashboardStatsExtended> {
    try {
      // Get customers count for this outlet
      const { count: totalCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('outlet_id', outletId)
        .eq('status', 'active');

      // Get orders count for this outlet
      const { count: totalOrders } = await supabase
        .from('rental_orders')
        .select('*', { count: 'exact', head: true })
        .eq('outlet_id', outletId);

      // Get pending orders count for this outlet
      const { count: pendingOrders } = await supabase
        .from('rental_orders')
        .select('*', { count: 'exact', head: true })
        .eq('outlet_id', outletId)
        .in('status', ['pending', 'confirmed', 'items_dispatched']);

      // Get total revenue for this outlet (paid invoices)
      const { data: revenueData } = await supabase
        .from('invoices')
        .select('total_amount')
        .eq('outlet_id', outletId)
        .eq('payment_status', 'paid');

      const totalRevenue = revenueData?.reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0) || 0;

      // Get low stock items for this outlet
      const { data: inventoryData } = await supabase
        .from('inventory_items')
        .select('available_quantity, reorder_point')
        .eq('outlet_id', outletId)
        .not('reorder_point', 'is', null)
        .gt('reorder_point', 0);

      const lowStockItems = inventoryData?.filter(item => 
        item.available_quantity <= item.reorder_point
      ).length || 0;

      // Get overdue invoices for this outlet
      const today = new Date().toISOString().split('T')[0];
      const { count: overdueInvoices } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('outlet_id', outletId)
        .lt('due_date', today)
        .neq('payment_status', 'paid');

      return {
        totalCustomers: totalCustomers || 0,
        totalOrders: totalOrders || 0,
        totalRevenue,
        pendingOrders: pendingOrders || 0,
        lowStockItems: lowStockItems || 0,
        overdueInvoices: overdueInvoices || 0,
      };
    } catch (error) {
      console.error('Error fetching outlet stats:', error);
      throw error;
    }
  }

  /**
   * Get recent orders (outlet-specific or all)
   */
  static async getRecentOrders(outletId?: string, limit: number = 5): Promise<RecentOrder[]> {
    try {
      let query = supabase
        .from('rental_orders')
        .select(`
          id,
          order_number,
          total_amount,
          status,
          created_at,
          customers(contact_person)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (outletId) {
        query = query.eq('outlet_id', outletId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching recent orders:', error);
        throw error;
      }

      return (data || []).map((order: any) => ({
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customers?.contact_person || 'Unknown Customer',
        amount: order.total_amount || 0,
        status: order.status || 'pending',
        created_at: order.created_at,
      }));
    } catch (error) {
      console.error('Error fetching recent orders:', error);
      throw error;
    }
  }

  /**
   * Get revenue data for charts (outlet-specific or aggregated)
   */
  static async getRevenueData(outletId?: string, months: number = 6): Promise<Array<{ month: string; revenue: number }>> {
    try {
      const today = new Date();
      const revenueData: Array<{ month: string; revenue: number }> = [];

      for (let i = months - 1; i >= 0; i--) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const startDate = date.toISOString().split('T')[0];
        const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
        const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        let query = supabase
          .from('invoices')
          .select('total_amount')
          .eq('payment_status', 'paid')
          .gte('invoice_date', startDate)
          .lte('invoice_date', endDate);

        if (outletId) {
          query = query.eq('outlet_id', outletId);
        }

        const { data } = await query;
        const revenue = data?.reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0) || 0;

        revenueData.push({ month: monthLabel, revenue });
      }

      return revenueData;
    } catch (error) {
      console.error('Error fetching revenue data:', error);
      throw error;
    }
  }
}

export default DashboardService;

