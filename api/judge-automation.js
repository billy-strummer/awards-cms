/**
 * @module judge-automation
 * Judge Assignment and Shortlist Generation Automation.
 *
 * Features:
 * - Automated judge assignment based on expertise
 * - Fair distribution algorithm
 * - Conflict of interest checking
 * - Automated shortlist generation
 * - Score-based ranking
 */

const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

/**
 * Escape a string for safe inclusion in HTML.
 * @param {string} str - The string to escape.
 * @returns {string} The HTML-escaped string.
 */
const escHtml = (str) =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { verifyAuth } = require('./_lib/auth');

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.APP_URL || 'https://admin.britishtradeawards.com';

/**
 * Assign judges to entries automatically using round-robin with expertise matching and conflict checking.
 * @param {string|null} [awardId=null] - Optional award ID to limit assignment to a specific award.
 * @returns {Promise<{assigned: number, conflicts: number, totalEntries: number, totalJudges: number}>} Assignment statistics.
 * @throws {Error} If no active judges are found or a database error occurs.
 */
async function assignJudgesToEntries(awardId = null) {
  try {
    console.log('🎯 Starting automated judge assignment...');

    // Get all judges (from contacts or separate judges table)
    const { data: judges, error: judgesError } = await supabase
      .from('contacts')
      .select('*')
      .eq('contact_type', 'judge')
      .eq('is_active', true);

    if (judgesError) throw judgesError;

    if (!judges || judges.length === 0) {
      throw new Error('No active judges found');
    }

    // Get entries that need judging
    let query = supabase.from('entries').select('*, organisations(*), awards:award_years(*)').eq('status', 'submitted');

    if (awardId) {
      query = query.eq('award_id', awardId);
    }

    const { data: entries, error: entriesError } = await query;

    if (entriesError) throw entriesError;

    if (!entries || entries.length === 0) {
      console.log('ℹ️ No entries found that need judging');
      return { assigned: 0, conflicts: 0, totalEntries: 0, totalJudges: 0 };
    }

    console.log(`📝 Found ${entries.length} entries to assign`);
    console.log(`👨‍⚖️ Found ${judges.length} available judges`);

    // Batch-fetch ALL existing judge scores for these entries in one query (avoids N+1)
    const entryIds = entries.map((e) => e.id);
    const { data: allExistingScores } = await supabase
      .from('judge_scores')
      .select('entry_id, judge_email, conflict_declared')
      .in('entry_id', entryIds);

    // Build O(1) lookup maps
    const assignedByEntry = new Map(); // entry_id → Set<judge_email>
    const declaredConflicts = new Set(); // "judgeEmail::entryId"
    for (const score of allExistingScores || []) {
      if (!assignedByEntry.has(score.entry_id)) assignedByEntry.set(score.entry_id, new Set());
      assignedByEntry.get(score.entry_id).add(score.judge_email);
      if (score.conflict_declared) declaredConflicts.add(`${score.judge_email}::${score.entry_id}`);
    }

    // Number of judges per entry (typically 3-5)
    const judgesPerEntry = 3;

    let assignedCount = 0;
    let conflictCount = 0;

    // For each entry, assign judges
    for (const entry of entries) {
      const alreadyAssigned = assignedByEntry.get(entry.id) || new Set();

      // Filter out already assigned judges
      const availableJudges = judges.filter((j) => !alreadyAssigned.has(j.email));

      // Check conflicts synchronously using pre-fetched data (no per-entry DB queries)
      const judgesWithScores = availableJudges.map((judge) => {
        const conflict = checkConflictSync(judge, entry, declaredConflicts);
        const expertiseScore = calculateExpertiseScore(judge, entry);

        return {
          judge,
          conflict,
          expertiseScore,
        };
      });

      // Filter out conflicts and sort by expertise
      const suitableJudges = judgesWithScores
        .filter((j) => !j.conflict)
        .sort((a, b) => b.expertiseScore - a.expertiseScore)
        .slice(0, judgesPerEntry - alreadyAssigned.size);

      // Assign judges
      for (const { judge } of suitableJudges) {
        // Create placeholder score record (unscored)
        await supabase.from('judge_scores').insert([
          {
            entry_id: entry.id,
            judge_email: judge.email,
            judge_name: judge.full_name || judge.email,
            is_complete: false,
            has_conflict: false,
          },
        ]);

        assignedCount++;

        // Send assignment notification email
        await sendJudgeAssignmentEmail(judge, entry);
      }

      // Count conflicts
      conflictCount += judgesWithScores.filter((j) => j.conflict).length;
    }

    console.log(`✅ Assignment complete:`);
    console.log(`   - Assigned: ${assignedCount} judge-entry pairs`);
    console.log(`   - Conflicts detected: ${conflictCount}`);

    return {
      assigned: assignedCount,
      conflicts: conflictCount,
      totalEntries: entries.length,
      totalJudges: judges.length,
    };
  } catch (error) {
    console.error('❌ Error in judge assignment:', error);
    throw error;
  }
}

/**
 * Synchronous conflict check using pre-fetched declared-conflict set.
 * Used inside assignJudgesToEntries to avoid N+1 DB queries.
 * @param {Object} judge
 * @param {Object} entry
 * @param {Set<string>} declaredConflicts - Set of "judgeEmail::entryId" keys
 * @returns {boolean}
 */
function checkConflictSync(judge, entry, declaredConflicts) {
  const judgeDomain = judge.email.split('@')[1];
  const companyDomain = entry.organisations?.website
    ?.replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];

  if (judgeDomain && companyDomain && judgeDomain === companyDomain) return true;

  if (entry.organisations?.company_name) {
    const companyNameLower = entry.organisations.company_name.toLowerCase();
    const judgeCompanyLower = (judge.company_name || '').toLowerCase();
    if (judgeCompanyLower && companyNameLower.includes(judgeCompanyLower)) return true;
  }

  return declaredConflicts.has(`${judge.email}::${entry.id}`);
}

/**
 * Check for conflicts of interest between a judge and an entry (async, for standalone calls).
 * @param {Object} judge - The judge contact record.
 * @param {Object} entry - The entry record with organisation details.
 * @returns {Promise<boolean>} True if a conflict of interest is detected.
 */
// eslint-disable-next-line no-unused-vars
async function checkConflict(judge, entry) {
  const judgeDomain = judge.email.split('@')[1];
  const companyDomain = entry.organisations?.website
    ?.replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];

  if (judgeDomain && companyDomain && judgeDomain === companyDomain) return true;

  if (entry.organisations?.company_name) {
    const companyNameLower = entry.organisations.company_name.toLowerCase();
    const judgeCompanyLower = (judge.company_name || '').toLowerCase();
    if (judgeCompanyLower && companyNameLower.includes(judgeCompanyLower)) return true;
  }

  if (entry.id && judge.email) {
    const { data: declared } = await supabase
      .from('judge_scores')
      .select('conflict_declared')
      .eq('judge_email', judge.email)
      .eq('entry_id', entry.id)
      .eq('conflict_declared', true)
      .limit(1);
    if (declared && declared.length > 0) return true;
  }

  return false;
}

/**
 * Calculate expertise score for judge-entry matching based on category and industry keywords.
 * @param {Object} judge - The judge contact record with notes containing expertise info.
 * @param {Object} entry - The entry record with award category details.
 * @returns {number} Expertise score (higher means better match).
 */
function calculateExpertiseScore(judge, entry) {
  let score = 0;

  // Match by award category
  const awardCategory = entry.awards?.award_category?.toLowerCase() || '';
  const judgeExpertise = (judge.notes || '').toLowerCase();

  if (judgeExpertise.includes(awardCategory)) {
    score += 10;
  }

  // Match by industry keywords
  const industryKeywords = ['technology', 'manufacturing', 'retail', 'services', 'export'];
  for (const keyword of industryKeywords) {
    if (awardCategory.includes(keyword) && judgeExpertise.includes(keyword)) {
      score += 5;
    }
  }

  // Preference for judges who have judged before (experience)
  // This would require querying their past judging history
  // score += judgeExperienceBonus;

  return score;
}

/**
 * Generate shortlist based on judge scores for a specific award.
 * Uses composite scoring with standard deviation penalty for consistency.
 * @param {string} awardId - The award ID to generate the shortlist for.
 * @param {number} [topN=5] - The number of top entries to shortlist.
 * @returns {Promise<Array<Object>>} Array of shortlisted entry objects with scoring details.
 * @throws {Error} If a database error occurs.
 */
async function generateShortlist(awardId, topN = 5) {
  try {
    console.log(`📊 Generating shortlist for award ${awardId}...`);

    // Get all entries for this award with complete scores
    const { data: entries, error } = await supabase
      .from('entries')
      .select(
        `
        *,
        organisations(company_name),
        awards:award_years(award_name),
        judge_scores!inner(*)
      `
      )
      .eq('award_id', awardId)
      .eq('status', 'submitted')
      .not('average_score', 'is', null)
      .order('average_score', { ascending: false });

    if (error) throw error;

    if (!entries || entries.length === 0) {
      console.log('ℹ️ No entries with scores found for this award');
      return [];
    }

    // Filter entries with minimum number of complete scores
    const minScores = 2; // Require at least 2 judges to have scored
    const validEntries = entries.filter((entry) => {
      const completeScores = entry.judge_scores.filter((s) => s.is_complete);
      return completeScores.length >= minScores;
    });

    console.log(`📝 ${validEntries.length} entries have sufficient scores`);

    // Calculate composite scores (average + consistency)
    const entriesWithScores = validEntries.map((entry) => {
      const scores = entry.judge_scores.filter((s) => s.is_complete).map((s) => s.total_score);

      const average = scores.reduce((a, b) => a + b, 0) / scores.length;

      // Calculate standard deviation (score consistency)
      const variance =
        scores.reduce((sum, score) => {
          return sum + Math.pow(score - average, 2);
        }, 0) / scores.length;
      const stdDev = Math.sqrt(variance);

      // Composite score: average - (stdDev penalty)
      // Lower standard deviation = more consistent judging = slightly higher score
      const compositeScore = average - stdDev * 0.1;

      // Count shortlist recommendations
      const shortlistRecs = entry.judge_scores.filter((s) => s.is_complete && s.recommendation === 'shortlist').length;

      return {
        ...entry,
        averageScore: average,
        scoreConsistency: stdDev,
        compositeScore,
        shortlistRecommendations: shortlistRecs,
        totalJudges: entry.judge_scores.length,
      };
    });

    // Sort by composite score
    entriesWithScores.sort((a, b) => b.compositeScore - a.compositeScore);

    // Take top N
    const shortlist = entriesWithScores.slice(0, topN);

    // Update database - mark as shortlisted
    for (const entry of shortlist) {
      await supabase
        .from('entries')
        .update({
          is_shortlisted: true,
          shortlisted_date: new Date().toISOString(),
          status: 'shortlisted',
        })
        .eq('id', entry.id);

      // Send shortlist notification email
      await sendShortlistNotificationEmail(entry);
    }

    console.log(`✅ Shortlist generated:`);
    shortlist.forEach((entry, index) => {
      console.log(
        `   ${index + 1}. ${entry.organisations.company_name} - Score: ${entry.averageScore.toFixed(2)} (σ: ${entry.scoreConsistency.toFixed(2)})`
      );
    });

    return shortlist;
  } catch (error) {
    console.error('❌ Error generating shortlist:', error);
    throw error;
  }
}

/**
 * Generate shortlists for all active awards.
 * @param {number} [topN=5] - The number of top entries to shortlist per award.
 * @returns {Promise<Array<{awardId: string, awardName: string, shortlistCount: number}>>} Results for each award.
 * @throws {Error} If a database error occurs.
 */
async function generateAllShortlists(topN = 5) {
  try {
    console.log('🎯 Generating shortlists for all awards...');

    // Get all active awards
    const { data: awards, error } = await supabase.from('awards').select('id, award_name').eq('is_active', true);

    if (error) throw error;

    const results = [];

    for (const award of awards) {
      console.log(`\n📋 Processing: ${award.award_name}`);
      const shortlist = await generateShortlist(award.id, topN);
      results.push({
        awardId: award.id,
        awardName: award.award_name,
        shortlistCount: shortlist.length,
      });
    }

    console.log('\n✅ All shortlists generated');
    return results;
  } catch (error) {
    console.error('❌ Error generating all shortlists:', error);
    throw error;
  }
}

/**
 * Send judge assignment email notification for a specific entry.
 * @param {Object} judge - The judge contact record with email and full_name.
 * @param {Object} entry - The entry record with award details.
 * @returns {Promise<void>}
 */
async function sendJudgeAssignmentEmail(judge, entry) {
  try {
    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'awards@britishtradeawards.com',
      to: judge.email,
      subject: `Judge Assignment: ${entry.awards?.award_name || 'British Trade Awards'}`,
      html: `
        <h2>British Trade Awards - Judge Assignment</h2>
        <p>Dear ${escHtml(judge.full_name || judge.email)},</p>
        <p>You have been assigned to judge the following entry:</p>
        <ul>
          <li><strong>Award:</strong> ${escHtml(entry.awards?.award_name || 'N/A')}</li>
          <li><strong>Entry:</strong> ${escHtml(entry.entry_number || entry.id)}</li>
          <li><strong>Category:</strong> ${escHtml(entry.awards?.sector || 'N/A')}</li>
        </ul>
        <p>Please log in to the Judge Portal to begin scoring:</p>
        <p><a href="${APP_URL}/judge-portal.html" style="background:#0d6efd;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Open Judge Portal</a></p>
        <p>Thank you for your time and expertise.</p>
        <p><em>British Trade Awards Team</em></p>
      `,
    });
    console.log(`Email sent: judge assignment to ${judge.email}`);
  } catch (e) {
    console.error(`Failed to send judge assignment email to ${judge.email}:`, e.message);
  }
}

/**
 * Send shortlist notification email to the entry contact.
 * @param {Object} entry - The entry record with contact, organisation, and award details.
 * @returns {Promise<void>}
 */
async function sendShortlistNotificationEmail(entry) {
  try {
    const toEmail = entry.contact_email || entry.organisations?.email;
    if (!toEmail) return;

    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'awards@britishtradeawards.com',
      to: toEmail,
      subject: `Congratulations! You've been shortlisted - ${entry.awards?.award_name || 'British Trade Awards'}`,
      html: `
        <h2>British Trade Awards - Shortlist Notification</h2>
        <p>Dear ${escHtml(entry.contact_name || 'Nominee')},</p>
        <p>We are delighted to inform you that <strong>${escHtml(entry.organisations?.company_name || 'your company')}</strong> has been shortlisted for the <strong>${escHtml(entry.awards?.award_name || '')}</strong>.</p>
        <p>This is a significant achievement and recognises the outstanding work of your organisation.</p>
        <h3>Next Steps</h3>
        <ul>
          <li>Winners will be announced at the awards ceremony</li>
          <li>You will receive further details about the ceremony shortly</li>
          <li>In the meantime, feel free to share this great news</li>
        </ul>
        <p>Congratulations once again!</p>
        <p><em>British Trade Awards Team</em></p>
      `,
    });
    console.log(`Email sent: shortlist notification to ${toEmail}`);
  } catch (e) {
    console.error(`Failed to send shortlist notification:`, e.message);
  }
}

/**
 * Get judging statistics for all entries or a specific award.
 * @param {string|null} [awardId=null] - Optional award ID to filter statistics.
 * @returns {Promise<{totalEntries: number, entriesWithScores: number, entriesFullyJudged: number, averageScoresPerEntry: number|string, completionRate: string}>} Judging statistics.
 * @throws {Error} If a database error occurs.
 */
async function getJudgingStatistics(awardId = null) {
  try {
    let query = supabase.from('entries').select('*, judge_scores(*)');

    if (awardId) {
      query = query.eq('award_id', awardId);
    }

    const { data: entries, error } = await query;

    if (error) throw error;

    const stats = {
      totalEntries: entries.length,
      entriesWithScores: 0,
      entriesFullyJudged: 0,
      averageScoresPerEntry: 0,
      completionRate: 0,
    };

    let totalScores = 0;

    entries.forEach((entry) => {
      const scores = entry.judge_scores || [];
      const completeScores = scores.filter((s) => s.is_complete);

      if (completeScores.length > 0) {
        stats.entriesWithScores++;
      }

      if (completeScores.length >= 3) {
        stats.entriesFullyJudged++;
      }

      totalScores += completeScores.length;
    });

    /** @type {any} */
    const avgScores = entries.length > 0 ? (totalScores / entries.length).toFixed(2) : 0;
    stats.averageScoresPerEntry = avgScores;

    /** @type {any} */
    const completionRate =
      entries.length > 0 ? ((stats.entriesFullyJudged / entries.length) * 100).toFixed(1) + '%' : '0%';
    stats.completionRate = completionRate;

    return /** @type {any} */ (stats);
  } catch (error) {
    console.error('Error getting judging statistics:', error);
    throw error;
  }
}

/**
 * API endpoint to trigger automated judge assignment.
 * POST /api/assign-judges
 * @param {Object} req - Express request object with optional body.awardId.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
async function assignJudgesEndpoint(req, res) {
  try {
    const { awardId } = req.body;
    const result = await assignJudgesToEntries(awardId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * API endpoint to generate shortlist for a specific award.
 * POST /api/generate-shortlist
 * @param {Object} req - Express request object with body.awardId and optional body.topN.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
async function generateShortlistEndpoint(req, res) {
  try {
    const { awardId, topN } = req.body;
    const shortlist = await generateShortlist(awardId, topN || 5);
    res.json({ success: true, shortlist });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * API endpoint to generate shortlists for all active awards.
 * POST /api/generate-all-shortlists
 * @param {Object} req - Express request object with optional body.topN.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
async function generateAllShortlistsEndpoint(req, res) {
  try {
    const { topN } = req.body;
    const results = await generateAllShortlists(topN || 5);
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * API endpoint to retrieve judging statistics.
 * GET /api/judging-stats
 * @param {Object} req - Express request object with optional query.awardId.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
async function getJudgingStatsEndpoint(req, res) {
  try {
    const { awardId } = req.query;
    const stats = await getJudgingStatistics(awardId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Vercel serverless handler — routes by query action.
 */
module.exports = async function handler(req, res) {
  // Verify authentication for all actions
  const user = await verifyAuth(req, res);
  if (!user) return;

  const action = req.query.action || req.body?.action;

  switch (action) {
    case 'assign-judges':
      return assignJudgesEndpoint(req, res);
    case 'generate-shortlist':
      return generateShortlistEndpoint(req, res);
    case 'generate-all-shortlists':
      return generateAllShortlistsEndpoint(req, res);
    case 'stats':
      return getJudgingStatsEndpoint(req, res);
    default:
      return res
        .status(400)
        .json({ error: 'Invalid action. Use: assign-judges, generate-shortlist, generate-all-shortlists, stats' });
  }
};

module.exports.assignJudgesToEntries = assignJudgesToEntries;
module.exports.generateShortlist = generateShortlist;
module.exports.generateAllShortlists = generateAllShortlists;
module.exports.getJudgingStatistics = getJudgingStatistics;
module.exports.assignJudgesEndpoint = assignJudgesEndpoint;
module.exports.generateShortlistEndpoint = generateShortlistEndpoint;
module.exports.generateAllShortlistsEndpoint = generateAllShortlistsEndpoint;
module.exports.getJudgingStatsEndpoint = getJudgingStatsEndpoint;
