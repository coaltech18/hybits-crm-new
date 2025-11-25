// ============================================================================
// USERS PAGE
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/AppIcon';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { User, UserRole } from '@/types';
import { AuthService } from '@/services/AuthService';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { exportData, formatDateForExport } from '@/utils/exportUtils';

const UsersPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<'active' | 'inactive' | ''>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const roleOptions = [
    { value: '', label: 'All Roles' },
    { value: 'admin', label: 'Admin' },
    { value: 'manager', label: 'Manager' }
  ];

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const fetchedUsers = await AuthService.getAllUsers();
      setUsers(fetchedUsers);
    } catch (err) {
      console.error('Failed to load users', err);
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch =
        (user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
        (user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesRole = !selectedRole || user.role === selectedRole;
    const matchesStatus = !selectedStatus || 
      (selectedStatus === 'active' && user.is_active) ||
      (selectedStatus === 'inactive' && !user.is_active);
    
    return matchesSearch && matchesRole && matchesStatus;
  });
  }, [users, searchTerm, selectedRole, selectedStatus]);

  const handleExport = () => {
    if (filteredUsers.length === 0) {
      alert('No users to export');
      return;
    }

    const headers = [
      'Email',
      'Full Name',
      'Role',
      'Phone',
      'Outlet',
      'Status',
      'Created At',
      'Updated At',
      'Last Login'
    ];

    const rows = filteredUsers.map(user => [
      user.email,
      user.full_name,
      user.role,
      user.phone || '',
      user.outlet_name || '',
      user.is_active ? 'Active' : 'Inactive',
      formatDateForExport(user.created_at),
      formatDateForExport(user.updated_at),
      formatDateForExport(user.last_login)
    ]);

    exportData([headers, ...rows], 'excel', {
      filename: `users_export_${new Date().toISOString().split('T')[0]}.xlsx`,
      sheetName: 'Users'
    });
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'manager': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Delete this user? This cannot be undone.')) return;
    try {
      setActionLoading(userId);
      await AuthService.deleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      console.error('Failed to delete user', err);
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (targetUser: User) => {
    try {
      setActionLoading(targetUser.id);
      const updated = await AuthService.toggleUserStatus(targetUser.id, !targetUser.is_active);
      setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
    } catch (err) {
      console.error('Failed to update user status', err);
      setError(err instanceof Error ? err.message : 'Failed to update user status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (targetUser: User) => {
    try {
      await AuthService.resetPassword(targetUser.email);
      alert(`Password reset email sent to ${targetUser.email}`);
    } catch (err) {
      console.error('Failed to send reset email', err);
      setError(err instanceof Error ? err.message : 'Failed to send password reset email');
    }
  };

  if (!currentUser || !hasPermission(currentUser.role, 'users', 'read')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Icon name="alert-triangle" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Access Denied</h3>
          <p className="text-muted-foreground">You do not have permission to view users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage system users and their permissions
          </p>
        </div>
        <Button onClick={() => navigate('/users/new')}>
          <Icon name="plus" size={20} className="mr-2" />
          Add User
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Input
              type="search"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <Select
              options={roleOptions}
              value={selectedRole}
              onChange={(value) => setSelectedRole(value as UserRole | '')}
              placeholder="All Roles"
            />
          </div>
          <div>
            <Select
              options={statusOptions}
              value={selectedStatus}
              onChange={(value) => setSelectedStatus(value as 'active' | 'inactive' | '')}
              placeholder="All Status"
            />
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" className="flex-1">
              <Icon name="filter" size={16} className="mr-2" />
              Filters
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={filteredUsers.length === 0}>
              <Icon name="download" size={16} />
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Users List */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Outlet
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                      <span>Loading users...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center space-y-3">
                      <Icon name="user" size={32} className="text-muted-foreground" />
                      <span>No users found. Try adjusting filters.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-muted/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center mr-3">
                        <span className="text-primary-foreground text-sm font-medium">
                          {user.full_name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {user.full_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-foreground">
                      {user.phone || 'Not provided'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-foreground">
                      {user.outlet_name || (user.role === 'admin' ? 'All Outlets' : 'Not assigned')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.is_active 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-foreground">
                      {user.last_login 
                        ? new Date(user.last_login).toLocaleDateString()
                        : 'Never'
                      }
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/users/new?user=${user.id}`)}
                        disabled={!!actionLoading}
                      >
                        <Icon name="edit" size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResetPassword(user)}
                        disabled={!!actionLoading}
                      >
                        <Icon name="key" size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(user)}
                        disabled={actionLoading === user.id}
                      >
                        <Icon name={user.is_active ? 'user-minus' : 'user-plus'} size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={actionLoading === user.id}
                      >
                        <Icon name="trash" size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {!isLoading && filteredUsers.length === 0 && (
        <div className="text-center py-12 space-y-3">
          <Icon name="user" size={48} className="mx-auto text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">No users found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search criteria or add new users.
          </p>
          <Button onClick={() => navigate('/users/new')}>
            <Icon name="plus" size={20} className="mr-2" />
            Add First User
          </Button>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
