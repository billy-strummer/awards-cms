/**
 * @module ai-vetting
 * AI Vetting API endpoint.
 * Server-side handler for company vetting via Claude API.
 * Keeps the Anthropic API key on the server.
 */

const { vetCompany, vetCompanies } = require('./_lib/ai-vetting-proxy');
const { verifyAuth, hasMinimumRole, getUserRole } = require('./_lib/auth');

/**
 * Vercel serverless handler for AI vetting operations.
 * Supports: vet-single (vet one company), vet-batch (vet multiple companies)
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req, res);
  if (!user) return;

  const role = await getUserRole(user.email);
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
