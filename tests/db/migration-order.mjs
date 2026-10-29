// Reads the canonical migration order from supabase/MIGRATION_ORDER.md, so the
// test runs exactly what the owner pastes into the SQL editor and fails when a
// new migration file is added without being listed there.
//
// The "Canonical order" table's File column holds either full filenames
// (`013_fix_payment_rounding.sql`), single prefixes (`024`, `025`) or a range
// (`001` … `010`). Struck-through rows (~~...~~) are deprecated and skipped.
import fs from 'node:fs';
import path from 'node:path';

const isVerify = (f) => /_verify\.sql$/.test(f);
const NOT_MIGRATIONS = new Set(['data_reset.sql']);

export function readMigrationOrder(supabaseDir) {
  const md = fs.readFileSync(path.join(supabaseDir, 'MIGRATION_ORDER.md'), 'utf8');
  const all = fs.readdirSync(supabaseDir).filter((f) => f.endsWith('.sql')).sort();
  const migrations = all.filter((f) => !isVerify(f) && !NOT_MIGRATIONS.has(f));

  const section = md.split(/^## /m).find((s) => s.startsWith('Canonical order'));
  if (!section) throw new Error('MIGRATION_ORDER.md has no "## Canonical order" section');

  const order = [];
  const deprecated = [];
  for (const line of section.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    const fileCell = line.split('|')[2] ?? '';
    const tokens = [...fileCell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    if (!tokens.length) continue;
    if (fileCell.includes('~~')) { deprecated.push(...tokens); continue; }

    if (fileCell.includes('…')) {
      const [lo, hi] = tokens.map(Number);
      const inRange = migrations.filter((f) => {
        const n = Number(f.slice(0, 3));
        return /^\d{3}_/.test(f) && n >= lo && n <= hi;
      });
      // A shared prefix inside a range (two 013 files) must be listed by name.
      const prefixes = inRange.map((f) => f.slice(0, 3));
      const dup = prefixes.find((p, i) => prefixes.indexOf(p) !== i);
      if (dup) throw new Error(`Range ${lo}…${hi} contains two ${dup}_ files; list them by name`);
      order.push(...inRange);
      continue;
    }

    for (const t of tokens) {
      if (t.endsWith('.sql')) {
        if (!migrations.includes(t)) throw new Error(`MIGRATION_ORDER.md lists ${t}, which is not in supabase/`);
        order.push(t);
      } else {
        const hits = migrations.filter((f) => f.startsWith(`${t}_`));
        if (hits.length !== 1) throw new Error(`Prefix ${t} in MIGRATION_ORDER.md matches ${hits.length} files: ${hits.join(', ')}`);
        order.push(hits[0]);
      }
    }
  }

  const dupes = order.filter((f, i) => order.indexOf(f) !== i);
  if (dupes.length) throw new Error(`Listed twice in MIGRATION_ORDER.md: ${dupes.join(', ')}`);
  const unlisted = migrations.filter((f) => !order.includes(f) && !deprecated.includes(f));
  if (unlisted.length) throw new Error(`Not in MIGRATION_ORDER.md (add them to the canonical order): ${unlisted.join(', ')}`);

  return { order, deprecated, verifies: all.filter(isVerify) };
}
