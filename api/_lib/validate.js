/**
 * Shared input validation helpers for API handlers.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMN_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*(,[a-zA-Z_][a-zA-Z0-9_]*)*$/;

/** True if s is a valid UUID v4-compatible string. */
function isUUID(s) {
  return typeof s === 'string' && UUID_RE.test(s);
}

/** True if s is a valid SQL column name or comma-separated column list (for onConflict). */
function isValidColumnList(s) {
  return typeof s === 'string' && COLUMN_NAME_RE.test(s);
}

/** Allowed field names and operators for segment rule validation. */
const ALLOWED_RULE_FIELDS = new Set([
  'tier',
  'status',
  'sector',
  'region',
  'county_city',
  'engagement',
  'awards_count',
  'company_name',
  'email',
  'contact_name',
]);
const ALLOWED_RULE_OPS = new Set(['eq', 'neq', 'gt', 'lt', 'contains']);

/**
 * Validate and sanitise a segment rules array.
 * Strips rules with unknown fields or operators rather than throwing.
 * @param {Array} rules
 * @returns {{ valid: boolean, rules: Array, error?: string }}
 */
function validateSegmentRules(rules) {
  if (!Array.isArray(rules)) return { valid: false, error: 'rules must be an array' };
  const sanitised = [];
  for (const r of rules) {
    if (!r || typeof r !== 'object') continue;
    if (!ALLOWED_RULE_FIELDS.has(r.field)) {
      return { valid: false, error: `Unknown segment field: "${r.field}"` };
    }
    if (!ALLOWED_RULE_OPS.has(r.op)) {
      return { valid: false, error: `Unknown segment operator: "${r.op}"` };
    }
    if (typeof r.val !== 'string' && typeof r.val !== 'number') {
      return { valid: false, error: `Rule val must be a string or number` };
    }
    sanitised.push({ field: r.field, op: r.op, val: String(r.val).substring(0, 200) });
  }
  return { valid: true, rules: sanitised };
}

module.exports = { isUUID, isValidColumnList, validateSegmentRules };
