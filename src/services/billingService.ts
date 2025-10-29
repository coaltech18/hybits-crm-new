// ============================================================================
// BILLING SERVICE
// ============================================================================

import { 
  Plan, 
  Subscription, 
  Invoice, 
  PlanFormData, 
  SubscriptionFormData, 
  BillingStats,
  Vendor,
  VendorSubscription,
  SubscriptionEntryFormData,
  SubscriptionCalculation
} from '@/types/billing';
import { mockPlans, mockSubscriptions, mockInvoices, mockUsers } from './mockBillingData';

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
      
      mockPlans[planIndex] = {
        ...mockPlans[planIndex],
        ...planData,
        updated_at: new Date().toISOString()
      };
      
      return mockPlans[planIndex];
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
      
      mockPlans[planIndex].active = false;
      mockPlans[planIndex].updated_at = new Date().toISOString();
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
          user_name: user?.name,
          user_email: user?.email
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
        mockSubscriptions[existingIndex].status = 'canceled';
        mockSubscriptions[existingIndex].updated_at = new Date().toISOString();
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
      
      mockSubscriptions[subscriptionIndex].status = 'canceled';
      mockSubscriptions[subscriptionIndex].updated_at = new Date().toISOString();
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
          user_name: user?.name,
          user_email: user?.email
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
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock vendors data
      const mockVendors: Vendor[] = [
        {
          id: 'vendor1',
          name: 'Rasoi Ghar',
          contact_person: 'Rajesh Kumar',
          email: 'rajesh@rasoighar.com',
          phone: '+91 98765 43210',
          address: '123 Main Street, Mumbai',
          gstin: '27ABCDE1234F1Z5',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'vendor2',
          name: 'Spice Kitchen',
          contact_person: 'Priya Sharma',
          email: 'priya@spicekitchen.com',
          phone: '+91 87654 32109',
          address: '456 Park Avenue, Delhi',
          gstin: '07FGHIJ5678K2L6',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'vendor3',
          name: 'Royal Caterers',
          contact_person: 'Amit Singh',
          email: 'amit@royalcaterers.com',
          phone: '+91 76543 21098',
          address: '789 Business District, Bangalore',
          gstin: '29KLMNO9012P3Q7',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];
      
      return mockVendors;
    } catch (error: any) {
      console.error('Error in getVendors:', error);
      throw new Error(error.message || 'Failed to fetch vendors');
    }
  }

  /**
   * Calculate subscription values
   */
  static calculateSubscription(
    items: { price_per_piece: number; quantity: number }[],
    planType: '30k' | '40k' | '60k' | 'custom',
    manualDeposit?: number
  ): SubscriptionCalculation {
    const totalDishValue = items.reduce((sum, item) => sum + (item.price_per_piece * item.quantity), 0);
    const depositAuto = totalDishValue * 0.5; // 50% of total dish value
    const finalDeposit = manualDeposit !== undefined ? manualDeposit : depositAuto;
    
    // Set monthly fee based on plan type
    const monthlyFees = {
      '30k': 30000,
      '40k': 40000,
      '60k': 60000,
      'custom': 0
    };

    return {
      total_dish_value: totalDishValue,
      deposit_auto: depositAuto,
      deposit_manual: manualDeposit,
      final_deposit: finalDeposit,
      monthly_fee: monthlyFees[planType]
    };
  }

  /**
   * Create a new vendor subscription
   */
  static async createVendorSubscription(
    formData: SubscriptionEntryFormData,
    items: { name: string; size: string; price_per_piece: number; quantity: number }[]
  ): Promise<VendorSubscription> {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const vendor = await this.getVendorById(formData.vendor_id);
      const calculation = this.calculateSubscription(
        items,
        formData.plan_type,
        formData.deposit_manual
      );

      const subscriptionItems = items.map((item, index) => ({
        id: `item_${Date.now()}_${index}`,
        name: item.name,
        size: item.size,
        price_per_piece: item.price_per_piece,
        quantity: item.quantity,
        total: item.price_per_piece * item.quantity
      }));

      const newSubscription: VendorSubscription = {
        id: `sub_${Date.now()}`,
        vendor_id: formData.vendor_id,
        vendor_name: vendor.name,
        plan_type: formData.plan_type,
        subscription_start: formData.subscription_start,
        items: subscriptionItems,
        total_dish_value: calculation.total_dish_value,
        deposit_auto: calculation.deposit_auto,
        deposit_manual: calculation.deposit_manual,
        final_deposit: calculation.final_deposit,
        monthly_fee: calculation.monthly_fee,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // In a real app, this would save to Supabase
      console.log('Created vendor subscription:', newSubscription);
      
      return newSubscription;
    } catch (error: any) {
      console.error('Error in createVendorSubscription:', error);
      throw new Error(error.message || 'Failed to create vendor subscription');
    }
  }

  /**
   * Get vendor by ID
   */
  static async getVendorById(vendorId: string): Promise<Vendor> {
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const vendors = await this.getVendors();
      const vendor = vendors.find(v => v.id === vendorId);
      
      if (!vendor) {
        throw new Error('Vendor not found');
      }
      
      return vendor;
    } catch (error: any) {
      console.error('Error in getVendorById:', error);
      throw new Error(error.message || 'Failed to fetch vendor');
    }
  }

  /**
   * Get all vendor subscriptions
   */
  static async getVendorSubscriptions(): Promise<VendorSubscription[]> {
    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Mock vendor subscriptions data
      const mockVendorSubscriptions: VendorSubscription[] = [
        {
          id: 'vsub1',
          vendor_id: 'vendor1',
          vendor_name: 'Rasoi Ghar',
          plan_type: '30k',
          subscription_start: '2024-01-01',
          items: [
            {
              id: 'item1',
              name: 'SS Idly Plate',
              size: '6.5',
              price_per_piece: 72,
              quantity: 100,
              total: 7200
            },
            {
              id: 'item2',
              name: 'SS Vade Plate',
              size: '9',
              price_per_piece: 67,
              quantity: 100,
              total: 6700
            }
          ],
          total_dish_value: 13900,
          deposit_auto: 6950,
          deposit_manual: 5000,
          final_deposit: 5000,
          monthly_fee: 30000,
          status: 'active',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];
      
      return mockVendorSubscriptions;
    } catch (error: any) {
      console.error('Error in getVendorSubscriptions:', error);
      throw new Error(error.message || 'Failed to fetch vendor subscriptions');
    }
  }
}
