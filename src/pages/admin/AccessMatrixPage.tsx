import { useState, useEffect } from 'react';
import { Shield, Check, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// ================================================================
// ACCESS MATRIX PAGE (ADMIN + ACCOUNTANT)
// ================================================================
// Read-only role-based permission matrix
// ================================================================

interface PermissionRow {
  role: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export default function AccessMatrixPage() {
  const { user } = useAuth();
  const [matrix, setMatrix] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMatrix();
  }, [user]);

  async function loadMatrix() {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('admin_role_permission_matrix')
        .select('*')
        .order('role')
        .order('module');

      if (fetchError) throw fetchError;

      setMatrix(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load permission matrix');
    } finally {
      setLoading(false);
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-brand-deep/20 text-brand-deep';
      case 'manager':
        return 'bg-brand-primary/20 text-brand-primary';
      case 'accountant':
        return 'bg-brand-primary/20 text-brand-primary';
      default:
        return 'bg-brand-border/50 text-brand-text';
    }
  };

  const getModuleDisplayName = (module: string) => {
    return module
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-4 text-brand-text/70">Loading access matrix...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="w-8 h-8" />
          Access Control Matrix
        </h1>
        <p className="text-brand-text/70 mt-1">
          Read-only permission matrix showing role-based access control
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Info Banner */}
      <div className="p-4 bg-brand-primary/10 border border-brand-primary/30 rounded">
        <h3 className="font-semibold text-brand-text mb-2">
          ℹ️ About This Matrix
        </h3>
        <ul className="text-sm text-brand-text space-y-1 list-disc list-inside">
          <li>This matrix reflects the actual enforced permissions in the system</li>
          <li>Permissions are hardcoded and cannot be edited</li>
          <li>
            <strong>Manager</strong> permissions are further restricted to assigned outlets only
          </li>
          <li>
            <strong>Accountant</strong> has read-only access across all modules
          </li>
        </ul>
      </div>

      {/* Matrix by Role */}
      {['admin', 'manager', 'accountant'].map((role) => {
        const rolePermissions = matrix.filter((p) => p.role === role);

        return (
          <div
            key={role}
            className="bg-white rounded-lg border border-brand-border overflow-hidden"
          >
            {/* Role Header */}
            <div className="p-4 bg-brand-bg border-b border-brand-border">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(
                  role
                )}`}
              >
                {role.toUpperCase()}
              </span>
              {role === 'manager' && (
                <span className="ml-3 text-sm text-brand-text/70">
                  (Outlet-scoped access)
                </span>
              )}
              {role === 'accountant' && (
                <span className="ml-3 text-sm text-brand-text/70">
                  (Read-only across all outlets)
                </span>
              )}
            </div>

            {/* Permissions Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-brand-bg border-b border-brand-border">
                  <tr>
                    <th className="text-left py-2 px-4 font-medium w-1/3">Module</th>
                    <th className="text-center py-2 px-4 font-medium">View</th>
                    <th className="text-center py-2 px-4 font-medium">Create</th>
                    <th className="text-center py-2 px-4 font-medium">Edit</th>
                    <th className="text-center py-2 px-4 font-medium">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {rolePermissions.map((perm, idx) => (
                    <tr key={idx} className="hover:bg-brand-primary/5">
                      <td className="py-2 px-4 font-medium">
                        {getModuleDisplayName(perm.module)}
                      </td>
                      <td className="py-2 px-4 text-center">
                        {perm.can_view ? (
                          <Check className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-red-400 mx-auto" />
                        )}
                      </td>
                      <td className="py-2 px-4 text-center">
                        {perm.can_create ? (
                          <Check className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-red-400 mx-auto" />
                        )}
                      </td>
                      <td className="py-2 px-4 text-center">
                        {perm.can_edit ? (
                          <Check className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-red-400 mx-auto" />
                        )}
                      </td>
                      <td className="py-2 px-4 text-center">
                        {perm.can_delete ? (
                          <Check className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-red-400 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="bg-brand-bg p-4 rounded-lg border border-brand-border">
        <h3 className="font-semibold mb-3">Legend</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            <span>Permission granted</span>
          </div>
          <div className="flex items-center gap-2">
            <X className="w-5 h-5 text-red-400" />
            <span>Permission denied</span>
          </div>
        </div>
      </div>
    </div>
  );
}
