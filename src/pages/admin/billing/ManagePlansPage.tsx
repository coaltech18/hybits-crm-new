// ============================================================================
// MANAGE PLANS PAGE (ADMIN)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Plan, PlanFormData, BillingStats } from '@/types/billing';
import { BillingService } from '@/services/billingService';
import PlanCard from '@/components/billing/PlanCard';
import PlanFormModal from '@/components/billing/PlanFormModal';
import Button from '@/components/ui/Button';
import Icon from '@/components/AppIcon';

const ManagePlansPage: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [plansData, statsData] = await Promise.all([
        BillingService.getAllPlans(),
        BillingService.getBillingStats()
      ]);

      setPlans(plansData);
      setStats(statsData);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = () => {
    setEditingPlan(null);
    setIsModalOpen(true);
  };

  const handleEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setIsModalOpen(true);
  };

  const handleDeletePlan = async (planId: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this plan? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);
      setError(null);

      await BillingService.deletePlan(planId);
      
      // Reload data
      await loadData();
      
      alert('Plan deleted successfully.');
    } catch (err: any) {
      console.error('Error deleting plan:', err);
      setError(err.message || 'Failed to delete plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitPlan = async (formData: PlanFormData) => {
    try {
      setActionLoading(true);
      setError(null);

      if (editingPlan) {
        await BillingService.updatePlan(editingPlan.id, formData);
      } else {
        await BillingService.createPlan(formData);
      }

      // Reload data
      await loadData();
      
      alert(`Plan ${editingPlan ? 'updated' : 'created'} successfully.`);
    } catch (err: any) {
      console.error('Error submitting plan:', err);
      setError(err.message || `Failed to ${editingPlan ? 'update' : 'create'} plan`);
      throw err; // Re-throw to prevent modal from closing
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Manage Plans</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage subscription plans
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Manage Plans</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage subscription plans
          </p>
        </div>
        
        <Button onClick={handleCreatePlan}>
          <Icon name="plus" size={20} className="mr-2" />
          Create Plan
        </Button>
      </div>

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

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Plans</p>
                <p className="text-2xl font-bold text-foreground mt-1">{stats.totalPlans}</p>
              </div>
              <Icon name="layers" size={24} className="text-blue-600" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Subscriptions</p>
                <p className="text-2xl font-bold text-foreground mt-1">{stats.activeSubscriptions}</p>
              </div>
              <Icon name="users" size={24} className="text-green-600" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  ₹{stats.totalRevenue.toLocaleString()}
                </p>
              </div>
              <Icon name="dollar-sign" size={24} className="text-purple-600" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Invoices</p>
                <p className="text-2xl font-bold text-foreground mt-1">{stats.pendingInvoices}</p>
              </div>
              <Icon name="clock" size={24} className="text-orange-600" />
            </div>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      {plans.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">All Plans</h2>
            <div className="text-sm text-muted-foreground">
              {plans.filter(p => p.active).length} active, {plans.filter(p => !p.active).length} inactive
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onEdit={handleEditPlan}
                onDelete={handleDeletePlan}
                isAdmin={true}
                loading={actionLoading}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <Icon name="layers" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Plans Created</h3>
          <p className="text-muted-foreground mb-4">
            Create your first subscription plan to start accepting payments.
          </p>
          <Button onClick={handleCreatePlan}>
            <Icon name="plus" size={20} className="mr-2" />
            Create First Plan
          </Button>
        </div>
      )}

      {/* Plan Analytics */}
      {plans.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Plan Performance</h3>
          <div className="space-y-4">
            {plans.filter(p => p.active).map((plan) => {
              // Mock subscription count for each plan
              const subscriptionCount = plan.id === 'pro' ? 3 : plan.id === 'basic' ? 2 : 1;
              const revenue = subscriptionCount * plan.price;
              
              return (
                <div key={plan.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-primary mr-3"></div>
                    <div>
                      <h4 className="font-medium text-foreground">{plan.name}</h4>
                      <p className="text-sm text-muted-foreground">₹{plan.price}/{plan.interval}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-foreground">
                      {subscriptionCount} subscribers
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ₹{revenue.toLocaleString()} revenue
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Plan Form Modal */}
      <PlanFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitPlan}
        plan={editingPlan}
        loading={actionLoading}
      />
    </div>
  );
};

export default ManagePlansPage;
