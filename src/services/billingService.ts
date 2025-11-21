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
        .maybeSingle();

      if (error) {
        console.error('DB error fetching vendors:', error);
        throw new Error('Database error');
      }

      if (!data) {
        console.warn('vendors row not found for filter id:', vendorId);
        throw new Error('Vendor not found');
      }

      return data as Vendor;
    } catch (error: any) {
      console.error('Error in getVendorById:', error);
      throw new Error(error.message || 'Failed to fetch vendor');
    }
  }

  /**
   * Create a new vendor
   */
  static async createVendor(vendorData: VendorFormData & { outlet_id?: string }): Promise<Vendor> {
    try {
      // Get current user for outlet_id and created_by
      const { data: { user } } = await supabase.auth.getUser();
      const outletId = vendorData.outlet_id || (user?.user_metadata?.outlet_id);

      const insertData: any = {
        // vendor_code will be auto-generated by trigger (VENDOR-OUTCODE-001)
        name: vendorData.name,
        contact_person: vendorData.contact_person,
        phone: vendorData.phone,
        email: vendorData.email,
        address: vendorData.address,
        gst_number: vendorData.gst_number,
        status: vendorData.status || 'active',
        notes: vendorData.notes,
        created_by: user?.id
      };

      // Add outlet_id if provided
      if (outletId) {
        insertData.outlet_id = outletId;
      }

      const { data, error } = await supabase
        .from('vendors')
        .insert(insertData)
        .select()
        .maybeSingle();

      if (error) {
        console.error('DB error fetching vendors:', error);
        throw new Error('Database error');
      }

      if (!data) {
        console.warn('vendors row not found after insert');
        throw new Error('Failed to create vendor');
      }

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
        .maybeSingle();

      if (error) {
        console.error('DB error fetching vendors:', error);
        throw new Error('Database error');
      }

      if (!data) {
        console.warn('vendors row not found for filter id:', vendorId);
        throw new Error('Vendor not found');
      }

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
    formData: SubscriptionEntryFormData & { outlet_id?: string },
    items: { name: string; size?: string; price_per_piece: number; quantity: number }[]
  ): Promise<VendorSubscription> {
    try {
      // Get current user for outlet_id and created_by
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get vendor to determine outlet_id
      const vendor = await this.getVendorById(formData.vendor_id);
      const outletId = formData.outlet_id || vendor.outlet_id;

      // Calculate totals
      const calculation = this.calculateSubscription(items, formData.plan_type);

      // Determine monthly fee - use from formData if custom, otherwise from calculation
      const monthlyFee = formData.plan_type === 'custom' 
        ? (formData.monthly_fee || 0)
        : calculation.monthly_fee;

      // Insert subscription - vsub_code will be auto-generated by trigger
      const { data: subInsert, error: subErr } = await supabase
        .from('vendor_subscriptions')
        .insert({
          // vsub_code will be auto-generated by trigger (VSUB-OUTCODE-001)
          vendor_id: formData.vendor_id,
          plan_type: formData.plan_type,
          subscription_start: formData.subscription_start,
          subscription_end: formData.subscription_end,
          monthly_fee: monthlyFee,
          total_dish_value: calculation.total_dish_value,
          security_deposit_amount: formData.security_deposit_amount,
          status: 'active',
          created_by: user?.id
        })
        .select('id')
        .maybeSingle();

      if (subErr) {
        console.error('DB error fetching vendor_subscriptions:', subErr);
        throw new Error('Database error');
      }

      if (!subInsert || !subInsert.id) {
        console.warn('vendor_subscriptions row not found after insert');
        throw new Error('Failed to create vendor subscription');
      }

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
   * Get all vendor subscriptions (with outlet filtering for non-admin users)
   */
  static async getVendorSubscriptions(outletId?: string): Promise<VendorSubscription[]> {
    try {
      // Filter by outlet_id via vendor if provided (for manager/accountant)
      let vendorIds: string[] | undefined;
      if (outletId) {
        const { data: vendors } = await supabase
          .from('vendors')
          .select('id')
          .eq('outlet_id', outletId);
        
        if (vendors && vendors.length > 0) {
          vendorIds = vendors.map(v => v.id);
        } else {
          // No vendors for this outlet, return empty array
          return [];
        }
      }

      // Fetch subscriptions
      let query = supabase
        .from('vendor_subscriptions')
        .select('*');

      if (vendorIds) {
        query = query.in('vendor_id', vendorIds);
      }

      const { data: subscriptions, error: subError } = await query.order('created_at', { ascending: false });

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
          const { data: vendor, error: vendorError } = await supabase
            .from('vendors')
            .select('name')
            .eq('id', sub.vendor_id)
            .maybeSingle();

          if (vendorError) {
            console.error('DB error fetching vendors:', vendorError);
          }

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
  static async createVendorPayment(paymentData: VendorPaymentFormData & { outlet_id?: string }): Promise<VendorPayment> {
    try {
      // Get current user for outlet_id and created_by
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get vendor to determine outlet_id if not provided
      let outletId = paymentData.outlet_id;
      if (!outletId && paymentData.vendor_id) {
        const vendor = await this.getVendorById(paymentData.vendor_id);
        outletId = vendor.outlet_id;
      }

      const insertData: any = {
        // vpay_code will be auto-generated by trigger (VPAY-OUTCODE-001)
        vendor_id: paymentData.vendor_id,
        subscription_id: paymentData.subscription_id,
        amount: paymentData.amount,
        payment_type: paymentData.payment_type,
        payment_mode: paymentData.payment_mode || 'cash',
        transaction_ref: paymentData.transaction_ref,
        notes: paymentData.notes,
        created_by: user?.id
      };

      // Add outlet_id if available
      if (outletId) {
        insertData.outlet_id = outletId;
      }

      const { data, error } = await supabase
        .from('vendor_payments')
        .insert(insertData)
        .select()
        .maybeSingle();

      if (error) {
        console.error('DB error fetching vendor_payments:', error);
        throw new Error('Database error');
      }

      if (!data) {
        console.warn('vendor_payments row not found after insert');
        throw new Error('Failed to create vendor payment');
      }

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
