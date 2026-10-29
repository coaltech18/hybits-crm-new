import {
  LayoutDashboard, Users, Repeat, CalendarCheck, FileText, Wallet, TrendingUp, Landmark,
  Package, Boxes, ArrowLeftRight, Send, ClipboardCheck, BarChart3,
  UserCog, Building2, Activity, Settings, type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
  /** Extra words the Ctrl+K palette matches on. */
  keywords?: string;
  /** Exact match only (otherwise any sub-path keeps it active). */
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const ALL: UserRole[] = ['admin', 'manager', 'accountant'];
const WRITERS: UserRole[] = ['admin', 'manager'];

// Every routed page is reachable from here (Principle 4: everything findable).
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ALL, keywords: 'home summary outstanding' }],
  },
  {
    label: 'Sales',
    items: [
      { to: '/clients', label: 'Clients', icon: Users, roles: ALL, keywords: 'customers corporate event gstin' },
      { to: '/subscriptions', label: 'Subscriptions', icon: Repeat, roles: ALL, keywords: 'recurring corporate plans' },
      { to: '/events', label: 'Events', icon: CalendarCheck, roles: ALL, keywords: 'wedding function booking' },
      { to: '/invoices', label: 'Invoices', icon: FileText, roles: ALL, keywords: 'bills tax gst finalize' },
      { to: '/payments', label: 'Payments', icon: Wallet, roles: ALL, keywords: 'receipts collections upi cash' },
    ],
  },
  {
    label: 'Dishware',
    items: [
      { to: '/inventory', label: 'Stock overview', icon: Package, roles: ALL, exact: true, keywords: 'inventory dishes' },
      { to: '/inventory/items', label: 'Items', icon: Boxes, roles: ALL, keywords: 'inventory plates bowls stock' },
      { to: '/inventory/allocate', label: 'Send & receive', icon: Send, roles: WRITERS, keywords: 'allocate dispatch return receive back' },
      { to: '/inventory/movements', label: 'Movements', icon: ArrowLeftRight, roles: ALL, keywords: 'ledger history damaged lost' },
      { to: '/inventory/audit', label: 'Stock audits', icon: ClipboardCheck, roles: ALL, keywords: 'count monthly approve' },
      { to: '/inventory/reports', label: 'Stock reports', icon: BarChart3, roles: ALL, keywords: 'inventory reports losses' },
    ],
  },
  {
    label: 'Accounts',
    items: [
      { to: '/reports', label: 'Reports', icon: TrendingUp, roles: ALL, exact: true, keywords: 'revenue aging outstanding' },
      { to: '/reports/gst-working', label: 'GST working', icon: Landmark, roles: ALL, keywords: 'gstr cgst sgst igst sez export filing' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/admin/users', label: 'Users', icon: UserCog, roles: ['admin'], keywords: 'staff roles access' },
      { to: '/admin/outlets', label: 'Outlets', icon: Building2, roles: ['admin'], keywords: 'branches' },
      { to: '/admin/activity-logs', label: 'Activity log', icon: Activity, roles: ['admin'], keywords: 'audit trail history' },
      { to: '/admin/settings', label: 'Settings', icon: Settings, roles: ['admin'], keywords: 'configuration' },
    ],
  },
];

export function navFor(role: UserRole | undefined): NavGroup[] {
  if (!role) return [];
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter((g) => g.items.length);
}

/** Longest matching nav item wins, so /inventory/items/123 lights "Items", /reports/gst-working lights "GST working". */
export function activeNavPath(pathname: string, groups: NavGroup[]): string | null {
  let best: NavItem | null = null;
  for (const item of groups.flatMap((g) => g.items)) {
    const hit = item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + '/');
    if (hit && (!best || item.to.length > best.to.length)) best = item;
  }
  return best?.to ?? null;
}
