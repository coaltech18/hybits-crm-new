// ============================================================================
// PERMISSIONS UTILITY
// ============================================================================

import { UserRole, RolePermissions } from '@/types';

// Define role-based permissions
export const ROLE_PERMISSIONS: RolePermissions = {
  admin: [
    { resource: 'dashboard', actions: ['read'] },
    { resource: 'inventory', actions: ['read', 'create', 'update', 'delete'] },
    { resource: 'customers', actions: ['read', 'create', 'update', 'delete'] },
    { resource: 'orders', actions: ['read', 'create', 'update', 'delete'] },
    { resource: 'billing', actions: ['read', 'create', 'update', 'delete'] },
    { resource: 'locations', actions: ['read', 'create', 'update', 'delete'] },
    { resource: 'outlets', actions: ['read', 'create', 'update', 'delete'] },
    { resource: 'users', actions: ['read', 'create', 'update', 'delete'] },
    { resource: 'settings', actions: ['read', 'update'] },
    { resource: 'reports', actions: ['read', 'export'] },
    { resource: 'analytics', actions: ['read'] },
  ],
  manager: [
    { resource: 'dashboard', actions: ['read'] },
    { resource: 'inventory', actions: ['read', 'create', 'update'] },
    { resource: 'customers', actions: ['read', 'create', 'update'] },
    { resource: 'orders', actions: ['read', 'create', 'update'] },
    { resource: 'billing', actions: ['read', 'create', 'update'] },
    { resource: 'locations', actions: ['read'] },
    { resource: 'outlets', actions: ['read'] },
    { resource: 'settings', actions: ['read'] },
    { resource: 'reports', actions: ['read'] },
    { resource: 'analytics', actions: ['read'] },
  ],
  accountant: [
    { resource: 'accounting', actions: ['read', 'create', 'update', 'export'] },
    { resource: 'vendors', actions: ['read'] },
    { resource: 'reports', actions: ['read', 'export'] },
  ],
};

// Check if user has permission for a specific resource and action
export function hasPermission(
  userRole: UserRole,
  resource: string,
  action: string
): boolean {
  const permissions = ROLE_PERMISSIONS[userRole];
  // Handle missing roles gracefully
  if (!permissions) return false;

  const resourcePermission = permissions.find(p => p.resource === resource);
  if (!resourcePermission) return false;

  return resourcePermission.actions.includes(action);
}

// Check if user can access a specific outlet
export function canAccessOutlet(
  userRole: UserRole,
  userOutletId: string | undefined,
  targetOutletId: string
): boolean {
  // Admin can access all outlets
  if (userRole === 'admin') return true;
  
  // Manager and accountant can only access their assigned outlet
  if (userRole === 'manager' || userRole === 'accountant') {
    return userOutletId === targetOutletId;
  }
  
  return false;
}

// Get all resources user can access
export function getUserResources(userRole: UserRole): string[] {
  const permissions = ROLE_PERMISSIONS[userRole];
  if (!permissions) return [];
  
  return permissions.map(p => p.resource);
}

// Get all actions user can perform on a resource
export function getUserActions(userRole: UserRole, resource: string): string[] {
  const permissions = ROLE_PERMISSIONS[userRole];
  if (!permissions) return [];
  
  const resourcePermission = permissions.find(p => p.resource === resource);
  if (!resourcePermission) return [];
  
  return resourcePermission.actions;
}

// Check if user is admin
export function isAdmin(userRole: UserRole): boolean {
  return userRole === 'admin';
}

// Check if user is manager
export function isManager(userRole: UserRole): boolean {
  return userRole === 'manager';
}
