/**
 * @module organisation-matching
 * Single, shared implementation of "does a matching organisation already
 * exist for (company name, area)?" — used by every server-side write path
 * that creates organisations from user-supplied data: the Award Areas
 * import, and the two public entry-submission endpoints.
 *
 * This module is READ-ONLY by design. It never updates, merges, or
 * otherwise modifies an organisation. Callers decide what to do with the
 * returned id (reuse it, or apply their own update/replace logic) — that
 * decision must never move into this helper, since two of its three
 * callers are unauthenticated public endpoints that must never gain the
 * ability to modify an existing organisation's stored data.
 */

/**
 * Escape the characters ILIKE treats specially (`%`, `_`, and the escape
 * character `\` itself) so a pattern match behaves as an exact,
 * case-insensitive comparison instead of a wildcard match.
 * @param {string} value
 * @returns {string}
 */
function escapeLikePattern(value) {
  return String(value).replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Find an existing organisation matching `companyName` within `areaId`.
 *
 * Matching is exact and case-insensitive (wildcard characters in
 * `companyName` are escaped, never interpreted as patterns). If `areaId`
 * cannot be resolved by the caller, pass `null`/`undefined` — this
 * function then always returns `null` rather than matching globally,
 * so an organisation is never reused across areas by accident.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} companyName
 * @param {string|null|undefined} areaId
 * @returns {Promise<string|null>} matching organisation id, or null
 */
async function findMatchingOrganisation(supabase, companyName, areaId) {
  if (!companyName || !areaId) return null;

  const { data, error } = await supabase
    .from('organisations')
    .select('id')
    .ilike('company_name', escapeLikePattern(companyName))
    .eq('area_id', areaId)
    .limit(1);

  if (error) throw error;
  return data && data[0] ? data[0].id : null;
}

module.exports = { findMatchingOrganisation, escapeLikePattern };
