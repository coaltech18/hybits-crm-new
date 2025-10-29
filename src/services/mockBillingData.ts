// ============================================================================
// MOCK BILLING DATA
// ============================================================================

import { Plan, Subscription, Invoice } from '@/types/billing';

export const mockPlans: Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: 499,
    interval: 'monthly',
    features: [
      'CRM Access',
      'Basic Reports',
      'Up to 100 Customers',
      'Email Support',
      'Single Outlet'
    ],
    active: true,
    description: 'Perfect for small businesses getting started',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 999,
    interval: 'monthly',
    features: [
      'All Basic Features',
      'Advanced Analytics',
      'Multi-Outlet Support',
      'Unlimited Customers',
      'Priority Support',
      'Custom Reports',
      'API Access'
    ],
    active: true,
    description: 'Ideal for growing businesses with multiple locations',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 1999,
    interval: 'monthly',
    features: [
      'Everything in Pro',
      'Advanced Dashboard',
      'White-label Solution',
      'Dedicated Account Manager',
      '24/7 Phone Support',
      'Custom Integrations',
      'Advanced Security Features',
      'Data Export & Backup'
    ],
    active: true,
    description: 'Enterprise-grade solution for large organizations',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 4999,
    interval: 'monthly',
    features: [
      'Everything in Premium',
      'Unlimited Outlets',
      'Custom Development',
      'On-premise Deployment',
      'SLA Guarantee',
      'Training & Onboarding',
      'Compliance Support'
    ],
    active: false,
    description: 'Custom solution for enterprise needs',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
];

export const mockSubscriptions: Subscription[] = [
  {
    id: 'sub1',
    user_id: 'user1',
    plan_id: 'pro',
    plan_name: 'Pro',
    status: 'active',
    start_date: '2024-10-01T00:00:00Z',
    end_date: '2024-11-01T00:00:00Z',
    next_billing_date: '2024-11-01T00:00:00Z',
    created_at: '2024-10-01T00:00:00Z',
    updated_at: '2024-10-01T00:00:00Z'
  },
  {
    id: 'sub2',
    user_id: 'user2',
    plan_id: 'basic',
    plan_name: 'Basic',
    status: 'active',
    start_date: '2024-09-15T00:00:00Z',
    end_date: '2024-10-15T00:00:00Z',
    next_billing_date: '2024-10-15T00:00:00Z',
    created_at: '2024-09-15T00:00:00Z',
    updated_at: '2024-09-15T00:00:00Z'
  },
  {
    id: 'sub3',
    user_id: 'user3',
    plan_id: 'premium',
    plan_name: 'Premium',
    status: 'trialing',
    start_date: '2024-10-20T00:00:00Z',
    end_date: '2024-11-20T00:00:00Z',
    next_billing_date: '2024-11-03T00:00:00Z',
    created_at: '2024-10-20T00:00:00Z',
    updated_at: '2024-10-20T00:00:00Z'
  },
  {
    id: 'sub4',
    user_id: 'user4',
    plan_id: 'basic',
    plan_name: 'Basic',
    status: 'canceled',
    start_date: '2024-08-01T00:00:00Z',
    end_date: '2024-09-01T00:00:00Z',
    created_at: '2024-08-01T00:00:00Z',
    updated_at: '2024-09-01T00:00:00Z'
  },
  {
    id: 'sub5',
    user_id: 'user5',
    plan_id: 'pro',
    plan_name: 'Pro',
    status: 'expired',
    start_date: '2024-07-01T00:00:00Z',
    end_date: '2024-08-01T00:00:00Z',
    created_at: '2024-07-01T00:00:00Z',
    updated_at: '2024-08-01T00:00:00Z'
  }
];

export const mockInvoices: Invoice[] = [
  {
    id: 'inv1',
    subscription_id: 'sub1',
    amount: 999,
    due_date: '2024-11-01T00:00:00Z',
    status: 'pending',
    created_at: '2024-10-01T00:00:00Z',
    invoice_number: 'INV-2024-001',
    description: 'Pro Plan - Monthly Subscription'
  },
  {
    id: 'inv2',
    subscription_id: 'sub2',
    amount: 499,
    due_date: '2024-10-15T00:00:00Z',
    status: 'paid',
    created_at: '2024-09-15T00:00:00Z',
    invoice_number: 'INV-2024-002',
    description: 'Basic Plan - Monthly Subscription'
  },
  {
    id: 'inv3',
    subscription_id: 'sub1',
    amount: 999,
    due_date: '2024-10-01T00:00:00Z',
    status: 'paid',
    created_at: '2024-09-01T00:00:00Z',
    invoice_number: 'INV-2024-003',
    description: 'Pro Plan - Monthly Subscription'
  },
  {
    id: 'inv4',
    subscription_id: 'sub3',
    amount: 1999,
    due_date: '2024-11-03T00:00:00Z',
    status: 'pending',
    created_at: '2024-10-20T00:00:00Z',
    invoice_number: 'INV-2024-004',
    description: 'Premium Plan - Monthly Subscription'
  },
  {
    id: 'inv5',
    subscription_id: 'sub2',
    amount: 499,
    due_date: '2024-09-10T00:00:00Z',
    status: 'overdue',
    created_at: '2024-08-15T00:00:00Z',
    invoice_number: 'INV-2024-005',
    description: 'Basic Plan - Monthly Subscription'
  }
];

// Mock user data for admin views
export const mockUsers = [
  { id: 'user1', name: 'John Doe', email: 'john@example.com' },
  { id: 'user2', name: 'Jane Smith', email: 'jane@example.com' },
  { id: 'user3', name: 'Mike Johnson', email: 'mike@example.com' },
  { id: 'user4', name: 'Sarah Wilson', email: 'sarah@example.com' },
  { id: 'user5', name: 'David Brown', email: 'david@example.com' }
];
