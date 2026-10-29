// Migration test: applies supabase/*.sql to a fresh PGlite (real Postgres
// compiled to WASM, in-process) in the canonical order from
// supabase/MIGRATION_ORDER.md, then runs every *_verify.sql, the smoke
// checks in smoke-042.sql and, on the final schema, the business-flow tests
// in flows.sql (each run as a real admin / manager / accountant session).
//
//   npm run test:db
//
// Steps run in sequence on one database; after the first failure the rest
// are skipped. supabase-stubs.sql emulates what hosted Supabase provides
// (API roles, auth.users, auth.uid()/auth.jwt()); seed-pre042.sql loads
// production-like rows right before 042 so its backfills and repairs run on
// data. No network, no real Supabase project.
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readMigrationOrder } from './migration-order.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SUPABASE = path.resolve(HERE, '../../supabase');
const SEED_BEFORE = '042_bug_fixes.sql';
const VERBOSE = !!process.env.MIGRATION_TEST_VERBOSE;

const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
/** Highest migration number a verify script covers: 040_041_verify.sql -> 41. */
const verifyTarget = (f) => Math.max(...(f.match(/\d{3}/g) ?? []).map(Number));
const migrationNumber = (f) => Number(f.slice(0, 3));

const { order, verifies } = readMigrationOrder(SUPABASE);
/** Split a file on "-- @@ <name>" markers; each chunk runs as its own step. */
const chunks = (file) => read(HERE, file)
  .split(/^-- @@ /m)
  .slice(1)
  .map((c) => ({ name: c.slice(0, c.indexOf('\n')).trim(), sql: `-- @@ ${c}` }));
const smokeChunks = chunks('smoke-042.sql');
const flowChunks = chunks('flows.sql');

const db = await PGlite.create({ extensions: { uuid_ossp, pgcrypto } });
let broken = null;

function lineAt(sql, position) {
  if (!position) return '';
  const n = sql.slice(0, Number(position) - 1).split('\n').length;
  const lines = sql.split('\n');
  return `\n  at line ${n}: ${lines[n - 1]?.trim()}`;
}

/** Run one SQL file as a step; NOTICEs are attached to the failure message. */
function step(name, sql, { continueOnFail = false } = {}) {
  test(name, async (t) => {
    if (broken) return t.skip(`after failure in ${broken}`);
    const notices = [];
    try {
      await db.exec(sql, { onNotice: (n) => notices.push(`${n.severity}: ${n.message}`) });
      if (VERBOSE) for (const n of notices) t.diagnostic(n);
    } catch (e) {
      try { await db.exec('ROLLBACK'); } catch { /* not in a transaction */ }
      if (!continueOnFail) broken = name;
      const extra = [e.detail && `DETAIL: ${e.detail}`, e.hint && `HINT: ${e.hint}`, e.where && `WHERE: ${e.where}`]
        .filter(Boolean).join('\n');
      throw new Error(`${e.message}${lineAt(sql, e.position)}${extra ? `\n${extra}` : ''}`
        + (notices.length ? `\nNOTICES:\n${notices.slice(-20).join('\n')}` : ''));
    }
  });
}

/** Verify scripts and smoke chunks are all BEGIN ... ROLLBACK, so a failure doesn't stop the others. */
function checks(label, files) {
  for (const f of files) step(`${f}${label}`, read(SUPABASE, f), { continueOnFail: true });
  for (const c of smokeChunks) step(`smoke ${c.name}${label}`, c.sql, { continueOnFail: true });
}

test('MIGRATION_ORDER.md lists every migration file', () => {
  // readMigrationOrder() already threw at import time if it did not.
  if (!order.length) throw new Error('no migrations found');
});

step('supabase-stubs.sql', read(HERE, 'supabase-stubs.sql'));

const last = order[order.length - 1];
for (const f of order) {
  if (f === SEED_BEFORE) step('seed-pre042.sql', read(HERE, 'seed-pre042.sql'));
  step(f, read(SUPABASE, f));
  // 042 and 043 are applied separately in production, so check the state
  // between them too: every verify script up to 042 plus the smoke checks.
  if (f === SEED_BEFORE && f !== last) {
    checks(` (after ${f.slice(0, 3)})`, verifies.filter((v) => verifyTarget(v) <= migrationNumber(f)));
  }
}

checks('', verifies);
for (const c of flowChunks) step(`flow ${c.name}`, c.sql, { continueOnFail: true });

test('close database', async () => { await db.close(); });
