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
// TENANT-SCOPED TABLES
// ============================================

/** Tables that require tenant_id isolation when a tenant context is provided */
const TENANT_SCOPED_TABLES = new Set([
  'award_years',
  'organisations',
  'events',
  'winners',
  'entries',
  'invoices',
  'payments',
  'award_assignments',
  'contacts',
  'sponsors',
  'sponsorship_packages',
  'email_campaigns',
  'email_lists',
  'email_list_members',
  'email_list_subscribers',
  'media_gallery',
  'media_items',
  'event_galleries',
  'social_media_posts',
  'banners',
]);

// ============================================
// ALLOWED RPC FUNCTIONS
// ============================================

/** RPC functions that can be called via the proxy, mapped to required minimum role */
const ALLOWED_RPCS = {
  anonymize_organisation: 'super_admin',
  send_test_email: 'admin',
  check_email_config: 'admin',
  send_campaign_emails: 'admin',
  generate_invoice_number: 'editor',
  generate_payment_reference: 'editor',
  get_next_table_number: 'editor',
};

/** Role hierarchy for RPC permission checks (higher index = more privilege) */
const ROLE_HIERARCHY = ['viewer', 'judge', 'marketing', 'finance', 'editor', 'admin', 'super_admin'];

/**
 * Check if a role meets the minimum required role level.
 * @param {string} userRole - The user's current role.
 * @param {string} requiredRole - The minimum role required.
 * @returns {boolean}
 */
function hasMinimumRole(userRole, requiredRole) {
  const userLevel = ROLE_HIERARCHY.indexOf(userRole);
  const requiredLevel = ROLE_HIERARCHY.indexOf(requiredRole);
  if (userLevel === -1 || requiredLevel === -1) return false;
  return userLevel >= requiredLevel;
}

// ============================================
// ALLOWED STORAGE BUCKETS
// ============================================

/** Storage buckets that authenticated users can upload to, mapped to required minimum role */
const ALLOWED_STORAGE_BUCKETS = {
  media: 'editor',
  'media-gallery': 'editor',
  'brand-assets': 'admin',
  'sponsor-assets': 'editor',
  'organisation-logos': 'editor',
  'winner-media': 'editor',
  'entry-files': 'editor',
};

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
  'email_campaign_recipients',
  'record_notes',
  'scheduled_reports',
  'sponsor_contracts',
  'sponsor_impressions',
  'media_videos',
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
  'email_campaign_recipients',
  'record_notes',
  'scheduled_reports',
  'sponsor_contracts',
  'sponsor_impressions',
  'media_videos',
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
      'email_lists',
      'email_list_members',
      'email_list_subscribers',
      'email_import_batches',
      'media',
      'media_items',
      'media_gallery',
      'media_videos',
      'organisation_notes',
      'organisation_documents',
      'organisation_custom_fields',
      'organisation_follow_ups',
      'organisation_relationships',
      'organisation_comms_log',
      'organisation_contacts',
      'organisation_images',
      'organisation_segments',
      'org_activity_notes',
      'org_audit_log',
      'event_galleries',
      'event_attendees',
      'event_budgets',
      'event_budget_items',
      'event_tables',
      'event_tickets',
      'event_ticket_types',
      'event_guests',
      'event_waitlist',
      'event_vendors',
      'event_milestones',
      'event_room_fixtures',
      'event_post_data',
      'event_special_requirements',
      'event_templates',
      'entry_revisions',
      'entry_files',
      'winner_announcements',
      'winner_media',
      'calendar_events',
      'user_preferences',
      'sponsors',
      'sponsor_contracts',
      'communications',
      'deals',
      'meeting_notes',
      'contact_segments',
      'banners',
      'running_order',
      'running_order_settings',
      'running_order_versions',
      'table_assignments',
      'seating_sections',
      'seating_tables',
      'seating_assignments',
      'invoices',
      'invoice_line_items',
      'payments',
      'documents',
      'document_versions',
      'shortlists',
      'announcements',
      'deliberation_notes',
      'record_notes',
      'notifications',
      'notification_preferences',
      'social_media_posts',
      'social_media_templates',
      'scheduled_reports',
      'ai_vetting_results',
      'ai_vetting_runs',
      'activity_logs',
      'cms_audit_logs',
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
      'email_list_subscribers',
      'email_import_batches',
      'media',
      'media_items',
      'media_gallery',
      'media_videos',
      'event_galleries',
      'organisation_notes',
      'user_preferences',
      'sponsors',
      'sponsor_contracts',
      'sponsor_impressions',
      'social_media_posts',
      'social_media_templates',
      'banners',
      'winner_announcements',
      'winner_media',
      'announcements',
    ]),
  },
  finance: {
    read: '*',
    write: new Set([
      'invoices',
      'invoice_line_items',
      'payments',
      'sponsorship_packages',
      'user_preferences',
      'event_budgets',
      'event_budget_items',
      'communications',
    ]),
  },
};

/** Read-only tables that no user role should mutate directly */
const READ_ONLY_TABLES = new Set(['activity_log', 'counties', 'regions']);

/**
 * Fetch user role from user_roles table (canonical source of truth).
 * Falls back to 'viewer' if no role is found.
 * @param {string} userEmail - The user's email address.
 * @returns {Promise<string>} The user's role string (defaults to 'viewer').
 */
async function getUserRole(userEmail) {
  try {
    const { data } = await supabase.from('user_roles').select('role').eq('email', userEmail).limit(1).maybeSingle();
    return (data?.role || 'viewer').toLowerCase();
  } catch (err) {
    console.error(`[data-proxy] Failed to fetch role for user ${userEmail}:`, err.message);
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
  const authHeader = req.headers?.authorization;
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

  const { table, operation, select, filters, sort, page, pageSize, data, id, search, tenantId } = body;

  // RPC and storage operations have their own validation
  if (operation === 'rpc' || operation === 'storage_upload' || operation === 'storage_url') {
    return errors;
  }

  if (!table || typeof table !== 'string') {
    errors.push('Missing or invalid "table" parameter');
  } else if (!ALLOWED_TABLES.has(table)) {
    errors.push(`Table "${table}" is not allowed`);
  }

  if (!operation || !['select', 'insert', 'update', 'delete', 'count', 'upsert'].includes(operation)) {
    errors.push('Operation must be one of: select, insert, update, delete, count, upsert');
  }

  // Validate tenantId format if provided
  if (tenantId && typeof tenantId === 'string' && tenantId !== 'default') {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      errors.push('"tenantId" must be a valid UUID or "default"');
    }
  }

  if (['insert', 'update', 'delete', 'upsert'].includes(operation) && table && !MUTABLE_TABLES.has(table)) {
    errors.push(`Table "${table}" does not allow ${operation} operations`);
  }

  if (select && (typeof select !== 'string' || select.length > MAX_SELECT_LENGTH)) {
    errors.push(`"select" must be a string under ${MAX_SELECT_LENGTH} chars`);
  }

  if (filters && typeof filters !== 'object') {
    errors.push('"filters" must be an object');
  } else if (filters) {
    const invalidKeys = Object.keys(filters).filter((k) => !/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(k));
    if (invalidKeys.length > 0) {
      errors.push(`Invalid filter column names: ${invalidKeys.join(', ')}`);
    }
  }

  if (sort) {
    if (typeof sort !== 'object' || !sort.column || typeof sort.column !== 'string') {
      errors.push('"sort" must have a valid "column" string');
    } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(sort.column)) {
      errors.push('"sort.column" must be a valid column name (alphanumeric and underscores only)');
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
    } else if (search.columns.some((col) => typeof col !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col))) {
      errors.push('"search.columns" must contain valid column names (alphanumeric and underscores only)');
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
  const {
    table,
    operation,
    select = '*',
    filters = {},
    sort,
    page = 1,
    pageSize = 50,
    data,
    id,
    search,
    tenantId,
  } = body;

  // Server-side tenant isolation: auto-scope queries to the current tenant
  const isTenantScoped = TENANT_SCOPED_TABLES.has(table) && tenantId && tenantId !== 'default';
  if (isTenantScoped) {
    // For reads, inject tenant_id filter
    if (['select', 'count'].includes(operation)) {
      filters.tenant_id = tenantId;
    }
  }

  // SELECT / COUNT
  if (operation === 'select' || operation === 'count') {
    const isCount = operation === 'count';
    let query = supabase.from(table).select(select, isCount ? { count: 'exact', head: true } : { count: 'exact' });

    // Apply filters (supports eq, neq, gt, gte, lt, lte, like, ilike, in, is)
    query = applyFilters(query, filters);

    // Apply raw OR filter (e.g. "organisation_id.is.null,award_id.is.null")
    if (body.or) {
      query = query.or(body.or);
    }

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
    // Inject audit fields and tenant_id
    const insertData = Array.isArray(data) ? data : [data];
    const enriched = insertData.map((row) => ({
      ...row,
      ...(isTenantScoped ? { tenant_id: tenantId } : {}),
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
      ...(isTenantScoped ? { tenant_id: tenantId } : {}),
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

    // Enforce tenant isolation on updates
    if (isTenantScoped) {
      query = query.eq('tenant_id', tenantId);
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

    // Enforce tenant isolation on deletes
    if (isTenantScoped) {
      query = query.eq('tenant_id', tenantId);
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
      const filtersStr = JSON.stringify(context.filters);
      detailParts.push(`filters=${filtersStr.length > 500 ? filtersStr.substring(0, 500) + '...' : filtersStr}`);
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
// RPC EXECUTION
// ============================================

/**
 * Execute a validated RPC call via Supabase.
 * @param {Object} body - The request body with rpcName and rpcParams.
 * @param {Object} user - The authenticated user object.
 * @returns {Promise<Object>} RPC result with data.
 */
async function executeRpc(body, user) {
  const { rpcName, rpcParams = {} } = body;

  if (!rpcName || typeof rpcName !== 'string') {
    throw new Error('Missing or invalid "rpcName" parameter');
  }

  if (!ALLOWED_RPCS[rpcName]) {
    throw new Error(`RPC function "${rpcName}" is not allowed`);
  }

  const { data, error } = await supabase.rpc(rpcName, rpcParams);
  if (error) throw error;

  // Log RPC calls
  await logActivity('_rpc', rpcName, user, data ? [data] : [], { rpcParams });

  return { data };
}

// ============================================
// STORAGE PROXY
// ============================================

/**
 * Handle authenticated storage upload.
 * @param {Object} body - The request body with bucket and path.
 * @returns {Promise<Object>} Upload result with publicUrl.
 */
async function executeStorageUpload(body) {
  const { bucket, path: storagePath, fileBase64, contentType } = body;

  if (!bucket || !storagePath || !fileBase64) {
    throw new Error('Missing required storage upload parameters: bucket, path, fileBase64');
  }

  if (!ALLOWED_STORAGE_BUCKETS[bucket]) {
    throw new Error(`Storage bucket "${bucket}" is not allowed`);
  }

  const fileBuffer = Buffer.from(fileBase64, 'base64');
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, fileBuffer, { contentType: contentType || 'application/octet-stream', upsert: true });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  return { publicUrl: urlData.publicUrl, path: storagePath };
}

/**
 * Delete files from Supabase Storage.
 * @param {Object} body - The request body with bucket and paths array.
 * @returns {Promise<Object>} Delete result with count.
 */
async function executeStorageDelete(body) {
  const { bucket, paths } = body;

  if (!bucket || !Array.isArray(paths) || paths.length === 0) {
    throw new Error('Missing required parameters: bucket, paths (array)');
  }

  if (!ALLOWED_STORAGE_BUCKETS[bucket]) {
    throw new Error(`Storage bucket "${bucket}" is not allowed`);
  }

  if (paths.length > 100) {
    throw new Error('Cannot delete more than 100 files at once');
  }

  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw error;

  return { deleted: paths.length };
}

/**
 * Get a public URL for a storage object.
 * @param {Object} body - The request body with bucket and path.
 * @returns {Object} The public URL.
 */
function executeStorageUrl(body) {
  const { bucket, path: storagePath } = body;

  if (!bucket || !storagePath) {
    throw new Error('Missing required parameters: bucket, path');
  }

  if (!ALLOWED_STORAGE_BUCKETS[bucket]) {
    throw new Error(`Storage bucket "${bucket}" is not allowed`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return { publicUrl: data.publicUrl };
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

    // 4. RBAC check (use email for role lookup - matches client-side user_roles table)
    const role = await getUserRole(user.email);

    // 5. Handle RPC operations
    if (body.operation === 'rpc') {
      const requiredRole = ALLOWED_RPCS[body.rpcName];
      if (!requiredRole) {
        return res.status(400).json({ error: `RPC function "${body.rpcName}" is not allowed` });
      }
      if (!hasMinimumRole(role, requiredRole)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Role "${role}" cannot call RPC "${body.rpcName}" (requires ${requiredRole})`,
        });
      }
      const rpcResult = await executeRpc(body, user);
      return res.status(200).json(rpcResult);
    }

    // 6. Handle storage operations
    if (body.operation === 'storage_upload') {
      const requiredRole = ALLOWED_STORAGE_BUCKETS[body.bucket];
      if (!requiredRole) {
        return res.status(400).json({ error: `Storage bucket "${body.bucket}" is not allowed` });
      }
      if (!hasMinimumRole(role, requiredRole)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Role "${role}" cannot upload to bucket "${body.bucket}"`,
        });
      }
      const uploadResult = await executeStorageUpload(body);
      return res.status(200).json(uploadResult);
    }

    if (body.operation === 'storage_url') {
      const urlResult = executeStorageUrl(body);
      return res.status(200).json(urlResult);
    }

    if (body.operation === 'storage_delete') {
      const requiredRole = ALLOWED_STORAGE_BUCKETS[body.bucket];
      if (!requiredRole) {
        return res.status(400).json({ error: `Storage bucket "${body.bucket}" is not allowed` });
      }
      if (!hasMinimumRole(role, requiredRole)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Role "${role}" cannot delete from bucket "${body.bucket}"`,
        });
      }
      const deleteResult = await executeStorageDelete(body);
      return res.status(200).json(deleteResult);
    }

    // 7. Validate standard query params
    const validationErrors = validateQueryParams(body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: validationErrors });
    }

    if (!checkPermission(role, body.table, body.operation)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Role "${role}" cannot ${body.operation} on "${body.table}"`,
      });
    }

    // 8. Execute standard query
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
