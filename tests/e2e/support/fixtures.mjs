// Realistic fixture database for the Hybits CRM Playwright smoke tests.
// Every table/view the app reads is a key of the object returned by buildDb().
// Embedded resources (clients(...), outlets:outlet_id(...), ...) are resolved
// by mock-supabase.mjs from foreign-key columns, so rows here stay flat
// except for view-only joined columns.

const id = (prefix, n) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const IDS = {
  admin: id('a0000001', 1),
  outlets: { IND: id('0a000001', 1), WFD: id('0a000001', 2), KRM: id('0a000001', 3), MYS: id('0a000001', 4) },
};

/** IST wall-clock → UTC ISO string like Postgres timestamptz output. */
const ist = (date, time = '10:00') => new Date(`${date}T${time}:00+05:30`).toISOString().replace('.000Z', '+00:00');
const r2 = (n) => Math.round(n * 100) / 100;

export function buildDb() {
  const U = {
    admin: IDS.admin,
    priya: id('a0000001', 2),
    ramesh: id('a0000001', 3),
    kavya: id('a0000001', 4),
    arjun: id('a0000001', 5),
  };
  const O = IDS.outlets;

  // ---------------------------------------------------------------- outlets
  const outlets = [
    { id: O.IND, name: 'Hybits Indiranagar', code: 'IND', address: '#412, 100 Feet Road, HAL 2nd Stage, Indiranagar', city: 'Bengaluru', state: 'Karnataka', pincode: '560038', gstin: '29AAHCH6039E1ZH', phone: '+91 99456 24643', email: 'indiranagar@hybits.example', currency: 'INR', is_active: true, created_at: ist('2025-04-02', '11:00'), updated_at: ist('2026-06-10', '16:20') },
    { id: O.WFD, name: 'Hybits Whitefield', code: 'WFD', address: 'Plot 22, EPIP Zone, Whitefield', city: 'Bengaluru', state: 'Karnataka', pincode: '560066', gstin: '29AAHCH6039E1ZH', phone: '+91 99456 24644', email: 'whitefield@hybits.example', currency: 'INR', is_active: true, created_at: ist('2025-07-15', '10:30'), updated_at: ist('2026-08-01', '12:00') },
    { id: O.KRM, name: 'Hybits Koramangala', code: 'KRM', address: '5th Block, 80 Feet Road, Koramangala', city: 'Bengaluru', state: 'Karnataka', pincode: '560095', gstin: '29AAHCH6039E1ZH', phone: '+91 99456 24645', email: 'koramangala@hybits.example', currency: 'INR', is_active: true, created_at: ist('2026-01-20', '09:45'), updated_at: ist('2026-09-03', '18:05') },
    { id: O.MYS, name: 'Hybits Mysuru (pilot)', code: 'MYS', address: 'Saraswathipuram', city: 'Mysuru', state: 'Karnataka', pincode: '570009', gstin: null, phone: null, email: null, currency: 'INR', is_active: false, created_at: ist('2025-11-01', '10:00'), updated_at: ist('2026-03-31', '17:00') },
  ];
  const outletById = Object.fromEntries(outlets.map((o) => [o.id, o]));

  // ---------------------------------------------------------- user profiles
  const user_profiles = [
    { id: U.admin, email: 'admin@hybits.example', full_name: 'Anil Kumar', phone: '+91 90000 11223', role: 'admin', is_active: true, last_login: ist('2026-10-29', '09:12'), created_at: ist('2025-04-01', '10:00'), updated_at: ist('2026-10-29', '09:12') },
    { id: U.priya, email: 'priya.nair@hybits.example', full_name: 'Priya Nair', phone: '+91 99001 44556', role: 'manager', is_active: true, last_login: ist('2026-10-28', '18:40'), created_at: ist('2025-05-12', '11:00'), updated_at: ist('2026-10-28', '18:40') },
    { id: U.ramesh, email: 'ramesh.iyer@hybits.example', full_name: 'Ramesh Iyer', phone: '+91 97400 22331', role: 'accountant', is_active: true, last_login: ist('2026-10-27', '10:05'), created_at: ist('2025-06-01', '10:00'), updated_at: ist('2026-10-27', '10:05') },
    { id: U.kavya, email: 'kavya.reddy@hybits.example', full_name: 'Kavya Reddy', phone: '+91 96320 77889', role: 'manager', is_active: true, last_login: ist('2026-10-29', '08:30'), created_at: ist('2025-07-20', '14:30'), updated_at: ist('2026-10-29', '08:30') },
    { id: U.arjun, email: 'arjun.k@hybits.example', full_name: 'Arjun Kulkarni', phone: null, role: 'manager', is_active: false, last_login: ist('2026-03-14', '17:55'), created_at: ist('2025-11-02', '10:00'), updated_at: ist('2026-04-01', '10:00') },
  ];
  const userName = Object.fromEntries(user_profiles.map((u) => [u.id, u.full_name]));

  const user_outlet_assignments = [
    { id: id('aa000001', 1), user_id: U.priya, outlet_id: O.IND, assigned_at: ist('2025-05-12'), assigned_by: U.admin },
    { id: id('aa000001', 2), user_id: U.priya, outlet_id: O.KRM, assigned_at: ist('2026-01-21'), assigned_by: U.admin },
    { id: id('aa000001', 3), user_id: U.kavya, outlet_id: O.WFD, assigned_at: ist('2025-07-20'), assigned_by: U.admin },
    { id: id('aa000001', 4), user_id: U.arjun, outlet_id: O.MYS, assigned_at: ist('2025-11-02'), assigned_by: U.admin },
  ];

  // ---------------------------------------------------------------- clients
  const C = {};
  const clientSpecs = [
    ['prestige', 'Prestige Tech Park Cafeteria', 'corporate', O.WFD, 'domestic', 'Anitha Rao', '+91 98861 20345', 'facilities@prestigetp.example.in', '29AABCP4127M1ZV', 'Prestige Tech Park, Marathahalli–Sarjapur Outer Ring Road, Kadubeesanahalli, Bengaluru 560103', '2025-08-04'],
    ['sharma', 'Sharma Wedding — Malleshwaram', 'event', O.IND, null, 'Rajesh Sharma', '+91 98450 67123', 'rajesh.sharma@gmail.example', null, '14th Cross, Malleshwaram, Bengaluru 560003', '2026-09-02'],
    ['manyata', 'Manyata Tech Park — Block D Canteen', 'corporate', O.IND, 'sez', 'Suresh Gowda', '+91 99000 31415', 'canteen.blockd@manyata.example.in', '29AACCM9087K1Z2', 'Manyata Embassy Business Park, Nagawara, Bengaluru 560045', '2025-10-11'],
    ['thirdwave', 'Third Wave Roasters Indiranagar', 'corporate', O.IND, 'domestic', 'Meera Pillai', '+91 90080 55210', 'ops.ind@thirdwave.example.in', '29AAFCT2210B1Z8', '12th Main, HAL 2nd Stage, Indiranagar, Bengaluru 560008', '2025-12-01'],
    ['reddy', 'Reddy Housewarming — HSR Layout', 'event', O.KRM, null, 'Venkat Reddy', '+91 99800 44312', null, null, 'Sector 2, HSR Layout, Bengaluru 560102', '2026-10-08'],
    ['bis', 'Bangalore International School Canteen', 'corporate', O.WFD, 'domestic', 'Fr. Thomas Mathew', '+91 80 2845 1100', 'admin@bis.example.edu.in', '29AAATB5531H1ZQ', 'Geddalahalli, Hennur Road, Bengaluru 560077', '2025-09-15'],
    ['nairmenon', 'Nair–Menon Engagement — Koramangala', 'event', O.KRM, null, 'Lakshmi Menon', '+91 94480 90876', 'lakshmi.menon@example.in', null, '6th Block, Koramangala, Bengaluru 560095', '2026-09-20'],
    ['iyer', 'Iyer & Sons Catering', 'corporate', O.IND, 'domestic', 'Ganesh Iyer', '+91 98440 12098', 'accounts@iyersons.example.in', '29AADFI7765C1ZK', 'Basavanagudi, Bengaluru 560004', '2025-11-18'],
    ['kapoor', 'Kapoor Sangeet — Whitefield', 'event', O.WFD, null, 'Neha Kapoor', '+91 99860 23411', 'neha.kapoor@example.in', null, 'Prestige Shantiniketan, Whitefield, Bengaluru 560048', '2026-10-15'],
    ['globalx', 'Global Spice Exports LLP (Dubai office)', 'corporate', O.WFD, 'export', 'Imran Shaikh', '+971 50 412 7788', 'finance@globalspice.example.ae', null, 'Jebel Ali Free Zone, Dubai, UAE', '2026-02-10'],
    ['greenleaf', 'Green Leaf Darshini', 'corporate', O.KRM, 'domestic', 'Manjunath K', '+91 97411 88120', null, '29ABCPM1287L1ZD', '1st Block, Koramangala, Bengaluru 560034', '2026-04-05'],
    ['joshi', 'Joshi Naming Ceremony — Jayanagar', 'event', O.IND, null, 'Pooja Joshi', '+91 98864 55001', null, null, '4th T Block, Jayanagar, Bengaluru 560041', '2026-08-01'],
  ];
  const clients = clientSpecs.map(([key, name, client_type, outlet_id, gst_type, contact_person, phone, email, gstin, billing_address, created], i) => {
    C[key] = id('c1000001', i + 1);
    return { id: C[key], outlet_id, client_type, gst_type, name, contact_person, phone, email, gstin, billing_address, is_active: true, created_at: ist(created, '11:30'), updated_at: ist(created, '11:30'), created_by: U.admin };
  });
  clients.push({ id: id('c1000001', 99), outlet_id: O.KRM, client_type: 'corporate', gst_type: 'domestic', name: 'Old Koramangala Mess (closed)', contact_person: null, phone: '+91 90000 00000', email: null, gstin: null, billing_address: null, is_active: false, created_at: ist('2025-05-01'), updated_at: ist('2026-01-01'), created_by: U.admin });
  const clientById = Object.fromEntries(clients.map((c) => [c.id, c]));

  // ---------------------------------------------------------- inventory items
  const I = {};
  const itemSpecs = [
    // key, outlet, name, category, material, unit, total, avail, alloc, damaged, repair, lost, lifecycle, confirmed
    ['plate12_ind', O.IND, 'Steel dinner plate 12in', 'Plates', 'Stainless steel', 'pcs', 2400, 1520, 780, 62, 38, 14, 'active', true],
    ['bowl300_ind', O.IND, 'Bowl 300ml', 'Bowls', 'Stainless steel', 'pcs', 3000, 2210, 720, 44, 26, 9, 'active', true],
    ['glass_ind', O.IND, 'Glass tumbler', 'Glassware', 'Toughened glass', 'pcs', 1800, 1205, 540, 55, 0, 21, 'active', true],
    ['spoon_ind', O.IND, 'Steel spoon', 'Cutlery', 'Stainless steel', 'pcs', 4000, 3190, 810, 0, 0, 33, 'active', true],
    ['katori_ind', O.IND, 'Katori 150ml', 'Bowls', 'Stainless steel', 'pcs', 2500, 2500, 0, 0, 0, 0, 'active', true],
    ['tray_ind', O.IND, 'Serving tray 18in', 'Serveware', 'Stainless steel', 'pcs', 120, 96, 20, 4, 0, 0, 'active', true],
    ['plate12_wfd', O.WFD, 'Steel dinner plate 12in', 'Plates', 'Stainless steel', 'pcs', 3200, 1940, 1210, 30, 20, 6, 'active', true],
    ['bowl300_wfd', O.WFD, 'Bowl 300ml', 'Bowls', 'Stainless steel', 'pcs', 3600, 2380, 1200, 12, 8, 4, 'active', true],
    ['glass_wfd', O.WFD, 'Glass tumbler', 'Glassware', 'Toughened glass', 'pcs', 2000, 1310, 650, 40, 0, 12, 'active', true],
    ['jug_wfd', O.WFD, 'Water jug 1.5L', 'Serveware', 'Stainless steel', 'pcs', 150, 118, 30, 2, 0, 1, 'active', true],
    ['quarter_krm', O.KRM, 'Quarter plate 8in', 'Plates', 'Stainless steel', 'pcs', 1200, 1050, 150, 0, 0, 0, 'active', true],
    ['plate12_krm', O.KRM, 'Steel dinner plate 12in', 'Plates', 'Stainless steel', 'pcs', 0, 0, 0, 0, 0, 0, 'draft', false],
    ['cup_krm', O.KRM, 'Tea cup 120ml', 'Cups', 'Stainless steel', 'pcs', 600, 520, 80, 0, 0, 0, 'active', true],
    ['oldplate_ind', O.IND, 'Melamine plate 10in (old stock)', 'Plates', 'Melamine', 'pcs', 0, 0, 0, 0, 0, 0, 'discontinued', true],
  ];
  const inventory_items = itemSpecs.map(([key, outlet_id, name, category, material, unit, total, avail, alloc, dmg, repair, lost, lifecycle, confirmed], i) => {
    I[key] = id('11000001', i + 1);
    return {
      id: I[key], outlet_id, name, category, material, unit,
      total_quantity: total, available_quantity: avail, allocated_quantity: alloc, damaged_quantity: dmg, lost_quantity: lost, in_repair_quantity: repair,
      is_active: lifecycle === 'active' || lifecycle === 'draft', lifecycle_status: lifecycle, opening_balance_confirmed: confirmed,
      created_by: U.admin, created_at: ist('2025-08-01', '10:00'), updated_at: ist('2026-10-27', '17:30'),
      outlet_name: outletById[outlet_id].name, outlet_code: outletById[outlet_id].code,
    };
  });
  const itemById = Object.fromEntries(inventory_items.map((it) => [it.id, it]));

  const inventory_stock_summary = inventory_items.map((it) => ({
    item_id: it.id, outlet_id: it.outlet_id, outlet_name: it.outlet_name, outlet_code: it.outlet_code, item_name: it.name, category: it.category, material: it.material, unit: it.unit,
    total_quantity: it.total_quantity, available_quantity: it.available_quantity, allocated_quantity: it.allocated_quantity, damaged_quantity: it.damaged_quantity,
    in_repair_quantity: it.in_repair_quantity, lost_quantity: it.lost_quantity, lifecycle_status: it.lifecycle_status, opening_balance_confirmed: it.opening_balance_confirmed,
    is_active: it.is_active, created_at: it.created_at, updated_at: it.updated_at,
  }));

  // ------------------------------------------------------------ subscriptions
  const S = {};
  const subSpecs = [
    // key, client, outlet, cycle, day, start, status, qty, price, next, notes, kit
    ['prestige', 'prestige', O.WFD, 'daily', null, '2025-08-11', 'active', 450, 4.5, '2026-10-30', 'Breakfast + lunch service, 450 covers/day. Price agreed with facilities team after trial week (₹4.50/cover incl. washing).', [['plate12_wfd', 500], ['bowl300_wfd', 900], ['glass_wfd', 450]]],
    ['manyata', 'manyata', O.IND, 'monthly', 1, '2025-10-15', 'active', 9000, 3.75, '2026-11-01', 'SEZ unit — zero-rated supply under LUT. Monthly billing on the 1st for previous month covers.', [['plate12_ind', 400], ['bowl300_ind', 400]]],
    ['thirdwave', 'thirdwave', O.IND, 'weekly', null, '2025-12-08', 'active', 1400, 2.25, '2026-11-02', 'Café cups + side plates, weekly collection on Mondays.', null],
    ['bis', 'bis', O.WFD, 'monthly', 5, '2025-09-20', 'paused', 6000, 3.1, '2026-11-05', 'Paused for Dasara holidays (school closed 1–14 Oct). Resume 15 Nov.', null],
    ['iyer', 'iyer', O.IND, 'weekly', null, '2025-11-24', 'active', 2200, 3.0, '2026-11-02', 'Outdoor catering add-on; weekly reconciliation of returned pieces.', null],
    ['greenleaf', 'greenleaf', O.KRM, 'daily', null, '2026-04-07', 'cancelled', 300, 2.8, '2026-09-30', 'Client moved to own dishwashing line from Oct 2026.', null],
  ];
  const subscriptions = subSpecs.map(([key, ck, outlet_id, cycle, day, start, status, qty, price, next, notes, kit], i) => {
    S[key] = id('5b000001', i + 1);
    return {
      id: S[key], outlet_id, client_id: C[ck], billing_cycle: cycle, billing_day: day, start_date: start, end_date: status === 'cancelled' ? '2026-09-30' : null, status,
      quantity: qty, price_per_unit: price, next_billing_date: next, notes,
      questionnaire: {
        daily_volume: cycle === 'daily' ? qty : Math.round(qty / (cycle === 'weekly' ? 7 : 30)),
        peak_challenges: key === 'prestige' ? 'Lunch rush 12:30–14:00, two counters' : 'Weekend spikes',
        has_washing_facility: key === 'thirdwave',
        esg_priority: key === 'prestige' ? 'High — part of their plastic-free campus pledge' : 'Medium',
        additional_context: key === 'manyata' ? 'Security pass needed for delivery van; gate 3 only.' : undefined,
        ...(kit ? { standard_kit: kit.map(([ik, q]) => ({ inventory_item_id: I[ik], item_name: itemById[I[ik]].name, quantity: q })) } : {}),
      },
      created_by: U.admin, created_at: ist(start, '12:00'), updated_at: ist('2026-10-20', '15:00'),
    };
  });

  const subscription_price_history = [
    { id: id('5f000001', 1), subscription_id: S.prestige, old_price: 4.0, new_price: 4.5, changed_by: U.admin, reason: 'Annual revision — added glass tumblers to the kit from April 2026.', created_at: ist('2026-04-01', '10:15') },
    { id: id('5f000001', 2), subscription_id: S.prestige, old_price: 3.6, new_price: 4.0, changed_by: U.kavya, reason: 'Trial pricing ended after 30 days.', created_at: ist('2025-09-12', '16:40') },
    { id: id('5f000001', 3), subscription_id: S.manyata, old_price: 3.5, new_price: 3.75, changed_by: U.priya, reason: 'Volume tier change (8k → 9k covers/month).', created_at: ist('2026-07-01', '11:00') },
  ];

  // ------------------------------------------------------------------ events
  const E = {};
  const eventSpecs = [
    ['sharma', 'sharma', O.IND, 'Sharma–Gupta Wedding Reception', 'Wedding', '2026-10-18', 650, 'completed', 'Venue: Chowdiah Memorial Hall annexe. Buffet for 650, two live counters. Plates collected 19 Oct morning.'],
    ['reddy', 'reddy', O.KRM, 'Reddy Gruhapravesha', 'Housewarming', '2026-11-02', 180, 'planned', 'Traditional banana-leaf lunch + steel tumblers. Delivery 1 Nov evening.'],
    ['nairmenon', 'nairmenon', O.KRM, 'Nair–Menon Engagement', 'Engagement', '2026-10-25', 240, 'completed', null],
    ['kapoor', 'kapoor', O.WFD, 'Kapoor Sangeet Night', 'Sangeet', '2026-11-08', 320, 'planned', 'Evening event, DJ + dinner. Glassware heavy (mocktail bar).'],
    ['joshi', 'joshi', O.IND, 'Joshi Naamkaran', 'Naming ceremony', '2026-08-23', 90, 'cancelled', 'Postponed by family; re-book expected in Dec.'],
    ['sharmamehendi', 'sharma', O.IND, 'Sharma Mehendi', 'Wedding', '2026-10-16', 220, 'completed', null],
  ];
  const events = eventSpecs.map(([key, ck, outlet_id, event_name, event_type, event_date, guest_count, status, notes], i) => {
    E[key] = id('e0000001', i + 1);
    return { id: E[key], outlet_id, client_id: C[ck], event_name, event_type, event_date, guest_count, notes, status, created_by: U.priya, created_at: ist('2026-09-05', '13:00'), updated_at: ist(event_date, '22:00') };
  });

  // ---------------------------------------------------------------- invoices
  const INV = {};
  const invoices = [];
  const invoice_items = [];
  let itemSeq = 1;
  const addInvoice = (key, spec) => {
    const invId = id('1a000001', invoices.length + 1);
    INV[key] = invId;
    let subtotal = 0;
    let tax_total = 0;
    spec.items.forEach(([description, quantity, unit_price, tax_rate], idx) => {
      const line_total = r2(quantity * unit_price);
      const tax_amount = r2((line_total * tax_rate) / 100);
      subtotal += line_total;
      tax_total += tax_amount;
      invoice_items.push({ id: id('1b000001', itemSeq++), invoice_id: invId, description, quantity, unit_price, line_total, tax_rate, tax_amount, created_at: new Date(Date.parse(spec.created) + idx * 1000).toISOString() });
    });
    subtotal = r2(subtotal);
    tax_total = r2(tax_total);
    const client = clientById[C[spec.client]];
    const issued = spec.status !== 'draft';
    invoices.push({
      id: invId, invoice_number: spec.number ?? null, invoice_type: spec.type, client_id: client.id, outlet_id: spec.outlet, event_id: spec.event ? E[spec.event] : null,
      status: spec.status, subtotal, tax_total, grand_total: r2(subtotal + tax_total), issued_at: spec.issued ?? null,
      terms_and_conditions: '1. Payment due within 15 days of invoice date.\n2. Damaged or missing pieces are charged at replacement cost.\n3. Subject to Bengaluru jurisdiction.',
      invoice_number_format: 'outlet_fy', created_at: spec.created, updated_at: spec.created, created_by: U.priya,
      client_name_snap: issued ? client.name : null, client_gstin_snap: issued ? client.gstin : null, client_address_snap: issued ? client.billing_address : null,
      client_gst_type_snap: issued ? client.gst_type : null, supplier_gstin_snap: issued ? '29AAHCH6039E1ZH' : null,
      _paid: spec.paid ?? 0,
    });
  };
  addInvoice('sharma', { number: 'HYB/IND/2026-27/0042', type: 'event', client: 'sharma', outlet: O.IND, event: 'sharma', status: 'partially_paid', issued: ist('2026-10-19', '12:30'), created: ist('2026-10-19', '11:05'), paid: 20000,
    items: [['Dishware rental — Steel dinner plate 12in (650 covers)', 650, 18.5, 18], ['Bowl 300ml rental', 1300, 6.25, 18], ['Glass tumbler rental', 650, 5.5, 18], ['On-site washing & logistics (Malleshwaram)', 1, 4250, 18], ['Breakage charges — 7 plates, 3 tumblers', 1, 1187.5, 18]] });
  addInvoice('prestige_sep', { number: 'HYB/WFD/2026-27/0118', type: 'subscription', client: 'prestige', outlet: O.WFD, status: 'paid', issued: ist('2026-10-01', '10:00'), created: ist('2026-10-01', '09:40'), paid: 'full',
    items: [['Dishware-as-a-service — September 2026 (30 days × 450 covers)', 13500, 4.5, 18]] });
  addInvoice('draft_kapoor', { number: null, type: 'event', client: 'kapoor', outlet: O.WFD, event: 'kapoor', status: 'draft', created: ist('2026-10-28', '17:20'),
    items: [['Dishware rental — Steel dinner plate 12in (320 covers)', 320, 18.5, 18], ['Glass tumbler rental (mocktail bar)', 640, 5.5, 18], ['Delivery & pickup — Whitefield', 1, 1800, 18]] });
  addInvoice('manyata_sep', { number: 'HYB/IND/2026-27/0039', type: 'subscription', client: 'manyata', outlet: O.IND, status: 'finalized', issued: ist('2026-10-01', '10:30'), created: ist('2026-10-01', '10:10'),
    items: [['Dishware-as-a-service — September 2026 (SEZ, LUT)', 9000, 3.75, 0]] });
  addInvoice('thirdwave_w42', { number: 'HYB/IND/2026-27/0041', type: 'subscription', client: 'thirdwave', outlet: O.IND, status: 'paid', issued: ist('2026-10-19', '09:15'), created: ist('2026-10-19', '09:00'), paid: 'full',
    items: [['Weekly service 12–18 Oct 2026', 1400, 2.25, 18]] });
  addInvoice('iyer_aug', { number: 'HYB/IND/2026-27/0027', type: 'subscription', client: 'iyer', outlet: O.IND, status: 'partially_paid', issued: ist('2026-08-31', '18:00'), created: ist('2026-08-31', '17:30'), paid: 15000,
    items: [['Weekly service — August 2026 (4 weeks)', 8800, 3.0, 18]] });
  addInvoice('bis_sep', { number: 'HYB/WFD/2026-27/0109', type: 'subscription', client: 'bis', outlet: O.WFD, status: 'finalized', issued: ist('2026-09-05', '11:00'), created: ist('2026-09-05', '10:45'),
    items: [['Dishware-as-a-service — August 2026', 6000, 3.1, 18], ['Additional tumblers for sports day', 400, 5.5, 18]] });
  addInvoice('nairmenon', { number: 'HYB/KRM/2026-27/0014', type: 'event', client: 'nairmenon', outlet: O.KRM, event: 'nairmenon', status: 'finalized', issued: ist('2026-10-26', '13:00'), created: ist('2026-10-26', '12:40'),
    items: [['Dishware rental — 240 covers', 240, 18.5, 18], ['Washing & logistics', 1, 1500, 18]] });
  addInvoice('global', { number: 'HYB/WFD/2026-27/0112', type: 'subscription', client: 'globalx', outlet: O.WFD, status: 'paid', issued: ist('2026-09-15', '15:30'), created: ist('2026-09-15', '15:00'), paid: 'full',
    items: [['Export consignment — reusable steel tiffin sets (zero-rated)', 120, 640, 0]] });
  addInvoice('mehendi', { number: 'HYB/IND/2026-27/0040', type: 'event', client: 'sharma', outlet: O.IND, event: 'sharmamehendi', status: 'paid', issued: ist('2026-10-17', '10:00'), created: ist('2026-10-17', '09:30'), paid: 'full',
    items: [['Dishware rental — 220 covers', 220, 18.5, 18], ['Katori 150ml rental', 440, 3.25, 18]] });
  addInvoice('joshi_cancel', { number: 'HYB/IND/2026-27/0031', type: 'event', client: 'joshi', outlet: O.IND, event: 'joshi', status: 'cancelled', issued: ist('2026-08-20', '10:00'), created: ist('2026-08-20', '09:30'),
    items: [['Dishware rental — 90 covers', 90, 18.5, 18]] });
  addInvoice('draft_prestige_oct', { number: null, type: 'subscription', client: 'prestige', outlet: O.WFD, status: 'draft', created: ist('2026-10-29', '08:55'),
    items: [['Dishware-as-a-service — October 2026 (to date)', 12600, 4.5, 18]] });
  addInvoice('reddy_adv', { number: 'HYB/KRM/2026-27/0015', type: 'event', client: 'reddy', outlet: O.KRM, event: 'reddy', status: 'finalized', issued: ist('2026-10-28', '16:00'), created: ist('2026-10-28', '15:30'),
    items: [['Advance — Dishware rental, 180 covers', 180, 18.5, 18]] });
  // resolve "full" payments
  for (const inv of invoices) if (inv._paid === 'full') inv._paid = inv.grand_total;

  const invoices_with_payment_status = invoices.map((inv) => {
    const amount_paid = r2(inv._paid || 0);
    const balance_due = inv.status === 'draft' || inv.status === 'cancelled' ? 0 : r2(inv.grand_total - amount_paid);
    return { ...inv, amount_paid, balance_due, payment_status: amount_paid <= 0 ? 'unpaid' : balance_due <= 0 ? 'paid' : 'partially_paid' };
  });
  const invById = Object.fromEntries(invoices.map((x) => [x.id, x]));

  // ---------------------------------------------------------------- payments
  const payments = [];
  const addPayment = (invKey, amount, method, date, ref, notes, isActive = true, by = U.ramesh) => {
    const inv = invById[INV[invKey]];
    const client = clientById[inv.client_id];
    const outlet = outletById[inv.outlet_id];
    payments.push({
      id: id('9a000001', payments.length + 1), invoice_id: inv.id, amount, payment_method: method, payment_date: date, reference_number: ref, notes, is_active: isActive,
      created_at: ist(date, '15:20'), updated_at: ist(date, '15:20'), created_by: by,
      invoice_number: inv.invoice_number, invoice_type: inv.invoice_type, invoice_total: inv.grand_total, invoice_status: inv.status,
      client_name: client.name, client_phone: client.phone, outlet_name: outlet.name, outlet_code: outlet.code, outlet_id: outlet.id, recorded_by_name: userName[by],
    });
  };
  const g = (k) => invById[INV[k]].grand_total;
  addPayment('sharma', 15000, 'upi', '2026-10-19', 'UTR 429817365012', 'Advance at venue');
  addPayment('sharma', 5000, 'cash', '2026-10-22', null, 'Collected by delivery team');
  addPayment('prestige_sep', g('prestige_sep'), 'bank_transfer', '2026-10-09', 'NEFT HDFCN26282901733', 'Paid in full via NEFT');
  addPayment('thirdwave_w42', g('thirdwave_w42'), 'upi', '2026-10-21', 'UTR 430212998874', null);
  addPayment('iyer_aug', 10000, 'cheque', '2026-09-12', 'CHQ 004512 / Canara Bank', null);
  addPayment('iyer_aug', 5000, 'upi', '2026-10-03', 'UTR 427701123390', 'Part payment');
  addPayment('global', g('global'), 'bank_transfer', '2026-09-30', 'SWIFT EBILAEAD 7781', 'Received in INR after conversion');
  addPayment('mehendi', g('mehendi'), 'card', '2026-10-17', 'POS 88213', null);
  addPayment('sharma', 2500, 'upi', '2026-10-20', 'UTR 429990001122', 'Entered twice — voided', false);
  addPayment('thirdwave_w42', 1200, 'cash', '2026-10-29', null, 'Breakage settled at counter', true, U.priya);

  // ------------------------------------------------------- allocations
  const A = [];
  const addAlloc = (itemKey, refType, refKey, qty, outstanding, createdDate, isActive = true, returned = [0, 0, 0, 0]) => {
    const item = itemById[I[itemKey]];
    const ref = refType === 'event' ? events.find((e) => e.id === E[refKey]) : subscriptions.find((s) => s.id === S[refKey]);
    const reference_name = refType === 'event' ? ref.event_name : clientById[ref.client_id].name;
    const allocId = id('a11c0001', A.length + 1);
    A.push({
      id: allocId, allocation_id: allocId, outlet_id: item.outlet_id, inventory_item_id: item.id, reference_type: refType, reference_id: ref.id, allocated_quantity: qty, outstanding_quantity: outstanding,
      is_active: isActive, created_at: ist(createdDate, '09:00'), updated_at: ist('2026-10-27', '18:00'),
      item_name: item.name, item_category: item.category, outlet_name: item.outlet_name, outlet_code: item.outlet_code, reference_name, lifecycle_status: item.lifecycle_status,
      returned_good: returned[0], returned_damaged: returned[1], lost: returned[2], disposed: returned[3],
    });
  };
  addAlloc('plate12_wfd', 'subscription', 'prestige', 500, 500, '2025-08-11');
  addAlloc('bowl300_wfd', 'subscription', 'prestige', 900, 860, '2025-08-11', true, [30, 6, 4, 0]);
  addAlloc('glass_wfd', 'subscription', 'prestige', 450, 450, '2026-04-01');
  addAlloc('plate12_ind', 'subscription', 'manyata', 400, 400, '2025-10-15');
  addAlloc('bowl300_ind', 'subscription', 'manyata', 400, 380, '2025-10-15', true, [12, 5, 3, 0]);
  addAlloc('spoon_ind', 'subscription', 'thirdwave', 810, 810, '2025-12-08');
  addAlloc('plate12_ind', 'event', 'sharma', 650, 30, '2026-10-17', true, [598, 15, 7, 0]);
  addAlloc('glass_ind', 'event', 'sharma', 650, 40, '2026-10-17', true, [590, 17, 3, 0]);
  addAlloc('bowl300_ind', 'event', 'sharma', 1300, 0, '2026-10-17', false, [1288, 8, 4, 0]);
  addAlloc('quarter_krm', 'event', 'reddy', 150, 150, '2026-10-28');
  addAlloc('cup_krm', 'event', 'reddy', 80, 80, '2026-10-28');
  addAlloc('jug_wfd', 'event', 'kapoor', 30, 30, '2026-10-29');
  addAlloc('tray_ind', 'subscription', 'iyer', 20, 20, '2026-09-01');
  const inventory_allocations_with_details = A.filter((a) => a.is_active);
  const reference_allocation_history = A;
  const inventory_allocations = A.map(({ id: aid, outlet_id, inventory_item_id, reference_type, reference_id, allocated_quantity, is_active, created_at, updated_at }) => ({ id: aid, outlet_id, inventory_item_id, reference_type, reference_id, allocated_quantity, is_active, created_at, updated_at }));

  // ---------------------------------------------------------------- movements
  const M = [];
  const addMove = (itemKey, type, category, reason, qty, refType, refKey, notes, date, time, by = U.priya) => {
    const item = itemById[I[itemKey]];
    let reference_id = null;
    let reference_name = null;
    if (refType === 'event') { reference_id = E[refKey]; reference_name = events.find((e) => e.id === reference_id).event_name; }
    if (refType === 'subscription') { reference_id = S[refKey]; reference_name = clientById[subscriptions.find((s) => s.id === reference_id).client_id].name; }
    const mid = id('3e000001', M.length + 1);
    M.push({
      id: mid, movement_id: mid, outlet_id: item.outlet_id, inventory_item_id: item.id, movement_type: type, movement_category: category, reason_code: reason, quantity: qty,
      reference_type: refType, reference_id, notes, created_by: by, created_at: ist(date, time),
      item_name: item.name, item_category: item.category, item_unit: item.unit, outlet_name: item.outlet_name, outlet_code: item.outlet_code, reference_name, created_by_name: userName[by],
    });
  };
  addMove('jug_wfd', 'allocation', 'outflow', 'event_dispatch', 30, 'event', 'kapoor', 'Advance dispatch for sangeet setup', '2026-10-29', '09:05', U.kavya);
  addMove('quarter_krm', 'allocation', 'outflow', 'event_dispatch', 150, 'event', 'reddy', null, '2026-10-28', '17:40');
  addMove('cup_krm', 'allocation', 'outflow', 'event_dispatch', 80, 'event', 'reddy', null, '2026-10-28', '17:42');
  addMove('bowl300_wfd', 'return_damaged', 'return', 'client_damage', 6, 'subscription', 'prestige', 'Dented rims, sent for repair', '2026-10-27', '16:10', U.kavya);
  addMove('bowl300_wfd', 'return', 'return', 'normal_return', 30, 'subscription', 'prestige', null, '2026-10-27', '16:05', U.kavya);
  addMove('plate12_ind', 'return', 'return', 'normal_return', 598, 'event', 'sharma', 'Post-event pickup, counted at dock', '2026-10-19', '11:30');
  addMove('plate12_ind', 'return_damaged', 'return', 'client_damage', 15, 'event', 'sharma', 'Chipped edges', '2026-10-19', '11:35');
  addMove('plate12_ind', 'loss', 'writeoff', null, 7, 'event', 'sharma', 'Missing after event — billed as breakage', '2026-10-19', '11:40');
  addMove('glass_ind', 'loss', 'writeoff', null, 3, 'event', 'sharma', 'Broken at venue', '2026-10-19', '11:45');
  addMove('plate12_ind', 'allocation', 'outflow', 'event_dispatch', 650, 'event', 'sharma', null, '2026-10-17', '08:30');
  addMove('glass_ind', 'allocation', 'outflow', 'event_dispatch', 650, 'event', 'sharma', null, '2026-10-17', '08:32');
  addMove('glass_wfd', 'stock_in', 'inflow', 'new_purchase', 500, 'manual', null, 'PO-2026-118 from Borosil distributor', '2026-10-12', '14:00', U.kavya);
  addMove('spoon_ind', 'adjustment', 'adjustment', 'count_correction', -12, 'manual', null, 'Monthly count — 12 short', '2026-10-05', '18:20', U.admin);
  addMove('plate12_ind', 'send_to_repair', 'repair', null, 20, 'manual', null, 'Sent to Shivaji Nagar polishing unit', '2026-10-03', '12:00');
  addMove('glass_ind', 'disposal', 'writeoff', null, 12, 'manual', null, 'Cracked tumblers disposed', '2026-10-02', '17:10');
  addMove('katori_ind', 'stock_in', 'inflow', 'opening_balance', 2500, 'manual', null, 'Opening balance', '2026-09-01', '10:00', U.admin);
  const inventory_movements = M;

  const inventory_damage_loss_report = [
    { outlet_id: O.IND, outlet_name: 'Hybits Indiranagar', outlet_code: 'IND', inventory_item_id: I.plate12_ind, item_name: 'Steel dinner plate 12in', item_category: 'Plates', movement_type: 'damage', incident_count: 1, total_quantity: 15, report_date: '2026-10-19', reference_type: 'event', reference_id: E.sharma, reference_name: 'Sharma–Gupta Wedding Reception' },
    { outlet_id: O.IND, outlet_name: 'Hybits Indiranagar', outlet_code: 'IND', inventory_item_id: I.plate12_ind, item_name: 'Steel dinner plate 12in', item_category: 'Plates', movement_type: 'loss', incident_count: 1, total_quantity: 7, report_date: '2026-10-19', reference_type: 'event', reference_id: E.sharma, reference_name: 'Sharma–Gupta Wedding Reception' },
    { outlet_id: O.IND, outlet_name: 'Hybits Indiranagar', outlet_code: 'IND', inventory_item_id: I.glass_ind, item_name: 'Glass tumbler', item_category: 'Glassware', movement_type: 'loss', incident_count: 1, total_quantity: 3, report_date: '2026-10-19', reference_type: 'event', reference_id: E.sharma, reference_name: 'Sharma–Gupta Wedding Reception' },
    { outlet_id: O.WFD, outlet_name: 'Hybits Whitefield', outlet_code: 'WFD', inventory_item_id: I.bowl300_wfd, item_name: 'Bowl 300ml', item_category: 'Bowls', movement_type: 'damage', incident_count: 2, total_quantity: 6, report_date: '2026-10-27', reference_type: 'subscription', reference_id: S.prestige, reference_name: 'Prestige Tech Park Cafeteria' },
    { outlet_id: O.WFD, outlet_name: 'Hybits Whitefield', outlet_code: 'WFD', inventory_item_id: I.glass_wfd, item_name: 'Glass tumbler', item_category: 'Glassware', movement_type: 'loss', incident_count: 3, total_quantity: 12, report_date: '2026-10-08', reference_type: 'subscription', reference_id: S.prestige, reference_name: 'Prestige Tech Park Cafeteria' },
  ];

  // ------------------------------------------------------------------ audits
  const AUD = { indOct: id('ad000001', 1), wfdSep: id('ad000001', 2), indSep: id('ad000001', 3), krmOct: id('ad000001', 4) };
  const auditBase = (audit_id, outlet_id, period, status, items_total, items_counted, vp, vn, created, extra = {}) => ({
    audit_id, id: audit_id, outlet_id, outlet_name: outletById[outlet_id].name, outlet_code: outletById[outlet_id].code, period, status, items_total, items_counted,
    variance_positive: vp, variance_negative: vn, created_by: U.priya, created_by_name: 'Priya Nair', approved_by: null, approved_by_name: null, rejection_reason: null,
    created_at: ist(created, '10:00'), updated_at: ist('2026-10-28', '19:00'), submitted_at: null, approved_at: null,
    progress_percentage: items_total ? Math.round((items_counted / items_total) * 100) : 0,
    status_label: { counting: 'Counting', pending_approval: 'Pending approval', approved: 'Approved', rejected: 'Rejected', review: 'In review', draft: 'Draft' }[status],
    ...extra,
  });
  const inventory_audit_summary = [
    auditBase(AUD.indOct, O.IND, '2026-10', 'counting', 6, 4, 3, 18, '2026-10-27'),
    auditBase(AUD.krmOct, O.KRM, '2026-10', 'pending_approval', 3, 3, 0, 4, '2026-10-24', { submitted_at: ist('2026-10-26', '18:30') }),
    auditBase(AUD.wfdSep, O.WFD, '2026-09', 'approved', 4, 4, 2, 9, '2026-09-28', { created_by: U.kavya, created_by_name: 'Kavya Reddy', approved_by: U.admin, approved_by_name: 'Anil Kumar', submitted_at: ist('2026-09-30', '17:00'), approved_at: ist('2026-10-01', '10:20') }),
    auditBase(AUD.indSep, O.IND, '2026-09', 'rejected', 6, 6, 0, 48, '2026-09-27', { rejection_reason: 'Steel spoon count looks off by a full crate — recount please.', submitted_at: ist('2026-09-29', '19:00') }),
  ];
  const inventory_audits = inventory_audit_summary.map((a) => ({ id: a.audit_id, outlet_id: a.outlet_id, period: a.period, status: a.status, created_by: a.created_by, created_at: a.created_at, updated_at: a.updated_at }));

  const lines = [
    ['plate12_ind', 1520, 1523, 'found_stock', 'Three found in dish-pit rack', 'counted'],
    ['bowl300_ind', 2210, 2198, 'audit_shortage', 'Likely lost in Manyata rotation', 'counted'],
    ['glass_ind', 1205, 1205, null, null, 'counted'],
    ['spoon_ind', 3190, 3184, null, null, 'counted'],
    ['katori_ind', 2500, null, null, null, 'pending'],
    ['tray_ind', 96, null, null, null, 'pending'],
  ];
  const inventory_audit_line_items = lines.map(([ik, sys, phys, reason, notes, status], i) => ({
    id: id('a1e00001', i + 1), audit_id: AUD.indOct, inventory_item_id: I[ik], system_quantity: sys, physical_quantity: phys, variance: phys === null ? null : phys - sys,
    reason_code: reason, notes, status, created_at: ist('2026-10-27', '10:00'), updated_at: ist('2026-10-28', '18:45'),
  }));

  // ------------------------------------------------------------ admin views
  const admin_users_summary = user_profiles.map((u) => ({
    user_id: u.id, full_name: u.full_name, email: u.email, role: u.role, is_active: u.is_active,
    assigned_outlets: u.role === 'manager' ? user_outlet_assignments.filter((a) => a.user_id === u.id).map((a) => outletById[a.outlet_id].name) : [],
    created_at: u.created_at, updated_at: u.updated_at, last_login: u.last_login,
  }));
  const admin_outlets_summary = outlets.map((o) => ({
    outlet_id: o.id, outlet_name: o.name, outlet_code: o.code, city: o.city, address: o.address, is_active: o.is_active, created_at: o.created_at,
    user_count: user_outlet_assignments.filter((a) => a.outlet_id === o.id).length,
    client_count: clients.filter((c) => c.outlet_id === o.id && c.is_active).length,
    active_subscription_count: subscriptions.filter((s) => s.outlet_id === o.id && s.status === 'active').length,
    allocated_inventory_count: inventory_allocations_with_details.filter((a) => a.outlet_id === o.id).reduce((s, a) => s + a.outstanding_quantity, 0),
    active_event_count: events.filter((e) => e.outlet_id === o.id && e.status === 'planned').length,
  }));
  const act = (date, time, by, outlet, module, action_type, entity_id, description) => ({
    occurred_at: ist(date, time), user_id: by, user_name: by ? userName[by] : null, outlet_id: outlet, outlet_name: outletById[outlet].name, module, action_type, entity_id, description,
  });
  const admin_activity_log_unified = [
    act('2026-10-29', '09:05', U.kavya, O.WFD, 'inventory', 'allocation', I.jug_wfd, 'Allocated 30 × Water jug 1.5L to Kapoor Sangeet Night'),
    act('2026-10-29', '08:55', U.kavya, O.WFD, 'invoices', 'created', INV.draft_prestige_oct, 'Draft invoice created for Prestige Tech Park Cafeteria — ₹66,906.00'),
    act('2026-10-28', '17:20', U.kavya, O.WFD, 'invoices', 'created', INV.draft_kapoor, 'Draft invoice created for Kapoor Sangeet — Whitefield'),
    act('2026-10-28', '16:00', U.priya, O.KRM, 'invoices', 'finalized', INV.reddy_adv, 'Invoice HYB/KRM/2026-27/0015 finalized'),
    act('2026-10-27', '16:10', U.kavya, O.WFD, 'inventory', 'return_damaged', I.bowl300_wfd, '6 × Bowl 300ml returned damaged from Prestige Tech Park Cafeteria'),
    act('2026-10-26', '18:30', U.priya, O.KRM, 'inventory', 'audit_submitted', AUD.krmOct, 'Stock audit 2026-10 submitted for approval'),
    act('2026-10-22', '15:20', U.ramesh, O.IND, 'payments', 'recorded', INV.sharma, 'Payment ₹5,000.00 (cash) recorded on HYB/IND/2026-27/0042'),
    act('2026-10-21', '15:20', U.ramesh, O.IND, 'payments', 'recorded', INV.thirdwave_w42, 'Payment ₹3,717.00 (UPI) recorded on HYB/IND/2026-27/0041'),
    act('2026-10-20', '15:30', U.ramesh, O.IND, 'payments', 'voided', INV.sharma, 'Payment ₹2,500.00 voided — duplicate entry'),
    act('2026-10-20', '15:00', U.admin, O.WFD, 'subscriptions', 'updated', S.prestige, 'Next billing date moved to 30 Oct'),
    act('2026-10-19', '12:30', U.priya, O.IND, 'invoices', 'finalized', INV.sharma, 'Invoice HYB/IND/2026-27/0042 finalized — ₹34,411.75'),
    act('2026-10-18', '22:00', U.priya, O.IND, 'events', 'completed', E.sharma, 'Event "Sharma–Gupta Wedding Reception" marked completed'),
    act('2026-10-15', '11:30', U.kavya, O.WFD, 'clients', 'created', C.kapoor, 'Client "Kapoor Sangeet — Whitefield" created'),
    act('2026-10-08', '11:30', U.priya, O.KRM, 'clients', 'created', C.reddy, 'Client "Reddy Housewarming — HSR Layout" created'),
  ];
  const system_settings = [
    { key: 'inventory_negative_stock_tolerance', value: 0, description: 'Inventory negative stock tolerance (locked to 0 for production safety)', updated_at: ist('2025-04-01', '10:00'), updated_by: null },
    { key: 'invoice_auto_number', value: true, description: 'Enable automatic invoice numbering', updated_at: ist('2026-04-01', '10:05'), updated_by: U.admin },
    { key: 'payment_edit_window_days', value: 7, description: 'Number of days after payment creation during which edits are allowed', updated_at: ist('2026-06-12', '17:45'), updated_by: U.admin },
    { key: 'subscription_auto_renewal', value: true, description: 'Enable automatic subscription renewal notifications', updated_at: ist('2025-04-01', '10:00'), updated_by: null },
  ];

  // ------------------------------------------------------------ report views
  const issued = invoices_with_payment_status.filter((x) => ['finalized', 'partially_paid', 'paid'].includes(x.status));
  const istDate = (iso) => new Date(Date.parse(iso) + 5.5 * 3600e3).toISOString().slice(0, 10);
  const revMap = new Map();
  for (const inv of issued) {
    const k = `${istDate(inv.issued_at)}|${inv.outlet_id}|${inv.invoice_type}`;
    const row = revMap.get(k) ?? { report_date: istDate(inv.issued_at), outlet_id: inv.outlet_id, outlet_name: outletById[inv.outlet_id].name, invoice_type: inv.invoice_type, invoice_count: 0, total_invoiced: 0, total_collected: 0, outstanding: 0 };
    row.invoice_count += 1;
    row.total_invoiced = r2(row.total_invoiced + inv.grand_total);
    row.total_collected = r2(row.total_collected + inv.amount_paid);
    row.outstanding = r2(row.outstanding + inv.balance_due);
    revMap.set(k, row);
  }
  const report_revenue_daily = [...revMap.values()];

  const payMap = new Map();
  for (const p of payments.filter((x) => x.is_active)) {
    const k = `${p.payment_date}|${p.invoice_id}|${p.payment_method}`;
    const row = payMap.get(k) ?? { report_date: p.payment_date, invoice_id: p.invoice_id, outlet_id: p.outlet_id, outlet_name: p.outlet_name, payment_method: p.payment_method, payment_count: 0, total_amount: 0 };
    row.payment_count += 1;
    row.total_amount = r2(row.total_amount + p.amount);
    payMap.set(k, row);
  }
  const report_payments_daily = [...payMap.values()];

  const today = Date.parse('2026-10-29T12:00:00+05:30');
  const report_outstanding_aging = issued.filter((x) => x.balance_due > 0).map((inv) => {
    const days = Math.floor((today - Date.parse(inv.issued_at)) / 86400e3);
    const [bucket, order] = days <= 30 ? ['0-30', 1] : days <= 60 ? ['31-60', 2] : days <= 90 ? ['61-90', 3] : ['90+', 4];
    const c = clientById[inv.client_id];
    const o = outletById[inv.outlet_id];
    return { invoice_id: inv.id, invoice_number: inv.invoice_number, invoice_type: inv.invoice_type, invoice_date: istDate(inv.issued_at), grand_total: inv.grand_total, amount_paid: inv.amount_paid, balance_due: inv.balance_due, client_id: c.id, client_name: c.name, client_phone: c.phone, outlet_id: o.id, outlet_name: o.name, outlet_code: o.code, days_outstanding: days, aging_bucket: bucket, bucket_order: order };
  });

  const cycleMult = { daily: 30, weekly: 4.33, monthly: 1 };
  const report_subscription_mrr = subscriptions.filter((s) => s.status !== 'cancelled').map((s) => {
    const c = clientById[s.client_id];
    const o = outletById[s.outlet_id];
    const cycle_amount = r2(s.quantity * s.price_per_unit);
    const mrr = s.status === 'active' ? r2(cycle_amount * cycleMult[s.billing_cycle]) : 0;
    return { subscription_id: s.id, outlet_id: o.id, outlet_name: o.name, outlet_code: o.code, client_id: c.id, client_name: c.name, billing_cycle: s.billing_cycle, status: s.status, quantity: s.quantity, price_per_unit: s.price_per_unit, start_date: s.start_date, next_billing_date: s.next_billing_date, cycle_amount, mrr, annual_value: r2(mrr * 12) };
  });

  const report_client_revenue = clients.filter((c) => c.is_active).map((c) => {
    const inv = issued.filter((x) => x.client_id === c.id);
    const o = outletById[c.outlet_id];
    const sum = (arr, f) => r2(arr.reduce((s, x) => s + f(x), 0));
    return {
      client_id: c.id, client_name: c.name, client_type: c.client_type, client_phone: c.phone, client_email: c.email, outlet_id: o.id, outlet_name: o.name, outlet_code: o.code,
      invoice_count: inv.length, subscription_invoice_count: inv.filter((x) => x.invoice_type === 'subscription').length, event_invoice_count: inv.filter((x) => x.invoice_type === 'event').length,
      total_invoiced: sum(inv, (x) => x.grand_total), total_collected: sum(inv, (x) => x.amount_paid), outstanding: sum(inv, (x) => x.balance_due),
      subscription_revenue: sum(inv.filter((x) => x.invoice_type === 'subscription'), (x) => x.grand_total), event_revenue: sum(inv.filter((x) => x.invoice_type === 'event'), (x) => x.grand_total),
      active_subscriptions: subscriptions.filter((s) => s.client_id === c.id && s.status === 'active').length, completed_events: events.filter((e) => e.client_id === c.id && e.status === 'completed').length,
    };
  }).filter((r) => r.invoice_count > 0 || r.active_subscriptions > 0);

  const report_outlet_performance = outlets.filter((o) => o.is_active).map((o) => {
    const inv = issued.filter((x) => x.outlet_id === o.id);
    const cl = clients.filter((c) => c.outlet_id === o.id && c.is_active);
    const sub = subscriptions.filter((s) => s.outlet_id === o.id);
    const ev = events.filter((e) => e.outlet_id === o.id);
    const total_invoiced = r2(inv.reduce((s, x) => s + x.grand_total, 0));
    const total_collected = r2(inv.reduce((s, x) => s + x.amount_paid, 0));
    return {
      outlet_id: o.id, outlet_name: o.name, outlet_code: o.code, city: o.city, state: o.state,
      active_clients: cl.length, corporate_clients: cl.filter((c) => c.client_type === 'corporate').length, event_clients: cl.filter((c) => c.client_type === 'event').length,
      total_invoices: inv.length, subscription_invoices: inv.filter((x) => x.invoice_type === 'subscription').length, event_invoices: inv.filter((x) => x.invoice_type === 'event').length,
      total_invoiced, total_collected, outstanding: r2(total_invoiced - total_collected), collection_rate_percent: total_invoiced ? r2((total_collected / total_invoiced) * 100) : 0,
      active_subscriptions: sub.filter((s) => s.status === 'active').length, paused_subscriptions: sub.filter((s) => s.status === 'paused').length, cancelled_subscriptions: sub.filter((s) => s.status === 'cancelled').length,
      mrr: r2(report_subscription_mrr.filter((m) => m.outlet_id === o.id).reduce((s, m) => s + m.mrr, 0)),
      completed_events: ev.filter((e) => e.status === 'completed').length, cancelled_events: ev.filter((e) => e.status === 'cancelled').length, planned_events: ev.filter((e) => e.status === 'planned').length,
    };
  });

  // GST working sheets
  const gstRow = (inv) => {
    const c = clientById[inv.client_id];
    const o = outletById[inv.outlet_id];
    const items = invoice_items.filter((it) => it.invoice_id === inv.id);
    const rates = [...new Set(items.map((it) => it.tax_rate))];
    const intra = c.gst_type !== 'sez' && c.gst_type !== 'export';
    return {
      invoice_id: inv.id, invoice_date: istDate(inv.issued_at), invoice_number: inv.invoice_number, party_name: c.name, gst_number: c.gstin ?? '', hsn_sac_code: '9985',
      as_per_your_invoice: inv.grand_total, taxable_value: inv.subtotal, rate: rates[0], rate_label: rates.length > 1 ? rates.map((r) => `${r}%`).join(' + ') : null,
      igst: intra ? 0 : inv.tax_total, cgst: intra ? r2(inv.tax_total / 2) : 0, sgst: intra ? r2(inv.tax_total / 2) : 0, total: inv.grand_total, outlet_id: o.id, outlet_name: o.name,
    };
  };
  const gstIssued = issued.filter((x) => x.status !== 'cancelled');
  const gst_working_domestic = gstIssued.filter((x) => { const t = clientById[x.client_id].gst_type; return !t || t === 'domestic'; }).map(gstRow);
  const gst_working_sez = gstIssued.filter((x) => clientById[x.client_id].gst_type === 'sez').map((x) => { const r = gstRow(x); const { hsn_sac_code, ...rest } = r; return { ...rest, hsn_code: hsn_sac_code }; });
  const gst_working_export = gstIssued.filter((x) => clientById[x.client_id].gst_type === 'export').map((x) => { const r = gstRow(x); const { hsn_sac_code, ...rest } = r; return { ...rest, hsn_code: hsn_sac_code, currency: 'USD' }; });

  // Strip private helper fields
  for (const inv of invoices) delete inv._paid;
  for (const inv of invoices_with_payment_status) delete inv._paid;

  const db = {
    outlets, user_profiles, user_outlet_assignments, clients, subscriptions, subscription_price_history, events,
    invoices, invoice_items, invoices_with_payment_status, payments, payments_with_details: payments,
    inventory_items, inventory_stock_summary, inventory_allocations, inventory_allocations_with_details, reference_allocation_history,
    inventory_movements, inventory_movements_with_details: inventory_movements, inventory_damage_loss_report,
    inventory_audits, inventory_audit_summary, inventory_audit_line_items,
    admin_users_summary, admin_outlets_summary, admin_activity_log_unified, system_settings,
    report_revenue_daily, report_payments_daily, report_outstanding_aging, report_subscription_mrr, report_client_revenue, report_outlet_performance,
    gst_working_domestic, gst_working_sez, gst_working_export,
  };

  const refs = { U, O, C, S, E, INV, I, AUD };
  return { db, refs };
}
