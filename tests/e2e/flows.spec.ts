// Business flows driven through the real forms, signed in as the people who
// do them every day. The mock runs in stateful mode: what a form writes is
// stored for the rest of the test, so each step sees the previous one's
// result, and the exact payloads the app sent are checked.
//
// The database rules behind these writes (numbering, status from payments,
// stock ledger, RLS per role) are tested against Postgres in tests/db/flows.sql.
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { openApp, refs, type Write } from './support/harness';

const { C, E, INV } = refs;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

const writesTo = (writes: Write[], table: string, method: Write['method'] = 'POST') =>
  writes.filter((w) => w.table === table && w.method === method);

/** Confirm in a ConfirmDialog (role=alertdialog) and wait for it to close. */
async function confirmInDialog(page: Page, button: string) {
  await page.getByRole('alertdialog').getByRole('button', { name: button }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
}

test.describe('invoice lifecycle', () => {
  test('manager: create a draft, finalize it and download the PDF', async ({ page }) => {
    const app = await openApp(page, '/invoices/create', { as: 'manager', stateful: true });
    await expect(page.getByRole('heading', { level: 1, name: 'New invoice' })).toBeVisible();

    // Scoped to <main>: the top bar has its own outlet picker.
    const form = page.getByRole('main');
    await form.getByRole('radio', { name: /Subscription/ }).check();
    await form.getByRole('combobox', { name: 'Outlet' }).selectOption({ label: 'Hybits Indiranagar (IND)' });
    await form.getByRole('combobox', { name: 'Client' }).selectOption({ label: 'Third Wave Roasters Indiranagar' });

    // One line: 100 cups at ₹2.50 + 18% GST = ₹250.00 + ₹45.00
    await page.getByLabel('Description, line 1').fill('Weekly service 26 Oct – 1 Nov 2026');
    await page.getByLabel('Qty, line 1').fill('100');
    await page.getByLabel('Unit price, line 1').fill('2.50');
    await page.getByLabel('GST %, line 1').selectOption('18');
    for (const remove of await page.getByRole('button', { name: /^Remove line [2-9]/ }).all()) await remove.click();

    await page.getByRole('button', { name: 'Save draft' }).click();

    // Lands on the new draft's detail page, not the list
    await expect(page).toHaveURL(new RegExp(`/invoices/${UUID.source}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Draft invoice' })).toBeVisible();
    await expect(page.getByText('Weekly service 26 Oct – 1 Nov 2026')).toBeVisible();

    const [invoiceInsert] = writesTo(app.writes, 'invoices');
    expect(invoiceInsert.body).toMatchObject({
      invoice_type: 'subscription', client_id: C.thirdwave, outlet_id: refs.O.IND, status: 'draft',
      subtotal: 250, tax_total: 45, grand_total: 295,
    });
    const [itemsInsert] = writesTo(app.writes, 'invoice_items');
    expect(itemsInsert.body).toEqual([
      expect.objectContaining({ description: 'Weekly service 26 Oct – 1 Nov 2026', quantity: 100, unit_price: 2.5, tax_rate: 18, line_total: 250, tax_amount: 45 }),
    ]);

    // Finalize: status change only; the number comes from the database
    await page.getByRole('button', { name: 'Finalize invoice' }).click();
    await confirmInDialog(page, 'Finalize invoice');
    await expect(page.getByRole('heading', { level: 1, name: 'HYB/IND/2026-27/0043' })).toBeVisible();
    expect(writesTo(app.writes, 'invoices', 'PATCH').map((w) => w.body)).toEqual([{ status: 'finalized' }]);
    await expect(page.getByRole('button', { name: 'Finalize invoice' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0);

    // PDF
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PDF' }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/0043.*\.pdf$/);
    const pdf = fs.readFileSync((await download.path())!);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(5_000);

    await app.expectHealthy();
  });

  test('admin: cancel a draft; a finalized invoice offers no cancel', async ({ page }) => {
    // docs/APPLICATION_WORKFLOW.md: the app cancels drafts; cancelling an
    // unpaid finalized invoice is a database-only operation.
    const app = await openApp(page, `/invoices/${INV.manyata_sep}`, { as: 'admin', stateful: true });
    await expect(page.getByRole('heading', { level: 1, name: 'HYB/IND/2026-27/0039' })).toBeVisible();
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Duplicate as new draft' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Cancel invoice/ })).toHaveCount(0);

    await page.goto(`/invoices/${INV.draft_kapoor}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Draft invoice' })).toBeVisible();
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('menuitem', { name: /Cancel invoice/ }).click();
    await confirmInDialog(page, 'Cancel invoice');
    await expect(page.getByRole('button', { name: 'Download (cancelled)' })).toBeVisible();
    expect(writesTo(app.writes, 'invoices', 'PATCH').map((w) => w.body)).toEqual([{ status: 'cancelled' }]);
    await app.expectHealthy();
  });
});

test.describe('payments (manager)', () => {
  test('record a part payment, then the rest', async ({ page }) => {
    const app = await openApp(page, `/invoices/${INV.sharma}`, { as: 'manager', stateful: true });
    await expect(page.getByRole('heading', { level: 1, name: 'HYB/IND/2026-27/0042' })).toBeVisible();
    const view = app.db.invoices_with_payment_status.find((i: { id: string }) => i.id === INV.sharma);
    const balance: number = view.balance_due;

    // Part payment by UPI
    await page.getByRole('button', { name: 'Record payment' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Amount').fill('1000');
    await dialog.getByLabel('Method').selectOption('upi');
    await dialog.getByLabel('Reference').fill('UTR 431100220033');
    await dialog.getByRole('button', { name: 'Record payment' }).click();
    await expect(dialog).toHaveCount(0);

    let posted = writesTo(app.writes, 'payments');
    expect(posted.map((w) => w.body)).toEqual([
      expect.objectContaining({ invoice_id: INV.sharma, amount: 1000, payment_method: 'upi', payment_date: '2026-10-29', reference_number: 'UTR 431100220033' }),
    ]);
    await expect(page.getByText('UTR 431100220033')).toBeVisible();

    // The rest with "Pay full balance"
    await page.getByRole('button', { name: 'Record payment' }).click();
    await dialog.getByRole('button', { name: /^Pay full balance/ }).click();
    await expect(dialog.getByLabel('Amount')).toHaveValue((balance - 1000).toFixed(2));
    await dialog.getByRole('button', { name: 'Record payment' }).click();
    await expect(dialog).toHaveCount(0);

    posted = writesTo(app.writes, 'payments');
    expect(posted).toHaveLength(2);
    expect((posted[1].body as { amount: number }).amount).toBeCloseTo(balance - 1000, 2);
    // Fully paid: no further payments offered
    await expect(page.getByRole('button', { name: 'Record payment' })).toHaveCount(0);
    await app.expectHealthy();
  });
});

test.describe('dishes out and back (manager)', () => {
  test('send dishes to an event, receive some back good and some damaged', async ({ page }) => {
    const app = await openApp(page, `/inventory/allocate?type=event&ref=${E.reddy}`, { as: 'manager', stateful: true });
    await expect(page.getByRole('heading', { level: 1, name: 'Send and receive dishes' })).toBeVisible();
    await expect(page.getByText(/Reddy Gruhapravesha/).first()).toBeVisible();

    // Send 10 pieces of the first item with stock
    await page.getByRole('button', { name: 'Send dishes' }).first().click();
    const dialog = page.getByRole('dialog');
    const itemSelect = dialog.getByLabel('Item');
    await expect(itemSelect.locator('option')).not.toHaveCount(1);
    const itemId = await itemSelect.locator('option').nth(1).getAttribute('value');
    await itemSelect.selectOption(itemId!);
    const item = app.db.inventory_items.find((i: { id: string }) => i.id === itemId);
    await dialog.getByLabel('Pieces to send').fill('10');
    await dialog.getByRole('button', { name: 'Send dishes' }).click();
    await expect(dialog).toHaveCount(0);

    expect(writesTo(app.writes, 'inventory_movements').map((w) => w.body)).toEqual([
      expect.objectContaining({ movement_type: 'allocation', quantity: 10, inventory_item_id: itemId, reference_type: 'event', reference_id: E.reddy, reason_code: 'event_dispatch' }),
    ]);

    await expect(page.getByRole('term').filter({ hasText: 'Sent' }).locator('xpath=following-sibling::*[1]')).toHaveText('240 pcs'); // 230 already out + 10
    await page.getByRole('tab', { name: /^Receive back/ }).click();
    const receive = page.getByRole('button', { name: `Receive back ${item.name}` });
    await expect(receive).toBeVisible();

    // 6 back in good condition
    await receive.click();
    await dialog.getByText('Returned', { exact: true }).click();
    await dialog.getByLabel('Pieces').fill('6');
    await dialog.getByRole('button', { name: 'Receive back' }).click();
    await expect(dialog).toHaveCount(0);

    // 2 damaged (notes required)
    await receive.click();
    await dialog.getByText('Damaged', { exact: true }).click();
    await expect(dialog.getByRole('radio', { name: /Damaged/ })).toBeChecked();
    await dialog.getByLabel('Pieces').fill('2');
    await dialog.getByLabel('Notes').fill('Chipped rims');
    await dialog.getByRole('button', { name: 'Mark damaged' }).click();
    await expect(dialog).toHaveCount(0);

    const moves = writesTo(app.writes, 'inventory_movements').map((w) => w.body);
    expect(moves.slice(1)).toEqual([
      expect.objectContaining({ movement_type: 'return', quantity: 6, inventory_item_id: itemId, reference_id: E.reddy }),
      expect.objectContaining({ movement_type: 'return_damaged', quantity: 2, inventory_item_id: itemId, reference_id: E.reddy, notes: 'Chipped rims' }),
    ]);
    await app.expectHealthy();
  });
});

test.describe('roles', () => {
  const adminSection = (page: Page) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Users' });

  test('accountant: read-only everywhere', async ({ page }) => {
    const app = await openApp(page, '/invoices', { as: 'accountant' });
    await expect(page.getByRole('heading', { level: 1, name: 'Invoices' })).toBeVisible();
    await expect(page.getByText('HYB/IND/2026-27/0042').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'New invoice' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'New invoice' })).toHaveCount(0);
    await expect(adminSection(page)).toHaveCount(0);

    await page.goto(`/invoices/${INV.sharma}`);
    await expect(page.getByRole('heading', { level: 1, name: 'HYB/IND/2026-27/0042' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Record payment' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'More', exact: true })).toHaveCount(0);

    await page.goto(`/invoices/${INV.draft_kapoor}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Draft invoice' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Finalize invoice' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0);

    // Sending and receiving dishes is admin/manager only, like every other create form.
    for (const path of ['/invoices/create', '/clients/new', '/events/add', '/inventory/allocate', '/admin/users']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: "You don't have access to this page" })).toBeVisible();
    }
    await app.expectHealthy();
  });

  test('manager: can bill and send dishes, no admin pages', async ({ page }) => {
    const app = await openApp(page, '/invoices', { as: 'manager' });
    await expect(page.getByRole('heading', { level: 1, name: 'Invoices' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New invoice' }).first()).toBeVisible();
    await expect(adminSection(page)).toHaveCount(0);

    await page.goto(`/invoices/${INV.sharma}`);
    await expect(page.getByRole('button', { name: 'Record payment' })).toBeVisible();

    for (const path of ['/admin/users', '/admin/outlets', '/admin/settings', '/admin/activity-logs']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: "You don't have access to this page" })).toBeVisible();
    }
    await app.expectHealthy();
  });

  test('admin: sees the admin pages', async ({ page }) => {
    const app = await openApp(page, '/dashboard');
    await expect(adminSection(page)).toBeVisible();
    await adminSection(page).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
    await app.expectHealthy();
  });
});
