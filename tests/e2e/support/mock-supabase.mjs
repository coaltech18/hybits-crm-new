// Minimal in-memory Supabase (GoTrue + PostgREST) used via Playwright page.route.
// Supports: filters (eq/neq/gt/gte/lt/lte/like/ilike/is/in/not.*/or/and, incl.
// embedded paths like clients.name), order, limit/offset, Range header,
// Prefer count=exact (Content-Range), HEAD, Accept object+json (.single()),
// embedded resources resolved from FK columns, and /rpc/<fn>.

const SINGULAR = {
  clients: 'client', outlets: 'outlet', events: 'event', invoices: 'invoice', subscriptions: 'subscription',
  inventory_items: 'inventory_item', user_profiles: 'user', payments: 'payment', inventory_audits: 'audit',
};
const FK_TARGET = {
  client_id: 'clients', outlet_id: 'outlets', event_id: 'events', invoice_id: 'invoices', subscription_id: 'subscriptions',
  inventory_item_id: 'inventory_items', user_id: 'user_profiles', created_by: 'user_profiles', changed_by: 'user_profiles',
  updated_by: 'user_profiles', approved_by: 'user_profiles', audit_id: 'inventory_audits',
};

// ---------------------------------------------------------------- select parsing
function splitTop(s, sep = ',') {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === sep && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

export function parseSelect(sel) {
  const clean = (sel || '*').replace(/\s+/g, '');
  const nodes = [];
  for (const tok of splitTop(clean)) {
    const m = tok.match(/^([^()]+)\((.*)\)$/);
    if (!m) continue; // plain column (we return full rows)
    let head = m[1];
    let alias = null;
    if (head.includes(':')) [alias, head] = head.split(':');
    let hint = null;
    let inner = false;
    const parts = head.split('!');
    head = parts[0];
    for (const p of parts.slice(1)) { if (p === 'inner') inner = true; else if (p !== 'left') hint = p; }
    nodes.push({ key: alias || head, rel: head, hint, inner, children: parseSelect(m[2]) });
  }
  return nodes;
}

function resolveEmbeds(db, table, row, nodes) {
  const out = { ...row };
  for (const n of nodes) {
    let target = db[n.rel] ? n.rel : null;
    let fkCol = null;
    if (n.rel.endsWith('_id') || n.rel === 'created_by' || n.rel === 'changed_by') { fkCol = n.rel; target = FK_TARGET[n.rel]; }
    if (n.hint) {
      // e.g. subscription_price_history_changed_by_fkey → changed_by
      const h = n.hint.replace(/_fkey$/, '').replace(new RegExp(`^${table}_`), '');
      if (h in row) fkCol = h;
      else if (FK_TARGET[n.hint]) fkCol = n.hint;
    }
    if (!target) { out[n.key] = null; continue; }
    if (!fkCol) {
      const sing = SINGULAR[target] ?? target.replace(/s$/, '');
      if (`${sing}_id` in row) fkCol = `${sing}_id`;
    }
    const rows = db[target] || [];
    if (fkCol) {
      const hit = rows.find((r) => r.id === row[fkCol]);
      out[n.key] = hit ? resolveEmbeds(db, target, hit, n.children) : null;
    } else {
      // one-to-many: target has <singular(table)>_id
      const back = `${SINGULAR[table] ?? table.replace(/s$/, '')}_id`;
      out[n.key] = rows.filter((r) => r[back] === row.id).map((r) => resolveEmbeds(db, target, r, n.children));
    }
  }
  return out;
}

// ---------------------------------------------------------------- filters
function getPath(row, path) {
  return path.split('.').reduce((v, k) => (v == null ? undefined : Array.isArray(v) ? v.map((x) => x?.[k]) : v[k]), row);
}
function unquote(v) { return v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v; }
function coerce(raw, sample) {
  const v = unquote(raw);
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (typeof sample === 'number' && v !== '' && !isNaN(Number(v))) return Number(v);
  return v;
}
function likeToRegex(p, ci) {
  const esc = p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${esc}$`, ci ? 'is' : 's');
}
function cmp(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean') return Number(a) - Number(b);
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}
function testOp(value, op, raw) {
  const vals = Array.isArray(value) ? value : [value];
  const one = (v) => {
    switch (op) {
      case 'eq': return v === coerce(raw, v) || String(v) === unquote(raw);
      case 'neq': return !(v === coerce(raw, v) || String(v) === unquote(raw));
      case 'gt': return v != null && cmp(v, coerce(raw, v)) > 0;
      case 'gte': return v != null && cmp(v, coerce(raw, v)) >= 0;
      case 'lt': return v != null && cmp(v, coerce(raw, v)) < 0;
      case 'lte': return v != null && cmp(v, coerce(raw, v)) <= 0;
      case 'like': return v != null && likeToRegex(raw, false).test(String(v));
      case 'ilike': return v != null && likeToRegex(raw, true).test(String(v));
      case 'is': { const t = raw.toLowerCase(); return t === 'null' ? v == null : t === 'true' ? v === true : t === 'false' ? v === false : false; }
      case 'in': {
        const list = splitTop(raw.replace(/^\(|\)$/g, '')).map(unquote);
        return list.some((x) => String(v) === x);
      }
      case 'cs': return Array.isArray(v) && JSON.parse(raw.replace(/^\{/, '[').replace(/\}$/, ']')).every((x) => v.includes(x));
      case 'fts': case 'plfts': case 'wfts': case 'phfts': return true;
      default: return true;
    }
  };
  return vals.some(one);
}
function evalCond(row, col, expr) {
  let neg = false;
  let e = expr;
  if (e.startsWith('not.')) { neg = true; e = e.slice(4); }
  const dot = e.indexOf('.');
  const op = e.slice(0, dot);
  const raw = e.slice(dot + 1);
  const res = testOp(getPath(row, col), op, raw);
  return neg ? !res : res;
}
function evalLogic(row, kind, body) {
  // body like "(a.eq.1,b.ilike.*x*,and(c.eq.2,d.eq.3))"
  const parts = splitTop(body.replace(/^\(|\)$/g, ''));
  const results = parts.map((p) => {
    const lm = p.match(/^(not\.)?(and|or)\((.*)\)$/);
    if (lm) { const r = evalLogic(row, lm[2], `(${lm[3]})`); return lm[1] ? !r : r; }
    const d = p.indexOf('.');
    return evalCond(row, p.slice(0, d), p.slice(d + 1));
  });
  return kind === 'or' ? results.some(Boolean) : results.every(Boolean);
}

function applyQuery(rows, params) {
  let out = rows;
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(k)) continue;
    if (k === 'or' || k === 'and') { out = out.filter((r) => evalLogic(r, k, v)); continue; }
    if (k === 'not.or' || k === 'not.and') { out = out.filter((r) => !evalLogic(r, k.slice(4), v)); continue; }
    if (k.endsWith('.or') || k.endsWith('.and')) continue; // embedded logic: ignore
    out = out.filter((r) => evalCond(r, k, v));
  }
  const order = params.get('order');
  if (order) {
    const specs = order.split(',').map((s) => {
      const [col, ...mods] = s.split('.');
      return { col, desc: mods.includes('desc'), nullsFirst: mods.includes('nullsfirst') };
    });
    out = [...out].sort((a, b) => {
      for (const s of specs) {
        const av = getPath(a, s.col);
        const bv = getPath(b, s.col);
        if (av == null || bv == null) {
          if (av == null && bv == null) continue;
          const nf = s.nullsFirst ? -1 : 1;
          return av == null ? nf * (s.desc && !s.nullsFirst ? -1 : 1) : -nf * (s.desc && !s.nullsFirst ? -1 : 1);
        }
        const c = cmp(av, bv);
        if (c !== 0) return s.desc ? -c : c;
      }
      return 0;
    });
  }
  return out;
}

// ---------------------------------------------------------------- RPCs
function rpc(fn, body, db, mode) {
  switch (fn) {
    case 'record_login': return { status: 204 };
    case 'payments_summary': {
      if (mode === 'empty') return { json: [{ total_amount: 0, total_count: 0, today_amount: 0, today_count: 0, voided_count: 0 }] };
      const p = db.payments || [];
      const inRange = (x) => (!body.p_date_from || x.payment_date >= body.p_date_from) && (!body.p_date_to || x.payment_date <= body.p_date_to)
        && (!body.p_method || x.payment_method === body.p_method) && (!body.p_outlet || x.outlet_id === body.p_outlet);
      const active = p.filter((x) => x.is_active && inRange(x));
      const today = body.p_today || '2026-10-29';
      const todays = p.filter((x) => x.is_active && x.payment_date === today && (!body.p_method || x.payment_method === body.p_method) && (!body.p_outlet || x.outlet_id === body.p_outlet));
      const sum = (a) => Math.round(a.reduce((s, x) => s + x.amount, 0) * 100) / 100;
      return { json: [{ total_amount: sum(active), total_count: active.length, today_amount: sum(todays), today_count: todays.length, voided_count: p.filter((x) => !x.is_active && inRange(x)).length }] };
    }
    case 'set_user_outlet_assignments': return { status: 204 };
    case 'create_inventory_audit': return { json: (db.inventory_audits || [])[0]?.id ?? null };
    case 'submit_inventory_audit': case 'approve_inventory_audit': return { json: null };
    default: return null;
  }
}

// ---------------------------------------------------------------- auth
export function makeJwt(payload) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const sig = Buffer.from('e2e-mock-not-a-real-signature-0123456789').toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT', kid: 'e2e-mock' })}.${b64(payload)}.${sig}`;
}

export function buildSession(user) {
  const now = Math.floor(Date.now() / 1000);
  const exp = 4102444800; // 2100-01-01
  const access_token = makeJwt({
    iss: 'supabase', sub: user.id, aud: 'authenticated', role: 'authenticated', email: user.email,
    exp, iat: now, session_id: '5e551011-0000-4000-8000-000000000001', aal: 'aal1', is_anonymous: false,
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { full_name: user.full_name },
  });
  const authUser = {
    id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, email_confirmed_at: '2025-04-01T04:30:00Z',
    phone: '', confirmed_at: '2025-04-01T04:30:00Z', last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { full_name: user.full_name },
    identities: [], created_at: '2025-04-01T04:30:00Z', updated_at: new Date().toISOString(), is_anonymous: false,
  };
  return { access_token, token_type: 'bearer', expires_in: exp - now, expires_at: exp, refresh_token: 'e2e-mock-refresh-token', user: authUser };
}

// ---------------------------------------------------------------- route handler
/**
 * @param {object} opts { db, session, mode: 'normal'|'empty'|'error', log: (entry)=>void }
 */
export function createHandler({ db, session, mode = 'normal', log }) {
  const AUTH_TABLES = new Set(['user_profiles', 'outlets', 'user_outlet_assignments']);
  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const path = url.pathname;
    const headers = req.headers();
    const cors = {
      'access-control-allow-origin': headers.origin || '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS',
      'access-control-expose-headers': 'Content-Range, X-Total-Count, Content-Profile',
    };
    const send = (status, body, extra = {}) =>
      route.fulfill({
        status,
        headers: { ...cors, 'content-type': 'application/json; charset=utf-8', ...extra },
        body: body === undefined || status === 204 || method === 'HEAD' ? '' : JSON.stringify(body),
      });

    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors, body: '' });

    // ----- GoTrue
    if (path.startsWith('/auth/v1/')) {
      const ep = path.slice('/auth/v1/'.length);
      log?.({ kind: 'auth', method, path });
      if (ep === 'user') return send(200, session.user);
      if (ep === 'token') return send(200, session);
      if (ep === 'logout') return send(204);
      if (ep === 'settings') return send(200, { external: { email: true }, disable_signup: true, mailer_autoconfirm: false });
      return send(200, {});
    }

    // ----- PostgREST
    if (path.startsWith('/rest/v1/')) {
      const name = decodeURIComponent(path.slice('/rest/v1/'.length));
      const params = url.searchParams;
      let body = {};
      try { body = req.postDataJSON() ?? {}; } catch { body = {}; }

      if (mode === 'error' && !AUTH_TABLES.has(name) && name !== 'rpc/record_login') {
        log?.({ kind: 'rest-error-injected', method, name });
        return send(500, { code: 'XX000', details: null, hint: null, message: 'Simulated server error (e2e mock)' });
      }

      if (name.startsWith('rpc/')) {
        const fn = name.slice(4);
        const r = rpc(fn, body, db, mode);
        log?.({ kind: 'rpc', fn, known: !!r });
        if (!r) return send(200, null);
        return r.status === 204 ? send(204) : send(200, r.json);
      }

      const known = Object.prototype.hasOwnProperty.call(db, name);
      let rows = known ? db[name] : [];
      if (mode === 'empty' && !AUTH_TABLES.has(name)) rows = [];
      log?.({ kind: 'rest', method, name, known, query: url.search });

      if (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
        // Never mutate fixtures; echo something plausible.
        const echo = Array.isArray(body) ? body : [{ ...(rows[0] || {}), ...body }];
        const wantsObject = (headers.accept || '').includes('vnd.pgrst.object');
        return send(method === 'POST' ? 201 : 200, wantsObject ? echo[0] : echo);
      }

      const nodes = parseSelect(params.get('select'));
      let resolved = rows.map((r) => resolveEmbeds(db, name, r, nodes));
      // !inner embeds drop rows whose embed is null/empty
      for (const n of nodes.filter((x) => x.inner)) resolved = resolved.filter((r) => (Array.isArray(r[n.key]) ? r[n.key].length : r[n.key]));
      // embedded-path filters on !inner embeds need the row dropped; filters on non-inner just narrow — treat both as row filters
      const filtered = applyQuery(resolved, params);
      const total = filtered.length;

      let offset = Number(params.get('offset') || 0);
      let limit = params.has('limit') ? Number(params.get('limit')) : Infinity;
      const range = headers.range;
      if (range) {
        const m = range.match(/(\d+)-(\d+)?/);
        if (m) { offset = Number(m[1]); if (m[2]) limit = Number(m[2]) - offset + 1; }
      }
      const page = filtered.slice(offset, offset + limit);
      const prefer = headers.prefer || '';
      const countExact = /count=(exact|planned|estimated)/.test(prefer);
      const end = page.length ? offset + page.length - 1 : null;
      const contentRange = `${end === null ? '*' : `${offset}-${end}`}/${countExact ? total : '*'}`;
      const extra = { 'content-range': contentRange };

      if (method === 'HEAD') return send(200, undefined, extra);

      if ((headers.accept || '').includes('application/vnd.pgrst.object+json')) {
        if (page.length !== 1) {
          return send(406, { code: 'PGRST116', details: `The result contains ${page.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' }, extra);
        }
        return send(200, page[0], extra);
      }
      return send(200, page, extra);
    }

    // storage / functions / realtime: not used by the app → empty
    log?.({ kind: 'other-supabase', method, path });
    return send(200, {});
  };
}
