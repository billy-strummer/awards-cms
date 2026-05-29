/**
 * @module ai-vetting
 * AI Vetting API endpoint.
 * Server-side handler for company vetting via Claude API.
 * Keeps the Anthropic API key on the server.
 */

const { createClient } = require('@supabase/supabase-js');
const { vetCompany, vetCompanies } = require('./_lib/ai-vetting-proxy');

const ROLE_HIERARCHY = ['viewer', 'judge', 'marketing', 'finance', 'editor', 'admin', 'super_admin'];

function hasMinimumRole(userRole, requiredRole) {
  const a = ROLE_HIERARCHY.indexOf((userRole || '').toLowerCase());
  const b = ROLE_HIERARCHY.indexOf(requiredRole);
  return a >= 0 && b >= 0 && a >= b;
}

async function getUserRole(supabaseService, email) {
  const { data } = await supabaseService.from('user_roles').select('role').eq('email', email).limit(1).maybeSingle();
  return data?.role || 'viewer';
}

/**
 * Vercel serverless handler for AI vetting operations.
 * Supports: vet-single (vet one company), vet-batch (vet multiple companies)
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authentication
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseAuth = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY
  );
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const supabaseService = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const role = await getUserRole(supabaseService, user.email);
  if (!hasMinimumRole(role, 'editor')) {
    return res.status(403).json({ error: 'Insufficient permissions for AI vetting' });
  }

  const { action } = req.body;

  try {
    switch (action) {
      case 'vet-single': {
        const { companyName, website, sector, county } = req.body;
        if (!companyName) {
          return res.status(400).json({ error: 'Missing required field: companyName' });
        }
        const result = await vetCompany({ companyName, website, sector, county });
        return res.status(200).json(result);
      }
      case 'vet-batch': {
        const { companies } = req.body;
        if (!companies || !Array.isArray(companies)) {
          return res.status(400).json({ error: 'Missing required field: companies (array)' });
        }
        if (companies.length > 50) {
          return res.status(400).json({ error: 'Batch size limited to 50 companies' });
        }
        const results = await vetCompanies(companies);
        return res.status(200).json({ results });
      }
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error('AI vetting API error:', error);
    if (error.message && error.message.includes('not configured')) {
      return res.status(503).json({ error: 'AI vetting is not configured on this server', details: error.message });
    }
    return res.status(500).json({ error: 'An internal error occurred' });
  }
};
