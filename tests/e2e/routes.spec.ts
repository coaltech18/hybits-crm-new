// Smoke test per route: the page renders (no ErrorBoundary), logs no console
// errors, and shows its heading plus a piece of fixture data.
import { expect, test, type Page } from '@playwright/test';
import { openApp, refs } from './support/harness';

interface RouteCase {
  name: string;
  path: string;
  /** Exact level-1 heading. */
  h1: string | RegExp;
  /** Text that only appears once the page's data has loaded. */
  text?: (string | RegExp)[];
  signedOut?: boolean;
  /** Extra interaction or check before the heading/text checks (e.g. switch a tab). */
  action?: (page: Page) => Promise<void>;
}

const { C, S, E, INV, I, AUD } = refs;
const reportTab = (label: string) => async (page: Page) => {
  await page.getByRole('tab', { name: label, exact: true }).click();
};

const ROUTES: RouteCase[] = [
  { name: 'login', path: '/login', h1: 'Sign in', signedOut: true },
  // No recovery token in the URL, so the page explains the link has expired.
  { name: 'reset password', path: '/reset-password', h1: 'Link expired', text: ['Back to sign in'], signedOut: true },
  { name: 'root redirects to dashboard', path: '/', h1: /^Good (morning|afternoon|evening), Anil$/, text: ['Waiting for payment', 'HYB/IND/2026-27/0042'] },
  { name: 'dashboard', path: '/dashboard', h1: 'Good afternoon, Anil', text: ['Waiting for payment', 'HYB/IND/2026-27/0042'] },

  { name: 'clients', path: '/clients', h1: 'Clients', text: ['Prestige Tech Park Cafeteria', 'Iyer & Sons Catering'] },
  { name: 'client detail', path: `/clients/${C.prestige}`, h1: 'Prestige Tech Park Cafeteria', text: ['29AABCP4127M1ZV'] },
  { name: 'new client', path: '/clients/new', h1: 'New client' },
  { name: 'edit client', path: `/clients/${C.prestige}/edit`, h1: 'Edit client', text: ['Prestige Tech Park Cafeteria'] },

  { name: 'subscriptions', path: '/subscriptions', h1: 'Subscriptions', text: ['Prestige Tech Park Cafeteria'] },
  { name: 'subscription detail', path: `/subscriptions/${S.prestige}`, h1: 'Prestige Tech Park Cafeteria · Daily', text: [/Annual revision/] },
  { name: 'new subscription', path: '/subscriptions/add', h1: 'New subscription' },
  { name: 'edit subscription', path: `/subscriptions/${S.prestige}/edit`, h1: 'Edit subscription', text: ['Prestige Tech Park Cafeteria · Hybits Whitefield'] },

  { name: 'events', path: '/events', h1: 'Events', text: ['Sharma–Gupta Wedding Reception', 'Kapoor Sangeet Night'] },
  { name: 'event detail', path: `/events/${E.sharma}`, h1: 'Sharma–Gupta Wedding Reception', text: [/Chowdiah Memorial Hall/] },
  { name: 'new event', path: '/events/add', h1: 'New event' },
  {
    name: 'edit event', path: `/events/${E.kapoor}/edit`, h1: 'Edit event',
    action: async (page) => { await expect(page.getByLabel('Event name')).toHaveValue('Kapoor Sangeet Night'); },
  },

  { name: 'invoices', path: '/invoices', h1: 'Invoices', text: ['HYB/IND/2026-27/0042', 'HYB/WFD/2026-27/0118'] },
  { name: 'invoice detail (partially paid)', path: `/invoices/${INV.sharma}`, h1: 'HYB/IND/2026-27/0042', text: ['Sharma Wedding — Malleshwaram'] },
  { name: 'invoice detail (paid)', path: `/invoices/${INV.prestige_sep}`, h1: 'HYB/WFD/2026-27/0118', text: ['Prestige Tech Park Cafeteria'] },
  { name: 'invoice detail (draft)', path: `/invoices/${INV.draft_kapoor}`, h1: 'Draft invoice', text: ['Kapoor Sangeet — Whitefield'] },
  { name: 'new invoice', path: '/invoices/create', h1: 'New invoice' },
  { name: 'edit draft invoice', path: `/invoices/${INV.draft_kapoor}/edit`, h1: 'Edit draft', text: ['Kapoor Sangeet — Whitefield'] },

  { name: 'payments', path: '/payments', h1: 'Payments', text: ['HYB/IND/2026-27/0042'] },

  { name: 'reports: revenue', path: '/reports', h1: 'Reports' },
  { name: 'reports: payments', path: '/reports', h1: 'Reports', action: reportTab('Payments') },
  { name: 'reports: outstanding', path: '/reports', h1: 'Reports', action: reportTab('Outstanding & aging') },
  { name: 'reports: subscriptions', path: '/reports', h1: 'Reports', action: reportTab('Subscriptions') },
  { name: 'reports: events', path: '/reports', h1: 'Reports', action: reportTab('Events') },
  { name: 'reports: client revenue', path: '/reports', h1: 'Reports', action: reportTab('Client revenue'), text: ['Prestige Tech Park Cafeteria'] },
  { name: 'reports: outlet performance', path: '/reports', h1: 'Reports', action: reportTab('Outlet performance'), text: ['Hybits Whitefield'] },
  { name: 'GST working', path: '/reports/gst-working', h1: 'GST working', text: ['HYB/WFD/2026-27/0118'] },

  { name: 'inventory overview', path: '/inventory', h1: 'Dishware stock', text: ['Steel dinner plate 12in'] },
  { name: 'inventory items', path: '/inventory/items', h1: 'Dishware items', text: ['Steel dinner plate 12in'] },
  { name: 'inventory item detail', path: `/inventory/items/${I.plate12_ind}`, h1: 'Steel dinner plate 12in' },
  { name: 'stock movements', path: '/inventory/movements', h1: 'Stock movements', text: ['Steel dinner plate 12in'] },
  { name: 'send and receive', path: '/inventory/allocate', h1: 'Send and receive dishes' },
  { name: 'send and receive (event)', path: `/inventory/allocate?type=event&ref=${E.kapoor}`, h1: 'Send and receive dishes', text: [/Kapoor Sangeet Night/] },
  { name: 'stock audits', path: '/inventory/audit', h1: 'Stock audits', text: ['Hybits Indiranagar'] },
  { name: 'stock audit detail', path: `/inventory/audit/${AUD.indOct}`, h1: 'Stock audit · 2026-10', text: ['Steel dinner plate 12in'] },
  { name: 'inventory reports', path: '/inventory/reports', h1: 'Inventory reports' },

  { name: 'admin: users', path: '/admin/users', h1: 'Users', text: ['Priya Nair', 'priya.nair@hybits.example'] },
  { name: 'admin: outlets', path: '/admin/outlets', h1: 'Outlets', text: ['Hybits Koramangala'] },
  { name: 'admin: activity log', path: '/admin/activity-logs', h1: 'Activity log', text: ['Stock audit 2026-10 submitted for approval'] },
  { name: 'admin: settings', path: '/admin/settings', h1: 'System settings' },

  { name: 'unauthorized', path: '/unauthorized', h1: "You don't have access to this page", text: [/Your admin account/] },
  { name: 'not found', path: '/this-page-does-not-exist', h1: 'Page not found' },
];

for (const r of ROUTES) {
  test(`${r.name} (${r.path})`, async ({ page }) => {
    const app = await openApp(page, r.path, { signedOut: r.signedOut });
    if (r.action) {
      await r.action(page);
    }
    await expect(page.getByRole('heading', { level: 1, name: r.h1 })).toBeVisible();
    // visible: filter dropdown <option>s carry the same names but are hidden.
    for (const t of r.text ?? []) await expect(page.getByText(t).filter({ visible: true }).first()).toBeVisible();
    await app.expectHealthy();
  });
}

test('command palette finds an invoice', async ({ page }) => {
  const app = await openApp(page, '/dashboard');
  await expect(page.getByRole('heading', { level: 1, name: 'Good afternoon, Anil' })).toBeVisible();
  await page.keyboard.press('Control+k');
  await page.keyboard.type('0042');
  await expect(page.getByRole('dialog').getByText('HYB/IND/2026-27/0042')).toBeVisible();
  await app.expectHealthy();
});
