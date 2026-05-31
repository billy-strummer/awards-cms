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
const { verifyAuth, hasMinimumRole, getUserRole } = require('./_lib/auth');
const { assertEnv } = require('./_lib/env');
const { isValidColumnList, validateSegmentRules } = require('./_lib/validate');

assertEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']);

// Service-role client for privileged operations
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

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

// ROLE_HIERARCHY, hasMinimumRole, getUserRole, verifyAuth imported from ./_lib/auth

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
  'areas',
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
  'judge_conflicts',
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
  'settings',
  'sponsor_contracts',
  'sponsor_impressions',
  'media_videos',
  'certificate_templates',
  'nominee_upload_batches',
  'nominee_upload_rows',
  'custom_sectors',
  'custom_categories',
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
  'judge_conflicts',
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
  'ai_vetting_results',
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
  'certificate_templates',
  'nominee_upload_batches',
  'nominee_upload_rows',
  'custom_sectors',
  'custom_categories',
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
      'judge_conflicts',
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
  if (
    operation === 'rpc' ||
    operation === 'storage_upload' ||
    operation === 'storage_url' ||
    operation === 'storage_delete'
  ) {
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
    const invalidKeys = Object.keys(filters).filter((k) => !/^[a-zA-Z_][a-zA-Z0-9_.]*(@[a-zA-Z_]+)?$/.test(k));
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
        if (operand === null || operand === undefined) {
          query = query.not(key, 'is', null);
        } else {
          query = query.neq(key, operand);
        }
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
 * Check if an error indicates that the tenant_id column does not exist.
 * @param {Error|Object} error - The error from Supabase.
 * @returns {boolean} True if the error is about a missing tenant_id column.
 */
function isMissingTenantColumn(error) {
  if (!error) return false;
  const msg = (error.message || error.details || '').toLowerCase();
  return msg.includes('tenant_id') && (msg.includes('does not exist') || msg.includes('not exist'));
}

/**
 * Execute a validated Supabase query (select, insert, update, or delete).
 * @param {Object} body - The validated request body with table, operation, filters, etc.
 * @param {Object} user - The authenticated user object from JWT verification.
 * @returns {Promise<Object>} Query result with data, count, and pagination metadata.
 * @throws {Error} If the operation is unsupported or the Supabase query fails.
 */
async function executeQuery(body, user) {
  try {
    return await _executeQuery(body, user, true);
  } catch (err) {
    // If the error is about a missing tenant_id column, retry without tenant scoping.
    // Log a warning so this is visible — tables that need multi-tenant isolation should have tenant_id.
    if (isMissingTenantColumn(err)) {
      console.error(
        `[data-proxy] SECURITY: table "${body.table}" lacks tenant_id column but tenant scoping was requested — falling back to unscoped query`
      );
      return await _executeQuery(body, user, false);
    }
    throw err;
  }
}

async function _executeQuery(body, user, enableTenantScope) {
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
  const isTenantScoped = enableTenantScope && TENANT_SCOPED_TABLES.has(table) && tenantId && tenantId !== 'default';
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
      // Validate OR clause: only allow safe column.operator.value patterns
      const orStr = String(body.or);
      const safeOrPattern =
        /^[a-zA-Z_][a-zA-Z0-9_]*\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in)\.[^,]+(,[a-zA-Z_][a-zA-Z0-9_]*\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in)\.[^,]+)*$/;
      if (safeOrPattern.test(orStr)) {
        query = query.or(orStr);
      } else {
        throw new Error('Invalid or clause format');
      }
    }

    // Apply full-text search (OR across multiple columns via ilike)
    if (search && search.term && search.columns && search.columns.length > 0) {
      const safeColPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
      const safeCols = search.columns.filter((col) => safeColPattern.test(col));
      if (safeCols.length > 0) {
        const safeTerm = search.term.replace(/[%_\\]/g, (c) => '\\' + c);
        const orClause = safeCols.map((col) => `${col}.ilike.%${safeTerm}%`).join(',');
        query = query.or(orClause);
      }
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

    // Log the activity and dispatch webhooks
    await logActivity(table, 'insert', user, result, {});
    dispatchWebhooks(table, 'insert', user, result).catch(() => {});

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
    if (body.onConflict) {
      if (!isValidColumnList(body.onConflict)) {
        return { error: 'Invalid onConflict value — must be a column name or comma-separated column names' };
      }
      upsertOpts.onConflict = body.onConflict;
    }
    const { data: result, error } = await supabase.from(table).upsert(enriched, upsertOpts).select();
    if (error) throw error;
    await logActivity(table, 'upsert', user, result, {});
    dispatchWebhooks(table, 'update', user, result).catch(() => {});
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
    dispatchWebhooks(table, 'update', user, result).catch(() => {});

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
    dispatchWebhooks(table, 'delete', user, result).catch(() => {});

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

    await supabase.from('activity_logs').insert([
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
// OUTBOUND WEBHOOK DISPATCH
// ============================================

/**
 * Fire outbound webhooks for data mutations (insert/update/delete).
 * Runs asynchronously — never blocks the main response.
 * @param {string} table - The table that was modified.
 * @param {string} action - insert, update, or delete.
 * @param {Object} user - The authenticated user.
 * @param {Array|Object} result - The affected records.
 */
async function dispatchWebhooks(table, action, user, result) {
  try {
    const eventType = `${table}.${action === 'insert' ? 'created' : action === 'delete' ? 'deleted' : 'updated'}`;

    // Fetch active webhooks that match this event
    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('id, name, url, secret, events')
      .eq('active', true);

    if (error || !webhooks || webhooks.length === 0) return;

    const matching = webhooks.filter((wh) => wh.events && (wh.events.includes('*') || wh.events.includes(eventType)));
    if (matching.length === 0) return;

    const payload = JSON.stringify({
      event: eventType,
      timestamp: new Date().toISOString(),
      table,
      action,
      performed_by: user.email,
      data: Array.isArray(result) ? result.slice(0, 10) : result,
    });

    // Fire all matching webhooks concurrently
    await Promise.allSettled(
      matching.map(async (wh) => {
        let statusCode = 0;
        let responseBody = '';
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);

          const headers = {
            'Content-Type': 'application/json',
            'X-Webhook-Event': eventType,
            'User-Agent': 'AwardsCMS-Webhook/1.0',
          };
          if (wh.secret) {
            // Simple HMAC-like signature using the secret
            const crypto = require('crypto');
            const signature = crypto.createHmac('sha256', wh.secret).update(payload).digest('hex');
            headers['X-Webhook-Signature'] = `sha256=${signature}`;
          }

          const resp = await fetch(wh.url, {
            method: 'POST',
            headers,
            body: payload,
            signal: controller.signal,
          });
          clearTimeout(timeout);

          statusCode = resp.status;
          responseBody = await resp.text().catch(() => '');
          if (responseBody.length > 500) responseBody = responseBody.substring(0, 500);

          // Update last triggered timestamp
          await supabase.from('webhooks').update({ last_triggered_at: new Date().toISOString() }).eq('id', wh.id);
        } catch (err) {
          responseBody = err.message || 'Connection error';
        }

        // Log delivery
        await supabase
          .from('webhook_logs')
          .insert([
            {
              webhook_id: wh.id,
              webhook_name: wh.name,
              event_type: eventType,
              status_code: statusCode,
              response_body: responseBody,
            },
          ])
          // @ts-ignore — .catch() is valid on the promise-like query builder
          .catch(() => {});
      })
    );
  } catch (err) {
    console.error('Webhook dispatch error:', err.message);
  }
}

// ============================================
// RATE LIMITING (simple in-memory)
// ============================================

const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 120; // 120 requests per minute

/**
 * Check if a user has exceeded the rate limit (120 requests per minute).
 * Uses in-memory tracking with probabilistic cleanup of stale entries.
 * Note: rate limits are per-Vercel-instance (not distributed).
 * @param {string} userId - The user ID to check rate limits for.
 * @returns {boolean} True if the request is within rate limits, false if exceeded.
 */
function checkRateLimit(userId) {
  const now = Date.now();

  // Probabilistic cleanup: sweep stale entries on ~1% of requests to avoid
  // accumulating unbounded Map entries without a shared-global race condition.
  if (Math.random() < 0.01) {
    for (const [key, value] of rateLimits.entries()) {
      if (now - value.windowStart > RATE_LIMIT_WINDOW * 2) {
        rateLimits.delete(key);
      }
    }
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
/**
 * Nominee batch upload — inserts a batch record then all rows atomically.
 * Returns { batchId, csvRowCount, storedRowCount } for client-side verification.
 */
async function executeNomineeUpload(body, user) {
  const { batch, rows } = body;

  if (!batch || typeof batch !== 'object') throw new Error('nominee_upload: missing batch metadata');
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('nominee_upload: rows must be a non-empty array');

  const csvRowCount = rows.length;

  // 1. Insert the batch record
  const batchRecord = {
    filename: String(batch.filename || 'upload.csv').slice(0, 255),
    area: String(batch.area || '').slice(0, 100),
    country: batch.country ? String(batch.country).slice(0, 50) : null,
    category: batch.category ? String(batch.category).slice(0, 200) : null,
    csv_row_count: csvRowCount,
    stored_row_count: 0,
    uploaded_by: user.email || null,
    notes: batch.notes ? String(batch.notes).slice(0, 500) : null,
  };

  const { data: batchData, error: batchError } = await supabase
    .from('nominee_upload_batches')
    .insert(batchRecord)
    .select('id')
    .single();

  if (batchError) throw new Error(`Failed to create upload batch: ${batchError.message}`);
  const batchId = batchData.id;

  // 2. Insert rows in chunks of 100
  const CHUNK_SIZE = 100;
  let storedRowCount = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE).map((r, idx) => ({
      batch_id: batchId,
      area: String(r.area || batch.area || '').slice(0, 100),
      row_number: i + idx + 1,
      company_name: r.company_name ? String(r.company_name).slice(0, 255) : null,
      raw_data: r.raw_data && typeof r.raw_data === 'object' ? r.raw_data : {},
    }));

    const { error: rowsError } = await supabase
      .from('nominee_upload_rows')
      .insert(chunk)
      // @ts-ignore — .select() with count options is valid at runtime
      .select('id', { count: 'exact', head: true });

    if (rowsError)
      throw new Error(`Failed to insert rows (chunk ${Math.floor(i / CHUNK_SIZE) + 1}): ${rowsError.message}`);
    storedRowCount += chunk.length;
  }

  // 3. Update stored_row_count on the batch
  await supabase.from('nominee_upload_batches').update({ stored_row_count: storedRowCount }).eq('id', batchId);

  return { batchId, csvRowCount, storedRowCount, verified: storedRowCount === csvRowCount };
}

/**
 * Execute a smart segment query against the organisations table.
 * Queries ALL organisations in the database (not just the current page).
 * For field types: tier, status, sector, region (county_city) → direct DB filters.
 * For awards_count → embedded count from award_assignments join.
 * For engagement → simplified score computed from org fields (updated_at, email, etc.).
 * @param {Array<{field: string, op: string, val: string}>} rules - Segment rules.
 * @param {'AND'|'OR'} logic - Match logic.
 * @returns {Promise<{count: number, organisations: Array}>}
 */
async function executeSegmentQuery(rules, logic) {
  const DB_COL = {
    tier: 'tier',
    status: 'status',
    sector: 'sector',
    region: 'county_city',
    county_city: 'county_city',
  };

  // Computed fields require in-memory evaluation; simple fields can be pushed to DB WHERE clause.
  const IN_MEMORY_FIELDS = new Set(['engagement', 'awards_count']);

  // For AND logic, push simple field filters to Supabase to reduce rows fetched.
  // For OR logic, we need all rows (any one rule matching is enough, including computed fields).
  const dbRules = logic === 'AND' ? rules.filter((r) => !IN_MEMORY_FIELDS.has(r.field)) : [];
  const memRules = logic === 'AND' ? rules.filter((r) => IN_MEMORY_FIELDS.has(r.field)) : rules;

  // Build base query, applying DB-level filters for AND conditions
  function buildBaseQuery() {
    let q = supabase
      .from('organisations')
      .select(
        'id, company_name, status, sector, county_city, tier, email, contact_name, contact_phone, logo_url, website, updated_at, award_assignments(count)'
      );
    for (const r of dbRules) {
      const col = DB_COL[r.field] || r.field;
      switch (r.op) {
        case 'eq':
          q = q.eq(col, r.val);
          break;
        case 'neq':
          q = q.neq(col, r.val);
          break;
        case 'contains':
          q = q.ilike(col, `%${r.val}%`);
          break;
        case 'gt':
          q = q.gt(col, r.val);
          break;
        case 'lt':
          q = q.lt(col, r.val);
          break;
        default:
          break;
      }
    }
    return q;
  }

  // Paginate, respecting the DB-filtered query when possible.
  // Safety cap of 5,000 rows (halved from 10K since DB filtering reduces result set).
  const PAGE_SIZE = 500;
  const MAX_ROWS = dbRules.length > 0 ? 5000 : 10000;
  const allOrgs = [];
  let page = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const from = page * PAGE_SIZE;
    // eslint-disable-next-line no-await-in-loop
    const { data: batch, error } = await buildBaseQuery().range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!batch || batch.length === 0) break;

    allOrgs.push(...batch);
    page++;

    if (allOrgs.length >= MAX_ROWS) {
      console.warn(
        `[executeSegmentQuery] Safety cap reached: ${MAX_ROWS} rows loaded. Some organisations may be excluded from this segment.`
      );
      break;
    }

    if (batch.length < PAGE_SIZE) break; // Last page
  }

  const processed = allOrgs.map((org) => ({
    ...org,
    awards_count: org.award_assignments?.[0]?.count || 0,
    county_city: org.county_city || '',
  }));

  // Apply remaining in-memory rules (engagement score, awards_count, OR-logic rules)
  const matchFn = logic === 'OR' ? 'some' : 'every';
  const matching =
    memRules.length === 0
      ? processed
      : processed.filter((org) =>
          memRules[matchFn]((r) => {
            let orgVal;
            if (r.field === 'engagement') {
              // Simplified engagement: derived from available DB columns (no CRM last-contacted)
              let score = 0;
              const daysSinceUpdate = org.updated_at
                ? Math.floor((Date.now() - new Date(org.updated_at).getTime()) / 86400000)
                : 999;
              if (daysSinceUpdate < 7) score += 40;
              else if (daysSinceUpdate < 30) score += 25;
              else if (daysSinceUpdate < 90) score += 10;
              else if (daysSinceUpdate < 180) score += 3;
              if (org.email) score += 8;
              if (org.contact_name) score += 7;
              if (org.logo_url) score += 5;
              if (org.website) score += 5;
              if ((org.awards_count || 0) > 0) score += 15;
              if (org.tier) score += 5;
              if (org.contact_phone) score += 3;
              orgVal = score;
            } else if (r.field === 'awards_count') {
              orgVal = org.awards_count || 0;
            } else {
              const col = DB_COL[r.field] || r.field;
              orgVal = org[col] || '';
            }
            const testVal = r.val;
            switch (r.op) {
              case 'eq':
                return String(orgVal).toLowerCase() === testVal.toLowerCase();
              case 'neq':
                return String(orgVal).toLowerCase() !== testVal.toLowerCase();
              case 'gt':
                return Number(orgVal) > Number(testVal);
              case 'lt':
                return Number(orgVal) < Number(testVal);
              case 'contains':
                return String(orgVal).toLowerCase().includes(testVal.toLowerCase());
              default:
                return false;
            }
          })
        );

  return {
    count: matching.length,
    organisations: matching.slice(0, 200).map((o) => ({
      id: o.id,
      company_name: o.company_name,
      status: o.status,
      sector: o.sector,
      county_city: o.county_city,
      tier: o.tier,
      awards_count: o.awards_count,
    })),
  };
}

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
      const requiredRole = ALLOWED_STORAGE_BUCKETS[body.bucket];
      if (!requiredRole) {
        return res.status(400).json({ error: `Storage bucket "${body.bucket}" is not allowed` });
      }
      if (!hasMinimumRole(role, requiredRole)) {
        return res
          .status(403)
          .json({ error: 'Forbidden', message: `Role "${role}" cannot access bucket "${body.bucket}"` });
      }
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

    // 7. Handle nominee batch upload
    if (body.operation === 'nominee_upload') {
      if (!hasMinimumRole(role, 'editor')) {
        return res.status(403).json({ error: 'Forbidden', message: 'Nominee upload requires editor role or above' });
      }
      const uploadResult = await executeNomineeUpload(body, user);
      return res.status(200).json(uploadResult);
    }

    if (body.operation === 'nominee_delete_all') {
      if (!hasMinimumRole(role, 'super_admin')) {
        return res.status(403).json({ error: 'Forbidden', message: 'Nominee delete requires super_admin role' });
      }
      const batchId = body.batch_id;
      if (!batchId) {
        return res
          .status(400)
          .json({ error: 'batch_id is required for nominee_delete_all to prevent accidental mass deletion' });
      }
      await supabase.from('nominee_upload_rows').delete().eq('batch_id', batchId);
      await supabase.from('nominee_upload_batches').delete().eq('id', batchId);
      return res.status(200).json({ deleted: true });
    }

    // 8. Handle smart segment server-side query
    if (body.operation === 'apply_segment') {
      if (!hasMinimumRole(role, 'viewer')) {
        return res.status(403).json({ error: 'Forbidden', message: 'Segment queries require viewer role or above' });
      }
      const logic = body.logic === 'OR' ? 'OR' : 'AND';
      const rulesValidation = validateSegmentRules(body.rules || []);
      if (!rulesValidation.valid) {
        return res.status(400).json({ error: rulesValidation.error });
      }
      const segResult = await executeSegmentQuery(rulesValidation.rules, logic);
      return res.status(200).json(segResult);
    }

    // 9. Validate standard query params
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
    console.error('[data-proxy] Error:', error.message, error.details || '', error.hint || '');
    return res.status(500).json({ error: 'Internal server error' });
  }
};
