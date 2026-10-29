import { useEffect, type RefObject } from 'react';

// ================================================================
// LEDGER LABELS — phones read tables as labelled cards.
// Copies each column's header text onto its body cells as
// `data-label`, so index.css can show "Balance due  ₹14,411.75"
// on narrow screens without every page hand-writing labels.
// Rows whose cell count doesn't match the header (colspan empty
// states, totals) are left unlabelled and render as plain blocks.
// ================================================================

function labelTable(table: HTMLTableElement) {
  const headCells = Array.from(table.tHead?.rows[0]?.cells ?? []);
  // `data-nolabel` on a <th> (e.g. an actions column) keeps its cells unlabelled on phones.
  const heads = headCells.map((th) => (th.hasAttribute('data-nolabel') ? '' : th.textContent?.trim() ?? ''));
  if (!heads.length) return;
  // Numeric columns: right-align the header over right-aligned figures.
  const firstRow = table.tBodies[0]?.rows[0];
  if (firstRow && firstRow.cells.length === headCells.length) {
    headCells.forEach((th, i) => {
      const td = firstRow.cells[i];
      if (td.classList.contains('text-right') || td.classList.contains('amount')) th.classList.add('text-right');
    });
  }
  for (const body of [...Array.from(table.tBodies), ...(table.tFoot ? [table.tFoot] : [])]) {
    for (const row of Array.from(body.rows)) {
      const cells = Array.from(row.cells);
      if (cells.length !== heads.length) continue;
      cells.forEach((td, i) => {
        if (heads[i] && td.getAttribute('data-label') !== heads[i]) td.setAttribute('data-label', heads[i]);
      });
    }
  }
}

/** Keep every `table.ledger` under `rootRef` labelled as pages render and re-render. */
export function useLedgerLabels(rootRef: RefObject<HTMLElement>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => root.querySelectorAll<HTMLTableElement>('table.ledger').forEach(labelTable));
    };
    run();
    const observer = new MutationObserver(run);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [rootRef]);
}
