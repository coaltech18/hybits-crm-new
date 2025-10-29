// ============================================================================
// PLANS PAGE
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Plan, Subscription } from '@/types/billing';
import { BillingService } from '@/services/billingService';
import PlanCard from '@/components/billing/PlanCard';
import Icon from '@/components/AppIcon';

const PlansPage: React.FC = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [plansData, subscriptionData] = await Promise.all([
        BillingService.getPlans(),
        user ? BillingService.getUserSubscription(user.id) : Promise.resolve(null)
      ]);

      setPlans(plansData);
      setCurrentSubscription(subscriptionData);
    } catch (err: any) {
      console.error('Error loading plans:', err);
      setError(err.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (!user) return;

    try {
      setSubscribing(planId);
      setError(null);

      await BillingService.createSubscription(planId, user.id);
      
      // Reload data to get updated subscription
      await loadData();
      
      // Show success message (you could use a toast notification here)
      alert('Successfully subscribed to the plan!');
    } catch (err: any) {
      console.error('Error subscribing to plan:', err);
      setError(err.message || 'Failed to subscribe to plan');
    } finally {
      setSubscribing(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">Subscription Plans</h1>
          <p className="text-muted-foreground mt-2">
            Choose the perfect plan for your business needs
          </p>
        </div>
        
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground">Subscription Plans</h1>
        <p className="text-muted-foreground mt-2">
          Choose the perfect plan for your business needs
        </p>
      </div>

      {/* Current Subscription Alert */}
      {currentSubscription && currentSubscription.status === 'active' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center">
            <Icon name="info" size={20} className="text-blue-600 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Current Subscription
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                You are currently subscribed to the {currentSubscription.plan_name} plan.
                Subscribing to a new plan will replace your current subscription.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <Icon name="alert-triangle" size={20} className="text-red-600 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Error
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      {plans.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onSubscribe={handleSubscribe}
              isCurrentPlan={currentSubscription?.plan_id === plan.id && currentSubscription.status === 'active'}
              loading={subscribing === plan.id}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Icon name="credit-card" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Plans Available</h3>
          <p className="text-muted-foreground">
            There are currently no subscription plans available. Please check back later.
          </p>
        </div>
      )}

      {/* Features Comparison */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Why Choose Our CRM?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
              <Icon name="users" size={24} className="text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Customer Management</h3>
            <p className="text-sm text-muted-foreground">
              Organize and manage all your customer relationships in one place
            </p>
          </div>
          
          <div className="text-center">
            <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
              <Icon name="bar-chart" size={24} className="text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Analytics & Reports</h3>
            <p className="text-sm text-muted-foreground">
              Get insights into your business performance with detailed analytics
            </p>
          </div>
          
          <div className="text-center">
            <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
              <Icon name="shield" size={24} className="text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Secure & Reliable</h3>
            <p className="text-sm text-muted-foreground">
              Your data is protected with enterprise-grade security measures
            </p>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-foreground mb-1">Can I change my plan anytime?</h3>
            <p className="text-sm text-muted-foreground">
              Yes, you can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.
            </p>
          </div>
          
          <div>
            <h3 className="font-medium text-foreground mb-1">Is there a free trial?</h3>
            <p className="text-sm text-muted-foreground">
              Yes, all plans come with a 14-day free trial. No credit card required to start.
            </p>
          </div>
          
          <div>
            <h3 className="font-medium text-foreground mb-1">What payment methods do you accept?</h3>
            <p className="text-sm text-muted-foreground">
              We accept all major credit cards, debit cards, and UPI payments. All transactions are secure and encrypted.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlansPage;
