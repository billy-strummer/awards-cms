/**
 * @module data-proxy
 * Secure Data Proxy API.
 *
 * Server-side proxy for Supabase operations that should not be performed
 * directly from the browser. This endpoint:
 *
 * 1. Verifies the user's JWT before any operation
 * 2. Uses the SUPABASE_SERVICE_KEY (never exposed to client)
 * 3. Validates and sanitizes all inputs server-side
 * 4. Enforces business rules that can't be trusted client-side
 *
 * Environment Variables Required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_KEY  (service role, NOT the anon key)
 *   - SUPABASE_ANON_KEY     (for JWT verification only)
 *
 * Deploy as: Vercel serverless function at /api/data-proxy
 */

const { createClient } = require('@supabase/supabase-js');

// Service-role client for privileged operations
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Anon client for JWT verification
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY
);

// ============================================
// ALLOWED TABLES & OPERATIONS
// ============================================

/** Tables that can be queried via the proxy */
const ALLOWED_TABLES = new Set([
  'awards',
  'organisations',
  'entries',
  'winners',
  'events',
  'invoices',
  'payments',
  'award_assignments',
  'contacts',
  'activity_log',
  'email_templates',
  'user_preferences',
  'counties',
  'regions',
  'award_years',
  'judges',
  'votes',
  'email_lists',
  'email_list_members',
  'email_campaigns',
  'sponsorship_packages',
  'tickets',
  'ticket_types',
  'seating_tables',
  'seating_assignments',
  'documents',
  'media',
  'notifications',
  'webhooks',
  'tenant_branding',
  'organisation_notes',
  'organisation_documents',
  'organisation_custom_fields',
  'organisation_follow_ups',
  'organisation_relationships',
  'organisation_comms_log',
  'org_audit_log',
  'organisation_images',
  'organisation_contacts',
  'org_activity_notes',
  'event_galleries',
  'entry_revisions',
  'entry_files',
  'winner_announcements',
  'calendar_events',
  'report_schedules',
  'api_request_logs',
  'ip_blocklist',
  'rate_limit_alerts',
  'rate_limit_config',
  'social_media_posts',
  'notification_queue',
  'judge_scores',
  'email_log',
  'public_votes',
  'gdpr_requests',
  'media_gallery',
  'media_items',
  'cms_audit_logs',
  'table_assignments',
  'event_room_fixtures',
  'event_milestones',
  'event_attendees',
  'event_budgets',
  'event_budget_items',
  'meeting_notes',
  'organisation_segments',
  'contact_segments',
  'banners',
  'sponsors',
  'tenants',
  'cms_config',
  'shortlists',
  'notification_preferences',
  'communications',
  'deals',
  'user_roles',
  'organisations_with_crm_summary',
  'ai_vetting_results',
  'ai_vetting_runs',
  'event_templates',
  'social_media_templates',
  'email_lists_with_stats',
  'invoice_line_items',
  'winner_media',
  'webhook_logs',
  'event_ticket_types',
  'event_tickets',
  'event_guests',
  'event_waitlist',
  'event_tables',
  'event_vendors',
  'event_special_requirements',
  'event_post_data',
  'seating_sections',
  'running_order',
  'running_order_settings',
  'running_order_versions',
  'announcements',
  'activity_logs',
  'award_seasons',
  'calendar_feeds',
  'deliberation_notes',
  'document_versions',
  'email_import_batches',
  'email_list_subscribers',
  'record_notes',
  'scheduled_reports',
  'sponsor_contracts',
  'sponsor_impressions',
]);

/** Tables that can be mutated (insert/update/delete/upsert) */
const MUTABLE_TABLES = new Set([
  'awards',
  'organisations',
  'entries',
  'winners',
  'events',
  'invoices',
  'payments',
  'award_assignments',
  'contacts',
  'activity_log',
  'email_templates',
  'user_preferences',
  'judges',
  'votes',
  'email_lists',
  'email_list_members',
  'email_campaigns',
  'sponsorship_packages',
  'tickets',
  'ticket_types',
  'seating_tables',
  'seating_assignments',
  'documents',
  'media',
  'notifications',
  'webhooks',
  'tenant_branding',
  'organisation_notes',
  'organisation_documents',
  'organisation_custom_fields',
  'organisation_follow_ups',
  'organisation_relationships',
  'organisation_comms_log',
  'org_audit_log',
  'organisation_images',
  'organisation_contacts',
  'org_activity_notes',
  'event_galleries',
  'entry_revisions',
  'entry_files',
  'winner_announcements',
  'calendar_events',
  'report_schedules',
  'api_request_logs',
  'ip_blocklist',
  'rate_limit_alerts',
  'rate_limit_config',
  'social_media_posts',
  'notification_queue',
  'judge_scores',
  'email_log',
  'public_votes',
  'gdpr_requests',
  'media_gallery',
  'media_items',
  'cms_audit_logs',
  'table_assignments',
  'event_room_fixtures',
  'event_milestones',
  'event_attendees',
  'event_budgets',
  'event_budget_items',
  'meeting_notes',
  'organisation_segments',
  'contact_segments',
  'banners',
  'sponsors',
  'tenants',
  'cms_config',
  'shortlists',
  'notification_preferences',
  'communications',
  'deals',
  'event_templates',
  'social_media_templates',
  'ai_vetting_runs',
  'invoice_line_items',
  'winner_media',
  'webhook_logs',
  'event_ticket_types',
  'event_tickets',
  'event_guests',
  'event_waitlist',
  'event_tables',
  'event_vendors',
  'event_special_requirements',
  'event_post_data',
  'seating_sections',
  'running_order',
  'running_order_settings',
  'running_order_versions',
  'announcements',
  'activity_logs',
  'award_seasons',
  'calendar_feeds',
  'deliberation_notes',
  'document_versions',
  'email_import_batches',
  'email_list_subscribers',
  'record_notes',
  'scheduled_reports',
  'sponsor_contracts',
  'sponsor_impressions',
]);

/** Maximum page size to prevent abuse */
const MAX_PAGE_SIZE = 1000;

/** Maximum select depth to prevent recursive joins */
const MAX_SELECT_LENGTH = 500;

// ============================================
// RBAC — Role-Based Access Control
// ============================================

/**
 * Role hierarchy: super_admin > admin > editor > viewer
 * Each role defines which tables it can read and write.
 */
const ROLE_PERMISSIONS = {
  super_admin: { read: '*', write: '*' },
  admin: { read: '*', write: '*' },
  editor: {
    read: '*',
    write: new Set([
      'awards',
      'organisations',
      'entries',
      'winners',
      'events',
      'award_assignments',
      'contacts',
      'email_templates',
      'email_campaigns',
      'media',
      'organisation_notes',
      'organisation_documents',
      'organisation_contacts',
      'org_activity_notes',
      'event_galleries',
      'entry_revisions',
      'winner_announcements',
      'calendar_events',
      'user_preferences',
      'event_attendees',
      'event_budgets',
      'event_budget_items',
      'sponsors',
      'event_templates',
    ]),
  },
  viewer: {
    read: '*',
    write: new Set(['user_preferences']),
  },
  judge: {
    read: new Set([
      'awards',
      'award_years',
      'entries',
      'organisations',
      'user_preferences',
      'judge_scores',
      'organisation_contacts',
      'user_roles',
    ]),
    write: new Set(['user_preferences', 'judge_scores']),
  },
  marketing: {
    read: '*',
    write: new Set([
      'email_templates',
      'email_campaigns',
      'email_lists',
      'email_list_members',
      'media',
      'event_galleries',
      'organisation_notes',
      'user_preferences',
      'sponsors',
      'social_media_posts',
      'social_media_templates',
    ]),
  },
  finance: {
    read: '*',
    write: new Set([
      'invoices',
      'payments',
      'sponsorship_packages',
      'user_preferences',
      'event_budgets',
      'event_budget_items',
    ]),
  },
};

/** Read-only tables that no user role should mutate directly */
const READ_ONLY_TABLES = new Set(['activity_log', 'counties', 'regions']);

/**
 * Fetch user role from user_preferences or a roles table.
 * Falls back to 'viewer' if no role is found.
 * @param {string} userId - The user ID to look up.
 * @returns {Promise<string>} The user's role string (defaults to 'viewer').
 */
async function getUserRole(userId) {
  try {
    const { data } = await supabase
      .from('user_preferences')
      .select('value')
      .eq('user_id', userId)
      .eq('key', 'role')
      .maybeSingle();
    return data?.value || 'viewer';
  } catch {
    return 'viewer';
  }
}

/**
 * Check if a user's role permits an operation on a table.
 * @param {string} role - The user's role (e.g. 'admin', 'editor', 'viewer').
 * @param {string} table - The database table name.
 * @param {string} operation - The operation type ('select', 'insert', 'update', 'delete', 'count').
 * @returns {boolean} True if the role permits the operation on the table.
 */
function checkPermission(role, table, operation) {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;

  // Read-only tables block all writes regardless of role
  if (['insert', 'update', 'delete'].includes(operation) && READ_ONLY_TABLES.has(table)) {
    return role === 'super_admin'; // Only super_admin can override
  }

  if (['select', 'count'].includes(operation)) {
    if (perms.read === '*') return true;
    return perms.read.has(table);
  }

  // Write operations
  if (perms.write === '*') return true;
  return perms.write.has(table);
}

// ============================================
// AUTH VERIFICATION
// ============================================

/**
 * Verify the caller's Supabase JWT.
 * Returns the authenticated user or sends 401 and returns null.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<Object|null>} The authenticated user object, or null if authentication fails.
 */
async function verifyAuth(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    const {
      data: { user },
      error,
    } = await supabaseAuth.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return null;
    }
    return user;
  } catch (err) {
    res.status(401).json({ error: 'Token verification failed' });
    return null;
  }
}

// ============================================
// INPUT VALIDATION
// ============================================

/**
 * Validate and sanitize query parameters from the request body.
 * @param {Object} body - The request body containing query parameters.
 * @returns {string[]} Array of validation error messages (empty if valid).
 */
function validateQueryParams(body) {
  const errors = [];

  const { table, operation, select, filters, sort, page, pageSize, data, id, search } = body;

  if (!table || typeof table !== 'string') {
    errors.push('Missing or invalid "table" parameter');
  } else if (!ALLOWED_TABLES.has(table)) {
    errors.push(`Table "${table}" is not allowed`);
  }

  if (!operation || !['select', 'insert', 'update', 'delete', 'count', 'upsert'].includes(operation)) {
    errors.push('Operation must be one of: select, insert, update, delete, count, upsert');
  }

  if (['insert', 'update', 'delete', 'upsert'].includes(operation) && table && !MUTABLE_TABLES.has(table)) {
    errors.push(`Table "${table}" does not allow ${operation} operations`);
  }

  if (select && (typeof select !== 'string' || select.length > MAX_SELECT_LENGTH)) {
    errors.push(`"select" must be a string under ${MAX_SELECT_LENGTH} chars`);
  }

  if (filters && typeof filters !== 'object') {
    errors.push('"filters" must be an object');
  }

  if (sort) {
    if (typeof sort !== 'object' || !sort.column || typeof sort.column !== 'string') {
      errors.push('"sort" must have a valid "column" string');
    }
  }

  if (page !== undefined && (typeof page !== 'number' || page < 1)) {
    errors.push('"page" must be a positive integer');
  }

  if (pageSize !== undefined && (typeof pageSize !== 'number' || pageSize < 1 || pageSize > MAX_PAGE_SIZE)) {
    errors.push(`"pageSize" must be between 1 and ${MAX_PAGE_SIZE}`);
  }

  if (search !== undefined) {
    if (typeof search !== 'object' || !search.term || typeof search.term !== 'string') {
      errors.push('"search.term" must be a non-empty string');
    }
    if (!Array.isArray(search.columns) || search.columns.length === 0) {
      errors.push('"search.columns" must be a non-empty array of column names');
    }
  }

  if ((operation === 'insert' || operation === 'upsert') && (!data || typeof data !== 'object')) {
    errors.push('"data" is required for insert/upsert operations');
  }

  if (operation === 'update' && !id && (!filters || Object.keys(filters).length === 0)) {
    errors.push('Update requires "id" or "filters" to target specific rows');
  }

  if (operation === 'delete' && !id && (!filters || Object.keys(filters).length === 0)) {
    errors.push('Delete requires "id" or "filters" to target specific rows');
  }

  return errors;
}

// ============================================
// SHARED FILTER HELPER
// ============================================

/**
 * Apply filters to a Supabase query builder.
 * Supports equality checks and operator-based filters (neq, gt, gte, lt, lte,
 * like, ilike, in, is).
 * @param {Object} query - Supabase query builder instance.
 * @param {Object} filters - Filter object where keys are column names and values
 *   are either plain values (for equality) or objects with { op, value } for operators.
 * @returns {Object} The query builder with filters applied.
 */
function applyFilters(query, filters) {
  for (const [rawKey, value] of Object.entries(filters)) {
    if (value === null || value === undefined || value === '') continue;

    // Support "column@op" key syntax (e.g. "invoice_date@lt")
    let key = rawKey;
    let embeddedOp = null;
    const atIdx = rawKey.indexOf('@');
    if (atIdx > 0) {
      key = rawKey.substring(0, atIdx);
      embeddedOp = rawKey.substring(atIdx + 1);
    }

    // Determine the operator and operand
    let op = embeddedOp || null;
    let operand = value;

    if (typeof value === 'object' && !Array.isArray(value)) {
      if (value.op) {
        // Explicit { op, value } format
        op = op || value.op;
        operand = value.value;
      } else {
        // Shorthand { eq: val } / { gte: val } format (op is the key)
        const shorthandOps = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is'];
        const foundOp = shorthandOps.find((o) => o in value);
        if (foundOp) {
          op = op || foundOp;
          operand = value[foundOp];
        }
      }
    }

    // Apply the filter
    switch (op) {
      case 'neq':
        query = query.neq(key, operand);
        break;
      case 'gt':
        query = query.gt(key, operand);
        break;
      case 'gte':
        query = query.gte(key, operand);
        break;
      case 'lt':
        query = query.lt(key, operand);
        break;
      case 'lte':
        query = query.lte(key, operand);
        break;
      case 'like':
        query = query.like(key, operand);
        break;
      case 'ilike':
        query = query.ilike(key, operand);
        break;
      case 'in':
        query = query.in(key, operand);
        break;
      case 'is':
        query = query.is(key, operand);
        break;
      case 'eq':
      default:
        query = query.eq(key, operand);
    }
  }
  return query;
}

// ============================================
// QUERY EXECUTION
// ============================================

/**
 * Execute a validated Supabase query (select, insert, update, or delete).
 * @param {Object} body - The validated request body with table, operation, filters, etc.
 * @param {Object} user - The authenticated user object from JWT verification.
 * @returns {Promise<Object>} Query result with data, count, and pagination metadata.
 * @throws {Error} If the operation is unsupported or the Supabase query fails.
 */
async function executeQuery(body, user) {
  const { table, operation, select = '*', filters = {}, sort, page = 1, pageSize = 50, data, id, search } = body;

  // SELECT / COUNT
  if (operation === 'select' || operation === 'count') {
    const isCount = operation === 'count';
    let query = supabase.from(table).select(select, isCount ? { count: 'exact', head: true } : { count: 'exact' });

    // Apply filters (supports eq, neq, gt, gte, lt, lte, like, ilike, in, is)
    query = applyFilters(query, filters);

    // Apply full-text search (OR across multiple columns via ilike)
    if (search && search.term && search.columns && search.columns.length > 0) {
      const safeTerm = search.term.replace(/[%_\\]/g, (c) => '\\' + c);
      const orClause = search.columns.map((col) => `${col}.ilike.%${safeTerm}%`).join(',');
      query = query.or(orClause);
    }

    // Apply sorting
    if (sort && sort.column) {
      query = query.order(sort.column, { ascending: sort.ascending !== false });
    }

    // Apply pagination (only for select, not count)
    if (!isCount) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
    }

    const result = await query;
    if (result.error) throw result.error;

    if (isCount) {
      return { count: result.count };
    }

    return {
      data: result.data || [],
      count: result.count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((result.count || 0) / pageSize),
    };
  }

  // INSERT
  if (operation === 'insert') {
    // Inject audit fields
    const insertData = Array.isArray(data) ? data : [data];
    const enriched = insertData.map((row) => ({
      ...row,
      created_at: row.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { data: result, error } = await supabase.from(table).insert(enriched).select();

    if (error) throw error;

    // Log the activity
    await logActivity(table, 'insert', user, result, {});

    return { data: result };
  }

  // UPSERT
  if (operation === 'upsert') {
    const upsertData = Array.isArray(data) ? data : [data];
    const enriched = upsertData.map((row) => ({
      ...row,
      updated_at: new Date().toISOString(),
    }));
    const upsertOpts = {};
    if (body.onConflict) upsertOpts.onConflict = body.onConflict;
    const { data: result, error } = await supabase.from(table).upsert(enriched, upsertOpts).select();
    if (error) throw error;
    await logActivity(table, 'upsert', user, result, {});
    return { data: result };
  }

  // UPDATE
  if (operation === 'update') {
    const updateData = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    let query = supabase.from(table).update(updateData);

    if (id) {
      query = query.eq('id', id);
    } else {
      query = applyFilters(query, filters);
    }

    const { data: result, error } = await query.select();
    if (error) throw error;

    await logActivity(table, 'update', user, result, { id, filters });

    return { data: result };
  }

  // DELETE
  if (operation === 'delete') {
    let query = supabase.from(table).delete();

    if (id) {
      query = query.eq('id', id);
    } else {
      query = applyFilters(query, filters);
    }

    const { data: result, error } = await query.select();
    if (error) throw error;

    await logActivity(table, 'delete', user, result, { id, filters });

    return { data: result };
  }

  throw new Error(`Unsupported operation: ${operation}`);
}

/**
 * Log data mutation to activity_log table.
 * Captures which records were affected and the type of operation.
 * @param {string} table - The table that was modified.
 * @param {string} action - The action performed ('insert', 'update', 'delete').
 * @param {Object} user - The authenticated user who performed the action.
 * @param {Array|Object} result - The affected records returned by the query.
 * @param {Object} [context={}] - Additional context (id, filters) for the log entry.
 * @returns {Promise<void>}
 */
async function logActivity(table, action, user, result, context = {}) {
  try {
    const count = Array.isArray(result) ? result.length : 1;
    const recordIds = Array.isArray(result)
      ? result
          .slice(0, 10)
          .map((r) => r.id)
          .filter(Boolean)
      : [];

    const detailParts = [`${action} ${count} record(s) in ${table} via API proxy`];
    if (context.id) detailParts.push(`target_id=${context.id}`);
    if (recordIds.length > 0) detailParts.push(`affected=[${recordIds.join(',')}]`);
    if (context.filters && Object.keys(context.filters).length > 0) {
      detailParts.push(`filters=${JSON.stringify(context.filters)}`);
    }

    await supabase.from('activity_log').insert([
      {
        entity_type: table,
        action: `proxy_${action}`,
        details: detailParts.join(' | '),
        performed_by: user.email,
      },
    ]);
  } catch (e) {
    // Don't fail the main operation if logging fails
    console.error('Activity log error:', e.message);
  }
}

// ============================================
// RATE LIMITING (simple in-memory)
// ============================================

const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 120; // 120 requests per minute

let lastCleanup = Date.now();

/**
 * Check if a user has exceeded the rate limit (120 requests per minute).
 * Uses in-memory tracking with periodic cleanup of stale entries.
 * @param {string} userId - The user ID to check rate limits for.
 * @returns {boolean} True if the request is within rate limits, false if exceeded.
 */
function checkRateLimit(userId) {
  const now = Date.now();

  // Inline cleanup: sweep stale entries every 2 windows (works in serverless)
  if (now - lastCleanup > RATE_LIMIT_WINDOW * 2) {
    for (const [key, value] of rateLimits.entries()) {
      if (now - value.windowStart > RATE_LIMIT_WINDOW * 2) {
        rateLimits.delete(key);
      }
    }
    lastCleanup = now;
  }

  const userLimits = rateLimits.get(userId) || { count: 0, windowStart: now };

  if (now - userLimits.windowStart > RATE_LIMIT_WINDOW) {
    // Reset window
    userLimits.count = 1;
    userLimits.windowStart = now;
  } else {
    userLimits.count++;
  }

  rateLimits.set(userId, userLimits);
  return userLimits.count <= RATE_LIMIT_MAX;
}

// ============================================
// MAIN HANDLER
// ============================================

/**
 * Vercel serverless function handler.
 * POST /api/data-proxy
 *
 * Body: {
 *   table: string,
 *   operation: 'select' | 'insert' | 'update' | 'delete' | 'count',
 *   select?: string,
 *   filters?: object,
 *   sort?: { column: string, ascending: boolean },
 *   page?: number,
 *   pageSize?: number,
 *   data?: object | object[],
 *   id?: string
 * }
 */
module.exports = async function handler(req, res) {
  // CORS headers — restrict to known origins when configured
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const origin = req.headers.origin || '';
  const corsOrigin =
    allowedOrigins.length === 0 || allowedOrigins.includes(origin) ? origin || '*' : allowedOrigins[0] || '';
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // 1. Authenticate
    const user = await verifyAuth(req, res);
    if (!user) return; // 401 already sent

    // 2. Rate limit
    if (!checkRateLimit(user.id)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });
    }

    // 3. Validate input
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    const validationErrors = validateQueryParams(body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: validationErrors });
    }

    // 4. RBAC check
    const role = await getUserRole(user.id);
    if (!checkPermission(role, body.table, body.operation)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Role "${role}" cannot ${body.operation} on "${body.table}"`,
      });
    }

    // 5. Execute
    const result = await executeQuery(body, user);
    return res.status(200).json(result);
  } catch (error) {
    console.error('[data-proxy] Error:', error.message);
    return res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
