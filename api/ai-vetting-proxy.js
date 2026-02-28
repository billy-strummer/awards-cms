/**
 * @module ai-vetting-proxy
 * AI Vetting API Proxy.
 * Server-side proxy for Claude API calls.
 * Keeps the Anthropic API key on the server.
 */

const { Anthropic } = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Vet a single company via Claude API.
 * Called from the frontend via Supabase Edge Function.
 * @param {Object} company - The company details to vet.
 * @param {string} company.companyName - The name of the company.
 * @param {string} [company.website] - The company website URL.
 * @param {string} [company.sector] - The sector or category of the company.
 * @param {string} [company.county] - The region or county of the company.
 * @returns {Promise<Object>} Parsed JSON vetting result with reputation score, operational status, etc.
 * @throws {Error} If the API key is not configured or the AI response is empty.
 */
async function vetCompany({ companyName, website, sector, county }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured on the server');
  }

  // Sanitise inputs to prevent prompt injection
  const sanitise = (s) => String(s || '').replace(/[<>{}[\]]/g, '').substring(0, 200);
  const safeCompany = sanitise(companyName);
  const safeWebsite = sanitise(website) || 'Not provided';
  const safeSector = sanitise(sector) || 'Not provided';
  const safeCounty = sanitise(county) || 'Not provided';

  const prompt = `You are a business verification assistant for the British Trade Awards.

Please verify the following nominated company:
- Company Name: ${safeCompany}
- Website: ${safeWebsite}
- Sector/Category: ${safeSector}
- Region/County: ${safeCounty}

Please assess:
1. Is this company still operational and in business?
2. Does the sector/category match their actual business operations?
3. What is their reputation (rate 1-10)?
4. Any recent news about this company?
5. Any recent ownership changes or significant business changes?

Provide your response in the following JSON format:
{
  "is_operational": true/false,
  "category_match": true/false,
  "reputation_score": 1-10,
  "recent_news": "brief summary",
  "ownership_changes": "brief summary or null",
  "recommendation": "brief recommendation",
  "confidence_score": 0.0-1.0
}`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  });

  const content = message.content?.[0]?.text;
  if (!content) throw new Error('Empty response from AI service');

  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : content);
}

/**
 * Batch vet multiple companies sequentially with rate limiting.
 * @param {Array<Object>} companies - Array of company objects to vet.
 * @param {string} companies[].companyName - The name of the company.
 * @param {string} [companies[].organisationId] - The organisation ID for tracking.
 * @param {string} [companies[].website] - The company website URL.
 * @param {string} [companies[].sector] - The sector or category.
 * @param {string} [companies[].county] - The region or county.
 * @returns {Promise<Array<Object>>} Array of vetting results with status ('clear', 'flagged', or 'error').
 */
async function vetCompanies(companies) {
  const results = [];

  for (const company of companies) {
    try {
      const result = await vetCompany(company);
      results.push({
        company_name: company.companyName,
        organisation_id: company.organisationId,
        ...result,
        status: result.reputation_score < 4 || !result.is_operational ? 'flagged' : 'clear'
      });
    } catch (e) {
      results.push({
        company_name: company.companyName,
        organisation_id: company.organisationId,
        status: 'error',
        error: e.message
      });
    }

    // Rate limit: 200ms delay between calls
    await new Promise(r => setTimeout(r, 200));
  }

  return results;
}

module.exports = { vetCompany, vetCompanies };
