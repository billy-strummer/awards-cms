/**
 * BTA-080: static checks on migrations/093-harden-remaining-permissive-policy-tables.sql.
 *
 * These tests parse the migration's SQL source text and assert structural
 * properties (which statements are present, in what order, for which
 * tables). They cannot execute the SQL or prove what Postgres would
 * actually do with it -- no live database is available to this task.
 * They catch the two concrete regressions this migration exists to avoid:
 * (1) a table ending up with no DROP for its original permissive policy
 * (the exact bug already found in migration 052), and (2) event_guests
 * being touched here at all (it is deliberately handled by migrations
 * 078/079 instead). A policy *being present* in the file is not the same
 * as it *effectively restricting access* once applied -- that can only be
 * confirmed by the live-database queries documented in the BTA-080 report.
 */

const fs = require('fs');
const path = require('path');

const MIGRATION_PATH = path.join(__dirname, '..', 'migrations', '093-harden-remaining-permissive-policy-tables.sql');
const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');

const TARGET_TABLES = [
  'organisations',
  'organisation_contacts',
  'entries',
  'award_assignments',
  'invoices',
  'payments',
  'award_years',
  'gdpr_requests',
];

describe('Migration 093 - structural correctness (static source checks only)', () => {
  test('targets exactly the 8 intended tables, and no others, in its own array/direct statements', () => {
    const arrayMatch = sql.match(/tbls TEXT\[\] := ARRAY\[([\s\S]*?)\];/);
    expect(arrayMatch).not.toBeNull();
    const arrayTables = arrayMatch[1].match(/'([a-z_]+)'/g).map((s) => s.replace(/'/g, ''));
    expect(arrayTables.sort()).toEqual(
      [
        'organisations',
        'organisation_contacts',
        'entries',
        'award_assignments',
        'invoices',
        'payments',
        'award_years',
      ].sort()
    );
    // gdpr_requests is handled separately (3 extra legacy policies), not via the array.
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Allow all access to gdpr_requests" ON gdpr_requests/);
  });

  test.each(TARGET_TABLES)('drops the original "Allow all access to %s" permissive policy by exact name', (table) => {
    if (table === 'gdpr_requests') {
      // gdpr_requests is handled by literal statements, not the format() template.
      expect(sql).toMatch(new RegExp(`Allow all access to ${table}\\b`));
    } else {
      // The other 7 tables share one format()'d DROP statement -- the
      // actual table name is substituted by Postgres at runtime, not
      // present as a literal string in the source. Confirm the shared
      // template itself targets "Allow all access to <table>" generically.
      expect(sql).toMatch(/DROP POLICY IF EXISTS "Allow all access to %s" ON %I/);
    }
  });

  for (const table of TARGET_TABLES) {
    test(`drops the original permissive policy for ${table} before any CREATE POLICY runs for it`, () => {
      // For the 7 array-driven tables this is a single shared DO block,
      // so "before" is checked structurally: the DROP statement for the
      // original policy name must appear, and the array-driven loop's
      // own DROP-then-CREATE statements are in that fixed order in the
      // source text (format() DROP lines precede format() CREATE lines
      // inside the same FOREACH body). gdpr_requests's DROPs are literal
      // statements preceding its own dedicated DO block.
      if (table === 'gdpr_requests') {
        const dropIndex = sql.indexOf('DROP POLICY IF EXISTS "Allow all access to gdpr_requests"');
        const createIndex = sql.indexOf('CREATE POLICY "service_role_all" ON gdpr_requests');
        expect(dropIndex).toBeGreaterThan(-1);
        expect(createIndex).toBeGreaterThan(-1);
        expect(dropIndex).toBeLessThan(createIndex);
      } else {
        // All 7 array tables share one DO block; confirm the DROP-format
        // line for the original policy precedes the CREATE-format line
        // for service_role_all within that same block.
        const blockDropIndex = sql.indexOf('DROP POLICY IF EXISTS "Allow all access to %s" ON %I');
        const blockCreateIndex = sql.indexOf('CREATE POLICY "service_role_all" ON %I FOR ALL');
        expect(blockDropIndex).toBeGreaterThan(-1);
        expect(blockCreateIndex).toBeGreaterThan(-1);
        expect(blockDropIndex).toBeLessThan(blockCreateIndex);
      }
    });
  }

  test.each(TARGET_TABLES)('creates both service_role_all and no_direct_client_access for %s', (table) => {
    if (table === 'gdpr_requests') {
      expect(sql).toMatch(/CREATE POLICY "service_role_all" ON gdpr_requests/);
      expect(sql).toMatch(/CREATE POLICY "no_direct_client_access" ON gdpr_requests/);
    } else {
      // Array-driven tables share one format()'d CREATE statement per
      // policy. The role literal is embedded inside a SQL string that is
      // itself inside a single-quoted format() argument, so the single
      // quote around 'service_role' is doubled ('' .. '') per standard
      // SQL string-escaping -- this is the literal text in the file.
      expect(sql).toMatch(/CREATE POLICY "service_role_all" ON %I FOR ALL USING \(auth\.role\(\) = ''service_role''\)/);
      expect(sql).toMatch(/CREATE POLICY "no_direct_client_access" ON %I FOR ALL USING \(false\)/);
    }
  });

  test.each(TARGET_TABLES)('revokes ALL table privileges from both anon and authenticated for %s', (table) => {
    if (table === 'gdpr_requests') {
      expect(sql).toMatch(/REVOKE ALL ON public\.gdpr_requests FROM anon/);
      expect(sql).toMatch(/REVOKE ALL ON public\.gdpr_requests FROM authenticated/);
    } else {
      expect(sql).toMatch(/REVOKE ALL ON public\.%I FROM anon/);
      expect(sql).toMatch(/REVOKE ALL ON public\.%I FROM authenticated/);
    }
  });

  test('drops all 3 known live permissive policies on gdpr_requests by exact name', () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Allow all access to gdpr_requests" ON gdpr_requests/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Allow anon read on gdpr_requests" ON gdpr_requests/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Allow authenticated full access on gdpr_requests" ON gdpr_requests/);
  });

  test("defensively drops migration 045's own policy names for the overlapping tables", () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS "%s_service" ON %I/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS "%s_select" ON %I/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS "%s_insert" ON %I/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS "%s_update" ON %I/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS "%s_anon_select" ON %I/);
  });

  test('contains no operative SQL statement touching event_guests -- it is deliberately excluded (handled by 078/079)', () => {
    // The header comment explains the exclusion in prose (so "event_guests"
    // does appear in the file) -- what matters is that no executable
    // statement (ALTER/DROP/CREATE/REVOKE ... ON event_guests, or an
    // array entry) targets it.
    expect(sql).not.toMatch(/\bON event_guests\b/);
    expect(sql).not.toMatch(/'event_guests'/);
  });

  test('contains no executable statement defining, dropping or granting on erase_organisation_gdpr or anonymize_organisation (those belong to 089/092)', () => {
    // The header comment references both function names in prose to
    // explain why they are not duplicated here -- that is expected.
    // What must not appear is an actual FUNCTION/EXECUTE statement.
    expect(sql).not.toMatch(/FUNCTION\s+(erase_organisation_gdpr|anonymize_organisation)/i);
    expect(sql).not.toMatch(/EXECUTE\s+ON\s+FUNCTION\s+(erase_organisation_gdpr|anonymize_organisation)/i);
  });

  test('never GRANTs anything to anon or authenticated (would reintroduce the exposure)', () => {
    expect(sql).not.toMatch(/GRANT\s+(?!EXECUTE)[A-Z,\s]*\s+TO\s+(anon|authenticated)/i);
  });

  test('does not contain any data-mutating DML (INSERT/UPDATE/DELETE on rows, not policies)', () => {
    // Only schema/permission statements are expected: ALTER TABLE, DROP/CREATE
    // POLICY, REVOKE, NOTIFY, and the DO/BEGIN/EXCEPTION/END plumbing around them.
    expect(sql).not.toMatch(/^\s*(INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM)/im);
  });

  test('ends with a schema-cache reload notification, matching project convention', () => {
    expect(sql.trim().endsWith("NOTIFY pgrst, 'reload schema';")).toBe(true);
  });
});
