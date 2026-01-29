import { useState, useEffect } from 'react';
import { Activity, Download, Filter } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getActivityLogs,
  exportActivityLogsCSV,
  getActivityModules,
  getActivityActionTypes,
  getActivityLogStats,
  type ActivityLogEntry,
  type ActivityLogFilters,
} from '@/services/activityLogService';

// ================================================================
// ACTIVITY LOGS PAGE (ADMIN + ACCOUNTANT + MANAGER)
// ================================================================
// Unified audit trail with role-based filtering
// ================================================================

export default function ActivityLogsPage() {
  const { user, outlets } = useAuth();
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Stats
  const [stats, setStats] = useState({ total_activities: 0, unique_users: 0, modules_active: 0 });

  // Filters
  const [filters, setFilters] = useState<ActivityLogFilters>({
    outlet_id: '',
    user_id: '',
    module: '',
    action_type: '',
    date_from: '',
    date_to: '',
  });

  // Filter options
  const [modules, setModules] = useState<string[]>([]);
  const [actionTypes, setActionTypes] = useState<string[]>([]);

  const userRole = user?.role || '';
  const showOutletFilter = userRole === 'admin' || userRole === 'accountant';
  const availableOutlets = outlets || [];

  useEffect(() => {
    if (user?.id) {
      loadLogs();
      loadFilterOptions();
    }
  }, [user, filters]);

  async function loadLogs() {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      const [logsData, statsData] = await Promise.all([
        getActivityLogs(user.id, filters),
        getActivityLogStats(user.id, filters),
      ]);

      setLogs(logsData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }

  async function loadFilterOptions() {
    if (!user?.id) return;

    try {
      const [modulesData, actionsData] = await Promise.all([
        getActivityModules(user.id),
        getActivityActionTypes(user.id, filters.module),
      ]);

      setModules(modulesData);
      setActionTypes(actionsData);
    } catch (err) {
      console.error('Failed to load filter options:', err);
    }
  }

  async function handleExportCSV() {
    if (!user?.id) return;

    try {
      setExporting(true);
      const csv = await exportActivityLogsCSV(user.id, filters);

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `activity-logs-${new Date().toISOString().split('T')[0]}.csv`
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export CSV');
    } finally {
      setExporting(false);
    }
  }

  function clearFilters() {
    setFilters({
      outlet_id: '',
      user_id: '',
      module: '',
      action_type: '',
      date_from: '',
      date_to: '',
    });
  }

  const getModuleBadgeColor = (module: string) => {
    switch (module) {
      case 'inventory':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'payment':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'subscription':
        return 'bg-brand-primary/20 text-brand-primary';
      case 'event':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'invoice':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-brand-border/50 text-brand-text';
    }
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-4 text-brand-text/70">Loading activity logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="w-8 h-8" />
            Activity Logs
          </h1>
          <p className="text-brand-text/70 mt-1">
            Unified audit trail across all system modules
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={logs.length === 0 || exporting}
          className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primaryDark disabled:opacity-50"
        >
          <Download className="w-5 h-5" />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-brand-border">
          <p className="text-sm text-brand-text/70">Total Activities</p>
          <p className="text-2xl font-bold">{stats.total_activities}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-brand-border">
          <p className="text-sm text-brand-text/70">Unique Users</p>
          <p className="text-2xl font-bold text-brand-primary">{stats.unique_users}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-brand-border">
          <p className="text-sm text-brand-text/70">Active Modules</p>
          <p className="text-2xl font-bold text-purple-600">{stats.modules_active}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-brand-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </h3>
          <button
            onClick={clearFilters}
            className="text-sm text-brand-primary hover:text-brand-primaryDark"
          >
            Clear Filters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Outlet Filter (Admin/Accountant only) */}
          {showOutletFilter && (
            <div>
              <label className="block text-sm font-medium mb-1">Outlet</label>
              <select
                value={filters.outlet_id}
                onChange={(e) => setFilters({ ...filters, outlet_id: e.target.value })}
                className="w-full px-3 py-2 border border-brand-border rounded-md bg-white"
              >
                <option value="">All Outlets</option>
                {availableOutlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Module Filter */}
          <div>
            <label className="block text-sm font-medium mb-1">Module</label>
            <select
              value={filters.module}
              onChange={(e) => setFilters({ ...filters, module: e.target.value })}
              className="w-full px-3 py-2 border border-brand-border rounded-md bg-white"
            >
              <option value="">All Modules</option>
              {modules.map((mod) => (
                <option key={mod} value={mod}>
                  {mod.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Action Type Filter */}
          <div>
            <label className="block text-sm font-medium mb-1">Action Type</label>
            <select
              value={filters.action_type}
              onChange={(e) => setFilters({ ...filters, action_type: e.target.value })}
              className="w-full px-3 py-2 border border-brand-border rounded-md bg-white"
            >
              <option value="">All Actions</option>
              {actionTypes.map((action) => (
                <option key={action} value={action}>
                  {action.replace(/_/g, ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-sm font-medium mb-1">From Date</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              className="w-full px-3 py-2 border border-brand-border rounded-md bg-white"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm font-medium mb-1">To Date</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              className="w-full px-3 py-2 border border-brand-border rounded-md bg-white"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg border border-brand-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-brand-bg border-b border-brand-border">
              <tr>
                <th className="text-left py-3 px-4 font-medium">Date/Time</th>
                <th className="text-left py-3 px-4 font-medium">User</th>
                {showOutletFilter && <th className="text-left py-3 px-4 font-medium">Outlet</th>}
                <th className="text-left py-3 px-4 font-medium">Module</th>
                <th className="text-left py-3 px-4 font-medium">Action</th>
                <th className="text-left py-3 px-4 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {logs.map((log, idx) => (
                <tr key={idx} className="hover:bg-brand-primary/5">
                  <td className="py-3 px-4 text-sm">
                    <div>
                      <p>{new Date(log.occurred_at).toLocaleDateString()}</p>
                      <p className="text-xs text-brand-text/70">
                        {new Date(log.occurred_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm">{log.user_name || 'System'}</td>
                  {showOutletFilter && (
                    <td className="py-3 px-4 text-sm text-brand-text/70">
                      {log.outlet_name}
                    </td>
                  )}
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getModuleBadgeColor(
                        log.module
                      )}`}
                    >
                      {log.module.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs font-mono">
                    {log.action_type.replace(/_/g, ' ').toUpperCase()}
                  </td>
                  <td className="py-3 px-4 text-sm max-w-md truncate">{log.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {logs.length === 0 && !loading && (
          <div className="text-center py-12 text-brand-text/70">
            No activity logs found for the selected filters
          </div>
        )}
      </div>
    </div>
  );
}
