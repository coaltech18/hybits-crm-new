// ============================================================================
// PLAN CARD COMPONENT
// ============================================================================

import React from 'react';
import { Plan } from '@/types/billing';
import Button from '@/components/ui/Button';
import Icon from '@/components/AppIcon';

interface PlanCardProps {
  plan: Plan;
  onSubscribe?: (planId: string) => void;
  onEdit?: (plan: Plan) => void;
  onDelete?: (planId: string) => void;
  isCurrentPlan?: boolean;
  isAdmin?: boolean;
  loading?: boolean;
}

const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  onSubscribe,
  onEdit,
  onDelete,
  isCurrentPlan = false,
  isAdmin = false,
  loading = false
}) => {
  const handleSubscribe = () => {
    if (onSubscribe && !loading) {
      onSubscribe(plan.id);
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(plan);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(plan.id);
    }
  };

  const isPopular = plan.id === 'pro';

  return (
    <div className={`relative bg-card border rounded-lg p-6 transition-all duration-200 hover:shadow-lg ${
      isCurrentPlan ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'
    } ${isPopular ? 'ring-2 ring-primary/30' : ''}`}>
      {/* Popular badge */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium">
            Most Popular
          </span>
        </div>
      )}

      {/* Current plan badge */}
      {isCurrentPlan && (
        <div className="absolute -top-3 right-4">
          <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
            Current Plan
          </span>
        </div>
      )}

      <div className="text-center">
        {/* Plan name */}
        <h3 className="text-xl font-bold text-foreground mb-2">{plan.name}</h3>
        
        {/* Description */}
        {plan.description && (
          <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
        )}

        {/* Price */}
        <div className="mb-6">
          <div className="flex items-baseline justify-center">
            <span className="text-3xl font-bold text-foreground">₹{plan.price.toLocaleString()}</span>
            <span className="text-muted-foreground ml-1">/{plan.interval}</span>
          </div>
        </div>

        {/* Features */}
        <div className="mb-6">
          <ul className="space-y-3 text-sm">
            {plan.features.map((feature, index) => (
              <li key={index} className="flex items-center text-left">
                <Icon name="check" size={16} className="text-green-500 mr-3 flex-shrink-0" />
                <span className="text-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {!isAdmin && (
            <Button
              onClick={handleSubscribe}
              disabled={isCurrentPlan || loading}
              loading={loading}
              variant={isCurrentPlan ? 'outline' : 'primary'}
              className="w-full"
            >
              {isCurrentPlan ? 'Current Plan' : 'Subscribe'}
            </Button>
          )}

          {isAdmin && (
            <div className="flex space-x-2">
              <Button
                onClick={handleEdit}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <Icon name="edit" size={16} className="mr-2" />
                Edit
              </Button>
              <Button
                onClick={handleDelete}
                variant="destructive"
                size="sm"
                className="flex-1"
              >
                <Icon name="trash" size={16} className="mr-2" />
                Delete
              </Button>
            </div>
          )}
        </div>

        {/* Status indicator for admin */}
        {isAdmin && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${
                plan.active ? 'bg-green-500' : 'bg-gray-400'
              }`} />
              <span className="text-xs text-muted-foreground">
                {plan.active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanCard;
