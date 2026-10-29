// ================================================================
// SAFE SEARCH PATTERNS FOR SUPABASE
// ================================================================
// Never interpolate user text into .or('a.ilike.%x%,...') — commas,
// parentheses and dots in the text break or extend the filter.
// Use ilikePattern() with .ilike(column, pattern), or orIlike() which
// quotes the value per PostgREST rules.
// ================================================================

/** Escape LIKE wildcards and wrap for a contains-match. */
export function ilikePattern(text: string): string {
  return `%${text.trim().replace(/[\\%_]/g, (m) => '\\' + m)}%`;
}

/** Build a PostgREST `or` filter "col.ilike.<quoted>,..." with the value safely double-quoted. */
export function orIlike(columns: string[], text: string): string {
  const quoted = `"${ilikePattern(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  return columns.map((c) => `${c}.ilike.${quoted}`).join(',');
}

/**
 * Readable message for a failed `{ count: 'exact', head: true }` query.
 * HEAD responses have no body, so PostgREST errors arrive with an empty
 * message; fall back to "Could not count <thing> (HTTP <status>)".
 */
export function countErrorMessage(
  error: { message?: string | null } | null | undefined,
  status: number | null | undefined,
  thing: string
): string {
  const message = error?.message?.trim();
  if (message) return message;
  return `Could not count ${thing} (HTTP ${status || 'error'})`;
}
