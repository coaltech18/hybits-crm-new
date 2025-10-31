// ============================================================================
// BILLING SERVICE
// ============================================================================

import { 
  Plan, 
  Subscription, 
  Invoice, 
  PlanFormData, 
  BillingStats,
  Vendor,
  VendorSubscription,
  SubscriptionEntryFormData,
  SubscriptionCalculation,
  VendorFormData,
  VendorPayment,
  VendorPaymentFormData,
  SubscriptionItem
} from '@/types/billing';
import { mockPlans, mockSubscriptions, mockInvoices, mockUsers } from './mockBillingData';
import { supabase } from '@/lib/supabase';

export class BillingService {
  /**
   * Get all subscription plans
   */
  static async getPlans(): Promise<Plan[]> {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return mockPlans.filter(plan => plan.active);
    } catch (error: any) {
      console.error('Error in getPlans:', error);
      throw new Error(error.message || 'Failed to fetch plans');
    }
  }

  /**
   * Get all plans (including inactive) - Admin only
   */
  static async getAllPlans(): Promise<Plan[]> {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      return mockPlans;
    } catch (error: any) {
      console.error('Error in getAllPlans:', error);
      throw new Error(error.message || 'Failed to fetch all plans');
    }
  }

  /**
   * Get a single plan by ID
   */
  static async getPlan(id: string): Promise<Plan> {
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const plan = mockPlans.find(p => p.id === id);
      if (!plan) {
        throw new Error('Plan not found');
      }
      
      return plan;
    } catch (error: any) {
      console.error('Error in getPlan:', error);
      throw new Error(error.message || 'Failed to fetch plan');
    }
  }

  /**
   * Create a new plan - Admin only
   */
  static async createPlan(planData: PlanFormData): Promise<Plan> {
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const newPlan: Plan = {
        id: `plan_${Date.now()}`,
        ...planData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      mockPlans.push(newPlan);
      return newPlan;
    } catch (error: any) {
      console.error('Error in createPlan:', error);
      throw new Error(error.message || 'Failed to create plan');
    }
  }

  /**
   * Update an existing plan - Admin only
   */
  static async updatePlan(id: string, planData: Partial<PlanFormData>): Promise<Plan> {
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const planIndex = mockPlans.findIndex(p => p.id === id);
      if (planIndex === -1) {
        throw new Error('Plan not found');
      }
      
      const plan = mockPlans[planIndex];
      if (!plan) {
        throw new Error('Plan not found');
      }
      
      mockPlans[planIndex] = {
        ...plan,
        ...planData,
        updated_at: new Date().toISOString()
      };
      
      return mockPlans[planIndex]!;
    } catch (error: any) {
      console.error('Error in updatePlan:', error);
      throw new Error(error.message || 'Failed to update plan');
    }
  }

  /**
   * Delete a plan - Admin only (soft delete)
   */
  static async deletePlan(id: string): Promise<void> {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const planIndex = mockPlans.findIndex(p => p.id === id);
      if (planIndex === -1) {
        throw new Error('Plan not found');
      }
      
      const plan = mockPlans[planIndex];
      if (!plan) {
        throw new Error('Plan not found');
      }
      
      plan.active = false;
      plan.updated_at = new Date().toISOString();
    } catch (error: any) {
      console.error('Error in deletePlan:', error);
      throw new Error(error.message || 'Failed to delete plan');
    }
  }

  /**
   * Get user's current subscription
   */
  static async getUserSubscription(userId: string): Promise<Subscription | null> {
    try {
      await new Promise(resolve => setTimeout(resolve, 400));
      
      const subscription = mockSubscriptions.find(s => s.user_id === userId && s.status === 'active');
      return subscription || null;
    } catch (error: any) {
      console.error('Error in getUserSubscription:', error);
      throw new Error(error.message || 'Failed to fetch subscription');
    }
  }

  /**
   * Get all subscriptions - Admin only
   */
  static async getAllSubscriptions(): Promise<(Subscription & { user_name?: string; user_email?: string })[]> {
    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      
      return mockSubscriptions.map(subscription => {
        const user = mockUsers.find(u => u.id === subscription.user_id);
        return {
          ...subscription,
          ...(user?.name && { user_name: user.name }),
          ...(user?.email && { user_email: user.email })
        };
      });
    } catch (error: any) {
      console.error('Error in getAllSubscriptions:', error);
      throw new Error(error.message || 'Failed to fetch subscriptions');
    }
  }

  /**
   * Create a new subscription
   */
  static async createSubscription(planId: string, userId: string): Promise<Subscription> {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const plan = mockPlans.find(p => p.id === planId);
      if (!plan) {
        throw new Error('Plan not found');
      }
      
      // Cancel existing active subscription
      const existingIndex = mockSubscriptions.findIndex(s => s.user_id === userId && s.status === 'active');
      if (existingIndex !== -1) {
        const existingSubscription = mockSubscriptions[existingIndex];
        if (existingSubscription) {
          existingSubscription.status = 'canceled';
          existingSubscription.updated_at = new Date().toISOString();
        }
      }
      
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);
      
      const newSubscription: Subscription = {
        id: `sub_${Date.now()}`,
        user_id: userId,
        plan_id: planId,
        plan_name: plan.name,
        status: 'active',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        next_billing_date: endDate.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      mockSubscriptions.push(newSubscription);
      return newSubscription;
    } catch (error: any) {
      console.error('Error in createSubscription:', error);
      throw new Error(error.message || 'Failed to create subscription');
    }
  }

  /**
   * Cancel a subscription
   */
  static async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const subscriptionIndex = mockSubscriptions.findIndex(s => s.id === subscriptionId);
      if (subscriptionIndex === -1) {
        throw new Error('Subscription not found');
      }
      
      const subscription = mockSubscriptions[subscriptionIndex];
      if (!subscription) {
        throw new Error('Subscription not found');
      }
      
      subscription.status = 'canceled';
      subscription.updated_at = new Date().toISOString();
    } catch (error: any) {
      console.error('Error in cancelSubscription:', error);
      throw new Error(error.message || 'Failed to cancel subscription');
    }
  }

  /**
   * Get invoices for a user
   */
  static async getInvoices(userId: string): Promise<Invoice[]> {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const userSubscriptions = mockSubscriptions.filter(s => s.user_id === userId);
      const subscriptionIds = userSubscriptions.map(s => s.id);
      
      return mockInvoices
        .filter(invoice => subscriptionIds.includes(invoice.subscription_id))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (error: any) {
      console.error('Error in getInvoices:', error);
      throw new Error(error.message || 'Failed to fetch invoices');
    }
  }

  /**
   * Get all invoices - Admin only
   */
  static async getAllInvoices(): Promise<(Invoice & { user_name?: string; user_email?: string })[]> {
    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      
      return mockInvoices.map(invoice => {
        const subscription = mockSubscriptions.find(s => s.id === invoice.subscription_id);
        const user = subscription ? mockUsers.find(u => u.id === subscription.user_id) : null;
        
        return {
          ...invoice,
          ...(user?.name && { user_name: user.name }),
          ...(user?.email && { user_email: user.email })
        };
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (error: any) {
      console.error('Error in getAllInvoices:', error);
      throw new Error(error.message || 'Failed to fetch all invoices');
    }
  }

  /**
   * Get billing statistics - Admin only
   */
  static async getBillingStats(): Promise<BillingStats> {
    try {
      await new Promise(resolve => setTimeout(resolve, 400));
      
      const activeSubscriptions = mockSubscriptions.filter(s => s.status === 'active').length;
      const pendingInvoices = mockInvoices.filter(i => i.status === 'pending').length;
      const totalRevenue = mockInvoices
        .filter(i => i.status === 'paid')
        .reduce((sum, invoice) => sum + invoice.amount, 0);
      
      return {
        totalPlans: mockPlans.filter(p => p.active).length,
        activeSubscriptions,
        totalRevenue,
        pendingInvoices
      };
    } catch (error: any) {
      console.error('Error in getBillingStats:', error);
      throw new Error(error.message || 'Failed to fetch billing stats');
    }
  }

  // ============================================================================
  // VENDOR SUBSCRIPTION METHODS
  // ============================================================================

  /**
   * Get all vendors
   */
  static async getVendors(): Promise<Vendor[]> {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      return (data || []) as Vendor[];
    } catch (error: any) {
      console.error('Error in getVendors:', error);
      throw new Error(error.message || 'Failed to fetch vendors');
    }
  }

  /**
   * Get vendor by ID
   */
  static async getVendorById(vendorId: string): Promise<Vendor> {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendorId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Vendor not found');

      return data as Vendor;
    } catch (error: any) {
      console.error('Error in getVendorById:', error);
      throw new Error(error.message || 'Failed to fetch vendor');
    }
  }

  /**
   * Create a new vendor
   */
  static async createVendor(vendorData: VendorFormData): Promise<Vendor> {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .insert({
          ...vendorData,
          status: vendorData.status || 'active'
        })
        .select()
        .single();

      if (error) throw error;
      return data as Vendor;
    } catch (error: any) {
      console.error('Error in createVendor:', error);
      throw new Error(error.message || 'Failed to create vendor');
    }
  }

  /**
   * Update vendor
   */
  static async updateVendor(vendorId: string, vendorData: Partial<VendorFormData>): Promise<Vendor> {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .update({
          ...vendorData,
          updated_at: new Date().toISOString()
        })
        .eq('id', vendorId)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Vendor not found');

      return data as Vendor;
    } catch (error: any) {
      console.error('Error in updateVendor:', error);
      throw new Error(error.message || 'Failed to update vendor');
    }
  }

  /**
   * Delete vendor (soft delete by updating status)
   */
  static async deleteVendor(vendorId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('vendors')
        .update({ status: 'terminated', updated_at: new Date().toISOString() })
        .eq('id', vendorId);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error in deleteVendor:', error);
      throw new Error(error.message || 'Failed to delete vendor');
    }
  }

  /**
   * Add a deposit ledger entry for a vendor
   */
  static async addVendorDepositEntry(params: {
    vendorId: string;
    entryType: 'collect' | 'adjust' | 'refund';
    amount: number;
    reason?: string;
    subscriptionId?: string;
  }): Promise<void> {
    const { vendorId, entryType, amount, reason, subscriptionId } = params;
    const { error } = await supabase.from('vendor_deposit_ledger').insert({
      vendor_id: vendorId,
      subscription_id: subscriptionId ?? null,
      entry_type: entryType,
      amount,
      reason: reason ?? null
    });
    if (error) throw error;
  }

  /**
   * Get deposit ledger for a vendor
   */
  static async getVendorDepositLedger(vendorId: string) {
    const { data, error } = await supabase
      .from('vendor_deposit_ledger')
      .select('id, vendor_id, subscription_id, entry_type, amount, reason, created_by, created_at')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  /**
   * Calculate subscription values
   */
  static calculateSubscription(
    items: { price_per_piece: number; quantity: number }[],
    planType: '30k' | '40k' | '60k' | 'custom'
  ): SubscriptionCalculation {
    const totalDishValue = items.reduce((sum, item) => sum + (item.price_per_piece * item.quantity), 0);
    
    // Set monthly fee based on plan type
    const monthlyFees = {
      '30k': 30000,
      '40k': 40000,
      '60k': 60000,
      'custom': 0
    };

    return {
      total_dish_value: totalDishValue,
      monthly_fee: monthlyFees[planType]
    };
  }

  /**
   * Create a new vendor subscription
   */
  static async createVendorSubscription(
    formData: SubscriptionEntryFormData,
    items: { name: string; size?: string; price_per_piece: number; quantity: number }[]
  ): Promise<VendorSubscription> {
    try {
      // Calculate totals
      const calculation = this.calculateSubscription(items, formData.plan_type);

      // Determine monthly fee - use from formData if custom, otherwise from calculation
      const monthlyFee = formData.plan_type === 'custom' 
        ? (formData.monthly_fee || 0)
        : calculation.monthly_fee;

      // Insert subscription
      const { data: subInsert, error: subErr } = await supabase
        .from('vendor_subscriptions')
        .insert({
          vendor_id: formData.vendor_id,
          plan_type: formData.plan_type,
          subscription_start: formData.subscription_start,
          monthly_fee: monthlyFee,
          total_dish_value: calculation.total_dish_value,
          security_deposit_amount: formData.security_deposit_amount,
          status: 'active'
        })
        .select('id')
        .single();

      if (subErr) throw subErr;
      const subscriptionId = subInsert.id as string;

      // Prepare items
      const itemsRows = items.map((it) => ({
        subscription_id: subscriptionId,
        name: it.name,
        size: it.size,
        price_per_piece: it.price_per_piece,
        quantity: it.quantity,
        total: it.price_per_piece * it.quantity
      }));

      if (itemsRows.length > 0) {
        const { error: itemsErr } = await supabase
          .from('vendor_subscription_items')
          .insert(itemsRows);
        if (itemsErr) throw itemsErr;
      }

      // Record deposit payment if amount > 0
      if (formData.security_deposit_amount > 0) {
        const { error: paymentErr } = await supabase
          .from('vendor_payments')
          .insert({
            subscription_id: subscriptionId,
            amount: formData.security_deposit_amount,
            payment_type: 'deposit',
            payment_mode: 'other' // Default, can be updated later
          });
        if (paymentErr) console.warn('Failed to record deposit payment:', paymentErr);
      }

      // Fetch vendor name for return payload
      const vendor = await this.getVendorById(formData.vendor_id);

      const result: VendorSubscription = {
        id: subscriptionId,
        vendor_id: formData.vendor_id,
        vendor_name: vendor.name,
        plan_type: formData.plan_type,
        subscription_start: formData.subscription_start,
        items: itemsRows.map((r, idx) => ({
          id: `item_${subscriptionId}_${idx}`,
          name: r.name,
          size: r.size ?? '',
          price_per_piece: r.price_per_piece,
          quantity: r.quantity,
          total: r.total,
          status: 'issued' as const
        })),
        total_dish_value: calculation.total_dish_value,
        security_deposit_amount: formData.security_deposit_amount,
        monthly_fee: calculation.monthly_fee,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      return result;
    } catch (error: any) {
      console.error('Error in createVendorSubscription:', error);
      throw new Error(error.message || 'Failed to create vendor subscription');
    }
  }


  /**
   * Get all vendor subscriptions
   */
  static async getVendorSubscriptions(): Promise<VendorSubscription[]> {
    try {
      // Fetch subscriptions
      const { data: subscriptions, error: subError } = await supabase
        .from('vendor_subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (subError) throw subError;

      // Fetch items and vendor names for each subscription
      const subscriptionsWithItems = await Promise.all(
        (subscriptions || []).map(async (sub: any) => {
          // Fetch items
          const { data: items } = await supabase
            .from('vendor_subscription_items')
            .select('*')
            .eq('subscription_id', sub.id)
            .order('created_at', { ascending: true });

          // Fetch vendor name
          const { data: vendor } = await supabase
            .from('vendors')
            .select('name')
            .eq('id', sub.vendor_id)
            .single();

          return {
            ...sub,
            vendor_name: vendor?.name,
            items: (items || []) as SubscriptionItem[]
          } as VendorSubscription;
        })
      );

      return subscriptionsWithItems;
    } catch (error: any) {
      console.error('Error in getVendorSubscriptions:', error);
      throw new Error(error.message || 'Failed to fetch vendor subscriptions');
    }
  }

  /**
   * Get vendor subscriptions for a specific vendor
   */
  static async getVendorSubscriptionsByVendorId(vendorId: string): Promise<VendorSubscription[]> {
    try {
      const { data: subscriptions, error: subError } = await supabase
        .from('vendor_subscriptions')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (subError) throw subError;

      const subscriptionsWithItems = await Promise.all(
        (subscriptions || []).map(async (sub: any) => {
          const { data: items } = await supabase
            .from('vendor_subscription_items')
            .select('*')
            .eq('subscription_id', sub.id);

          return {
            ...sub,
            items: (items || []) as SubscriptionItem[]
          } as VendorSubscription;
        })
      );

      return subscriptionsWithItems;
    } catch (error: any) {
      console.error('Error in getVendorSubscriptionsByVendorId:', error);
      throw new Error(error.message || 'Failed to fetch vendor subscriptions');
    }
  }

  // ============================================================================
  // VENDOR PAYMENT METHODS
  // ============================================================================

  /**
   * Create a vendor payment
   */
  static async createVendorPayment(paymentData: VendorPaymentFormData): Promise<VendorPayment> {
    try {
      const { data, error } = await supabase
        .from('vendor_payments')
        .insert(paymentData)
        .select()
        .single();

      if (error) throw error;
      return data as VendorPayment;
    } catch (error: any) {
      console.error('Error in createVendorPayment:', error);
      throw new Error(error.message || 'Failed to create vendor payment');
    }
  }

  /**
   * Get payments for a subscription
   */
  static async getSubscriptionPayments(subscriptionId: string): Promise<VendorPayment[]> {
    try {
      const { data, error } = await supabase
        .from('vendor_payments')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as VendorPayment[];
    } catch (error: any) {
      console.error('Error in getSubscriptionPayments:', error);
      throw new Error(error.message || 'Failed to fetch subscription payments');
    }
  }

  /**
   * Get all payments for a vendor (via subscriptions)
   */
  static async getVendorPayments(vendorId: string): Promise<VendorPayment[]> {
    try {
      // Get all subscription IDs for vendor
      const { data: subscriptions } = await supabase
        .from('vendor_subscriptions')
        .select('id')
        .eq('vendor_id', vendorId);

      if (!subscriptions || subscriptions.length === 0) return [];

      const subscriptionIds = subscriptions.map(s => s.id);

      const { data, error } = await supabase
        .from('vendor_payments')
        .select('*')
        .in('subscription_id', subscriptionIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as VendorPayment[];
    } catch (error: any) {
      console.error('Error in getVendorPayments:', error);
      throw new Error(error.message || 'Failed to fetch vendor payments');
    }
  }
}
