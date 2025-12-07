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
  SubscriptionItem,
  CustomerSubscription,
  CustomerSubscriptionFormData,
  SubscriptionInvoice,
  SubscriptionPayment,
  SubscriptionPaymentFormData
} from '@/types/billing';
import { supabase } from '@/lib/supabase';

export class BillingService {
  /**
   * Get all subscription plans (with outlet filtering for non-admin users)
   */
  static async getPlans(options?: { outletId?: string; adminFlag?: boolean }): Promise<Plan[]> {
    try {
      let query = supabase
        .from('plans')
        .select('*');

      // Filter by outlet_id if provided and not admin
      if (options?.outletId && !options?.adminFlag) {
        query = query.eq('outlet_id', options.outletId);
      }

      // Filter active plans only
      query = query.eq('is_active', true);

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching plans:', error);
        throw new Error(error.message || 'Failed to fetch plans');
      }

      // Map database fields to Plan interface
      return (data || []).map((plan: any) => ({
        id: plan.id,
        name: plan.name,
        price: 0, // Plans table doesn't have price - this is for customer subscriptions
        interval: (plan.billing_period || 'monthly') as 'monthly' | 'yearly',
        features: [], // Plans table doesn't have features array
        active: plan.is_active,
        description: plan.description,
        created_at: plan.created_at,
        updated_at: plan.updated_at
      }));
    } catch (error: any) {
      console.error('Error in getPlans:', error);
      throw new Error(error.message || 'Failed to fetch plans');
    }
  }

  /**
   * Get all plans (including inactive) - Admin only
   */
  static async getAllPlans(options?: { outletId?: string }): Promise<Plan[]> {
    try {
      let query = supabase
        .from('plans')
        .select('*');

      // Filter by outlet_id if provided
      if (options?.outletId) {
        query = query.eq('outlet_id', options.outletId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching all plans:', error);
        throw new Error(error.message || 'Failed to fetch all plans');
      }

      return (data || []).map((plan: any) => ({
        id: plan.id,
        name: plan.name,
        price: 0,
        interval: (plan.billing_period || 'monthly') as 'monthly' | 'yearly',
        features: [],
        active: plan.is_active,
        description: plan.description,
        created_at: plan.created_at,
        updated_at: plan.updated_at
      }));
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
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('DB error fetching plans:', error);
        throw new Error('Database error');
      }

      if (!data) {
        throw new Error('Plan not found');
      }

      return {
        id: data.id,
        name: data.name,
        price: 0,
        interval: (data.billing_period || 'monthly') as 'monthly' | 'yearly',
        features: [],
        active: data.is_active,
        description: data.description,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    } catch (error: any) {
      console.error('Error in getPlan:', error);
      throw new Error(error.message || 'Failed to fetch plan');
    }
  }

  /**
   * Create a new plan - Admin only
   */
  static async createPlan(planData: PlanFormData & { outlet_id?: string }): Promise<Plan> {
    try {
      // Get current user for outlet_id and created_by
      const { data: { user } } = await supabase.auth.getUser();
      const outletId = planData.outlet_id;

      const insertData: any = {
        // plan_code will be auto-generated if needed
        name: planData.name,
        description: planData.description,
        billing_period: planData.interval || 'monthly',
        is_active: planData.active !== undefined ? planData.active : true,
        created_by: user?.id
      };

      // Add outlet_id if provided
      if (outletId) {
        insertData.outlet_id = outletId;
      }

      const { data, error } = await supabase
        .from('plans')
        .insert(insertData)
        .select()
        .maybeSingle();

      if (error) {
        console.error('DB error creating plan:', error);
        throw new Error('Database error');
      }

      if (!data) {
        throw new Error('Failed to create plan');
      }

      return {
        id: data.id,
        name: data.name,
        price: 0,
        interval: (data.billing_period || 'monthly') as 'monthly' | 'yearly',
        features: [],
        active: data.is_active,
        description: data.description,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
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
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (planData.name) updateData.name = planData.name;
      if (planData.description !== undefined) updateData.description = planData.description;
      if (planData.interval) updateData.billing_period = planData.interval;
      if (planData.active !== undefined) updateData.is_active = planData.active;

      const { data, error } = await supabase
        .from('plans')
        .update(updateData)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        console.error('DB error updating plan:', error);
        throw new Error('Database error');
      }

      if (!data) {
        throw new Error('Plan not found');
      }

      return {
        id: data.id,
        name: data.name,
        price: 0,
        interval: (data.billing_period || 'monthly') as 'monthly' | 'yearly',
        features: [],
        active: data.is_active,
        description: data.description,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
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
      const { error } = await supabase
        .from('plans')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('DB error deleting plan:', error);
        throw new Error('Database error');
      }
    } catch (error: any) {
      console.error('Error in deletePlan:', error);
      throw new Error(error.message || 'Failed to delete plan');
    }
  }

  /**
   * Get billing statistics - Admin only
   * NOTE: This function now uses customer subscriptions instead of user subscriptions
   */
  static async getBillingStats(): Promise<BillingStats> {
    try {
      // Get stats from database
      const [plans, customerSubscriptions] = await Promise.all([
        this.getAllPlans(),
        this.getCustomerSubscriptions()
      ]);

      const activeSubscriptions = customerSubscriptions.filter(s => s.status === 'active').length;
      
      // Get invoices for customer subscriptions
      const allInvoices = await Promise.all(
        customerSubscriptions.map(sub => this.getSubscriptionInvoices(sub.id))
      );
      const invoices = allInvoices.flat();
      const pendingInvoices = invoices.filter(i => i.amount && i.amount > 0).length;
      const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      
      return {
        totalPlans: plans.filter(p => p.active).length,
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
  // DEPRECATED: User subscription methods (not used - customer subscriptions are used instead)
  // ============================================================================
  
  /**
   * @deprecated Use getCustomerSubscriptions instead. User subscriptions are not implemented.
   */
  static async getUserSubscription(_userId: string): Promise<Subscription | null> {
    console.warn('getUserSubscription is deprecated. Use getCustomerSubscriptions instead.');
    return null;
  }

  /**
   * @deprecated Use getCustomerSubscriptions instead. User subscriptions are not implemented.
   */
  static async getAllSubscriptions(): Promise<(Subscription & { user_name?: string; user_email?: string })[]> {
    console.warn('getAllSubscriptions is deprecated. Use getCustomerSubscriptions instead.');
    return [];
  }

  /**
   * @deprecated Use createCustomerSubscription instead. User subscriptions are not implemented.
   */
  static async createSubscription(_planId: string, _userId: string): Promise<Subscription> {
    throw new Error('User subscriptions are not implemented. Use createCustomerSubscription instead.');
  }

  /**
   * @deprecated User subscriptions are not implemented.
   */
  static async cancelSubscription(_subscriptionId: string): Promise<void> {
    throw new Error('User subscriptions are not implemented.');
  }

  /**
   * @deprecated Use getSubscriptionInvoices instead. User subscriptions are not implemented.
   */
  static async getInvoices(_userId: string): Promise<Invoice[]> {
    console.warn('getInvoices is deprecated. Use getSubscriptionInvoices instead.');
    return [];
  }

  /**
   * @deprecated Use InvoiceService.getInvoices instead.
   */
  static async getAllInvoices(): Promise<(Invoice & { user_name?: string; user_email?: string })[]> {
    console.warn('getAllInvoices is deprecated. Use InvoiceService.getInvoices instead.');
    return [];
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
      const vendorData = await this.getVendorById(formData.vendor_id);
      
      // Determine outlet_id: use formData, then vendor's outlet_id, then user's outlet_id
      let outletId = formData.outlet_id || (vendorData as any).outlet_id;
      
      // If still no outlet_id, try to get from user profile
      if (!outletId && user?.id) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('outlet_id')
          .eq('id', user.id)
          .maybeSingle();
        outletId = profile?.outlet_id;
      }
      
      // Validate outlet_id is present
      if (!outletId) {
        throw new Error('Outlet ID is required. Please ensure vendor has an outlet assigned or select an outlet.');
      }

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
          subscription_end: (formData as any).subscription_end || null,
          monthly_fee: monthlyFee,
          total_dish_value: calculation.total_dish_value,
          security_deposit_amount: formData.security_deposit_amount,
          status: 'active',
          outlet_id: outletId, // Use outletId here
          created_by: user?.id
        })
        .select('id')
        .maybeSingle();

      if (subErr) {
        console.error('DB error creating vendor_subscriptions:', subErr);
        // Provide more specific error message
        if (subErr.code === '23502') { // NOT NULL violation
          throw new Error('Missing required field. Please ensure all required fields are filled.');
        } else if (subErr.code === '23503') { // Foreign key violation
          throw new Error('Invalid reference. Please check vendor selection.');
        } else if (subErr.message) {
          throw new Error(`Database error: ${subErr.message}`);
        }
        throw new Error('Database error: Failed to create subscription');
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
      const vendorInfo2 = await this.getVendorById(formData.vendor_id);

      const result: VendorSubscription = {
        id: subscriptionId,
        vendor_id: formData.vendor_id,
        vendor_name: vendorInfo2.name,
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

  /**
   * Delete vendor subscription (soft delete by setting status to cancelled)
   */
  static async deleteVendorSubscription(subscriptionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('vendor_subscriptions')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId);

      if (error) {
        console.error('Error deleting vendor subscription:', error);
        throw new Error(error.message || 'Failed to delete vendor subscription');
      }
    } catch (error: any) {
      console.error('Error in deleteVendorSubscription:', error);
      throw new Error(error.message || 'Failed to delete vendor subscription');
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
      if (!outletId && (paymentData as any).vendor_id) {
        const vendorData = await this.getVendorById((paymentData as any).vendor_id);
        outletId = (vendorData as any).outlet_id;
      }

      const insertData: any = {
        // vpay_code will be auto-generated by trigger (VPAY-OUTCODE-001)
        vendor_id: (paymentData as any).vendor_id,
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

  // ============================================================================
  // CUSTOMER SUBSCRIPTION METHODS (for daily-delivered items billed monthly)
  // ============================================================================

  /**
   * Get all customer subscriptions (with outlet filtering for non-admin users)
   */
  static async getCustomerSubscriptions(options?: { outletId?: string; customerId?: string }): Promise<CustomerSubscription[]> {
    try {
      let query = supabase
        .from('customer_subscriptions')
        .select(`
          *,
          customers:customer_id(contact_person, company_name),
          plans:plan_id(name)
        `);

      // Filter by outlet_id if provided (for manager/accountant)
      if (options?.outletId) {
        query = query.eq('outlet_id', options.outletId);
      }

      // Filter by customer_id if provided
      if (options?.customerId) {
        query = query.eq('customer_id', options.customerId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching customer subscriptions:', error);
        throw new Error(error.message || 'Failed to fetch subscriptions');
      }

      return (data || []).map((sub: any) => ({
        id: sub.id,
        subscription_code: sub.subscription_code,
        customer_id: sub.customer_id,
        customer_name: sub.customers?.contact_person || sub.customers?.company_name,
        plan_id: sub.plan_id,
        plan_name: sub.plans?.name,
        outlet_id: sub.outlet_id,
        start_date: sub.start_date,
        end_date: sub.end_date,
        quantity_per_day: sub.quantity_per_day,
        unit_price: Number(sub.unit_price),
        monthly_amount: Number(sub.monthly_amount),
        security_deposit: Number(sub.security_deposit),
        gst_rate: Number(sub.gst_rate),
        status: sub.status as 'active' | 'paused' | 'cancelled' | 'expired',
        created_by: sub.created_by,
        created_at: sub.created_at,
        updated_at: sub.updated_at
      }));
    } catch (error: any) {
      console.error('Error in getCustomerSubscriptions:', error);
      throw new Error(error.message || 'Failed to fetch subscriptions');
    }
  }

  /**
   * Get a single customer subscription by ID
   */
  static async getCustomerSubscription(id: string): Promise<CustomerSubscription> {
    try {
      const { data, error } = await supabase
        .from('customer_subscriptions')
        .select(`
          *,
          customers:customer_id(contact_person, company_name),
          plans:plan_id(name),
          subscription_items(*)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('DB error fetching subscription:', error);
        throw new Error('Database error');
      }

      if (!data) {
        throw new Error('Subscription not found');
      }

      return {
        id: data.id,
        subscription_code: data.subscription_code,
        customer_id: data.customer_id,
        customer_name: data.customers?.contact_person || data.customers?.company_name,
        plan_id: data.plan_id,
        plan_name: data.plans?.name,
        outlet_id: data.outlet_id,
        start_date: data.start_date,
        end_date: data.end_date,
        quantity_per_day: data.quantity_per_day,
        unit_price: Number(data.unit_price),
        monthly_amount: Number(data.monthly_amount),
        security_deposit: Number(data.security_deposit),
        gst_rate: Number(data.gst_rate),
        status: data.status as 'active' | 'paused' | 'cancelled' | 'expired',
        created_by: data.created_by,
        created_at: data.created_at,
        updated_at: data.updated_at,
        items: data.subscription_items?.map((item: any) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          total_amount: Number(item.total_amount)
        }))
      };
    } catch (error: any) {
      console.error('Error in getCustomerSubscription:', error);
      throw new Error(error.message || 'Failed to fetch subscription');
    }
  }

  /**
   * Create a new customer subscription
   */
  static async createCustomerSubscription(subscriptionData: CustomerSubscriptionFormData): Promise<CustomerSubscription> {
    try {
      // Get current user for outlet_id and created_by
      const { data: { user } } = await supabase.auth.getUser();
      const outletId = subscriptionData.outlet_id;

      if (!outletId) {
        throw new Error('Outlet ID is required');
      }

      const insertData: any = {
        // subscription_code will be auto-generated by trigger
        customer_id: subscriptionData.customer_id,
        plan_id: subscriptionData.plan_id || null,
        outlet_id: outletId,
        start_date: subscriptionData.start_date,
        end_date: subscriptionData.end_date || null,
        quantity_per_day: subscriptionData.quantity_per_day,
        unit_price: subscriptionData.unit_price,
        security_deposit: subscriptionData.security_deposit || 0,
        gst_rate: subscriptionData.gst_rate || 18,
        status: 'active',
        created_by: user?.id
      };

      const { data: subData, error: subError } = await supabase
        .from('customer_subscriptions')
        .insert(insertData)
        .select()
        .maybeSingle();

      if (subError) {
        console.error('DB error creating subscription:', subError);
        throw new Error('Database error');
      }

      if (!subData) {
        throw new Error('Failed to create subscription');
      }

      // Create subscription items if provided
      if (subscriptionData.items && subscriptionData.items.length > 0) {
        const items = subscriptionData.items.map(item => ({
          subscription_id: subData.id,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price
        }));

        const { error: itemsError } = await supabase
          .from('subscription_items')
          .insert(items);

        if (itemsError) {
          console.error('Error creating subscription items:', itemsError);
          // Don't throw - subscription is created, items can be added later
        }
      }

      // Fetch the complete subscription with items
      return await this.getCustomerSubscription(subData.id);
    } catch (error: any) {
      console.error('Error in createCustomerSubscription:', error);
      throw new Error(error.message || 'Failed to create subscription');
    }
  }

  /**
   * Update customer subscription
   */
  static async updateCustomerSubscription(id: string, updates: Partial<CustomerSubscriptionFormData>): Promise<CustomerSubscription> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.quantity_per_day !== undefined) updateData.quantity_per_day = updates.quantity_per_day;
      if (updates.unit_price !== undefined) updateData.unit_price = updates.unit_price;
      if (updates.security_deposit !== undefined) updateData.security_deposit = updates.security_deposit;
      if (updates.gst_rate !== undefined) updateData.gst_rate = updates.gst_rate;
      if (updates.end_date !== undefined) updateData.end_date = updates.end_date;
      if ((updates as any).status !== undefined) updateData.status = (updates as any).status;

      const { data, error } = await supabase
        .from('customer_subscriptions')
        .update(updateData)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        console.error('DB error updating subscription:', error);
        throw new Error('Database error');
      }

      if (!data) {
        throw new Error('Subscription not found');
      }

      return await this.getCustomerSubscription(id);
    } catch (error: any) {
      console.error('Error in updateCustomerSubscription:', error);
      throw new Error(error.message || 'Failed to update subscription');
    }
  }

  /**
   * Delete customer subscription (soft delete by setting status to cancelled)
   */
  static async deleteCustomerSubscription(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('customer_subscriptions')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('Error deleting customer subscription:', error);
        throw new Error(error.message || 'Failed to delete subscription');
      }
    } catch (error: any) {
      console.error('Error in deleteCustomerSubscription:', error);
      throw new Error(error.message || 'Failed to delete subscription');
    }
  }

  /**
   * Get subscription invoices
   */
  static async getSubscriptionInvoices(subscriptionId: string): Promise<SubscriptionInvoice[]> {
    try {
      const { data, error } = await supabase
        .from('subscription_invoices')
        .select(`
          *,
          invoices:invoice_id(
            invoice_number,
            total_amount,
            payment_status
          )
        `)
        .eq('subscription_id', subscriptionId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('DB error fetching subscription invoices:', error);
        throw new Error('Database error');
      }

      return (data || []).map((si: any) => ({
        id: si.id,
        subscription_id: si.subscription_id,
        invoice_id: si.invoice_id,
        invoice_number: si.invoices?.invoice_number,
        billing_period_start: si.billing_period_start,
        billing_period_end: si.billing_period_end,
        amount: Number(si.invoices?.total_amount || 0),
        created_at: si.created_at
      }));
    } catch (error: any) {
      console.error('Error in getSubscriptionInvoices:', error);
      throw new Error(error.message || 'Failed to fetch subscription invoices');
    }
  }

  /**
   * Create subscription payment
   */
  static async createSubscriptionPayment(paymentData: SubscriptionPaymentFormData): Promise<SubscriptionPayment> {
    try {
      // Get current user for outlet_id and created_by
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get subscription to determine outlet_id if not provided
      let outletId = paymentData.outlet_id;
      if (!outletId) {
        const subscription = await this.getCustomerSubscription(paymentData.subscription_id);
        outletId = subscription.outlet_id;
      }

      const insertData: any = {
        // payment_code will be auto-generated by trigger
        subscription_id: paymentData.subscription_id,
        outlet_id: outletId,
        payment_date: paymentData.payment_date,
        amount: paymentData.amount,
        payment_method: paymentData.payment_method,
        reference_number: paymentData.reference_number,
        notes: paymentData.notes,
        created_by: user?.id
      };

      const { data, error } = await supabase
        .from('subscription_payments')
        .insert(insertData)
        .select()
        .maybeSingle();

      if (error) {
        console.error('DB error creating subscription payment:', error);
        throw new Error('Database error');
      }

      if (!data) {
        throw new Error('Failed to create payment');
      }

      return {
        id: data.id,
        payment_code: data.payment_code,
        subscription_id: data.subscription_id,
        outlet_id: data.outlet_id,
        payment_date: data.payment_date,
        amount: Number(data.amount),
        payment_method: data.payment_method,
        reference_number: data.reference_number,
        notes: data.notes,
        created_by: data.created_by,
        created_at: data.created_at
      };
    } catch (error: any) {
      console.error('Error in createSubscriptionPayment:', error);
      throw new Error(error.message || 'Failed to create payment');
    }
  }

  /**
   * Generate monthly invoices for active subscriptions (RPC call)
   */
  static async rpcGenerateMonthlyInvoices(runDate: Date = new Date()): Promise<Array<{ subscription_id: string; invoice_id: string; amount: number }>> {
    try {
      const dateStr = runDate.toISOString().split('T')[0];
      
      const { data, error } = await supabase.rpc('generate_monthly_subscription_invoices', {
        p_run_date: dateStr
      });

      if (error) {
        console.error('RPC error generating invoices:', error);
        throw new Error(error.message || 'Failed to generate invoices');
      }

      return (data || []).map((row: any) => ({
        subscription_id: row.subscription_id,
        invoice_id: row.invoice_id,
        amount: Number(row.amount || 0)
      }));
    } catch (error: any) {
      console.error('Error in rpcGenerateMonthlyInvoices:', error);
      throw new Error(error.message || 'Failed to generate monthly invoices');
    }
  }
}
