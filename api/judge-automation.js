/**
 * Judge Assignment & Shortlist Generation Automation
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

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.APP_URL || 'https://admin.britishtrade.com';

/**
 * Assign judges to entries automatically
 * Algorithm: Round-robin with expertise matching and conflict checking
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
    let query = supabase
      .from('entries')
      .select('*, organisations(*), awards:award_years(*)')
      .eq('status', 'submitted');

    if (awardId) {
      query = query.eq('award_id', awardId);
    }

    const { data: entries, error: entriesError } = await query;

    if (entriesError) throw entriesError;

    if (!entries || entries.length === 0) {
      console.log('ℹ️ No entries found that need judging');
      return { assigned: 0, conflicts: 0 };
    }

    console.log(`📝 Found ${entries.length} entries to assign`);
    console.log(`👨‍⚖️ Found ${judges.length} available judges`);

    // Number of judges per entry (typically 3-5)
    const judgesPerEntry = 3;

    let assignedCount = 0;
    let conflictCount = 0;

    // For each entry, assign judges
    for (const entry of entries) {
      // Get existing assignments for this entry
      const { data: existingAssignments } = await supabase
        .from('judge_scores')
        .select('judge_email')
        .eq('entry_id', entry.id);

      const alreadyAssigned = existingAssignments?.map(a => a.judge_email) || [];

      // Filter out already assigned judges
      const availableJudges = judges.filter(j => !alreadyAssigned.includes(j.email));

      // Check conflicts and sort by expertise
      const judgesWithScores = await Promise.all(
        availableJudges.map(async (judge) => {
          const conflict = await checkConflict(judge, entry);
          const expertiseScore = calculateExpertiseScore(judge, entry);

          return {
            judge,
            conflict,
            expertiseScore
          };
        })
      );

      // Filter out conflicts and sort by expertise
      const suitableJudges = judgesWithScores
        .filter(j => !j.conflict)
        .sort((a, b) => b.expertiseScore - a.expertiseScore)
        .slice(0, judgesPerEntry - alreadyAssigned.length);

      // Assign judges
      for (const { judge } of suitableJudges) {
        // Create placeholder score record (unscored)
        await supabase.from('judge_scores').insert([{
          entry_id: entry.id,
          judge_email: judge.email,
          judge_name: judge.full_name || judge.email,
          is_complete: false,
          has_conflict: false
        }]);

        assignedCount++;

        // Send assignment notification email
        await sendJudgeAssignmentEmail(judge, entry);
      }

      // Count conflicts
      conflictCount += judgesWithScores.filter(j => j.conflict).length;
    }

    console.log(`✅ Assignment complete:`);
    console.log(`   - Assigned: ${assignedCount} judge-entry pairs`);
    console.log(`   - Conflicts detected: ${conflictCount}`);

    return {
      assigned: assignedCount,
      conflicts: conflictCount,
      totalEntries: entries.length,
      totalJudges: judges.length
    };

  } catch (error) {
    console.error('❌ Error in judge assignment:', error);
    throw error;
  }
}

/**
 * Check for conflicts of interest
 */
async function checkConflict(judge, entry) {
  // Check email domain match
  const judgeDomain = judge.email.split('@')[1];
  const companyDomain = entry.organisations?.website?.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

  if (judgeDomain && companyDomain && judgeDomain === companyDomain) {
    return true;
  }

  // Check if judge works for the company
  if (entry.organisations?.company_name) {
    const companyNameLower = entry.organisations.company_name.toLowerCase();
    const judgeCompanyLower = (judge.company_name || '').toLowerCase();

    if (judgeCompanyLower && companyNameLower.includes(judgeCompanyLower)) {
      return true;
    }
  }

  // TODO: Check custom conflict declarations
  // Check if judge has declared conflicts in their profile

  return false;
}

/**
 * Calculate expertise score for judge-entry matching
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
 * Generate shortlist based on judge scores
 */
async function generateShortlist(awardId, topN = 5) {
  try {
    console.log(`📊 Generating shortlist for award ${awardId}...`);

    // Get all entries for this award with complete scores
    const { data: entries, error } = await supabase
      .from('entries')
      .select(`
        *,
        organisations(company_name),
        awards:award_years(award_name),
        judge_scores!inner(*)
      `)
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
    const validEntries = entries.filter(entry => {
      const completeScores = entry.judge_scores.filter(s => s.is_complete);
      return completeScores.length >= minScores;
    });

    console.log(`📝 ${validEntries.length} entries have sufficient scores`);

    // Calculate composite scores (average + consistency)
    const entriesWithScores = validEntries.map(entry => {
      const scores = entry.judge_scores
        .filter(s => s.is_complete)
        .map(s => s.total_score);

      const average = scores.reduce((a, b) => a + b, 0) / scores.length;

      // Calculate standard deviation (score consistency)
      const variance = scores.reduce((sum, score) => {
        return sum + Math.pow(score - average, 2);
      }, 0) / scores.length;
      const stdDev = Math.sqrt(variance);

      // Composite score: average - (stdDev penalty)
      // Lower standard deviation = more consistent judging = slightly higher score
      const compositeScore = average - (stdDev * 0.1);

      // Count shortlist recommendations
      const shortlistRecs = entry.judge_scores.filter(s =>
        s.is_complete && s.recommendation === 'shortlist'
      ).length;

      return {
        ...entry,
        averageScore: average,
        scoreConsistency: stdDev,
        compositeScore,
        shortlistRecommendations: shortlistRecs,
        totalJudges: entry.judge_scores.length
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
          status: 'shortlisted'
        })
        .eq('id', entry.id);

      // Send shortlist notification email
      await sendShortlistNotificationEmail(entry);
    }

    console.log(`✅ Shortlist generated:`);
    shortlist.forEach((entry, index) => {
      console.log(`   ${index + 1}. ${entry.organisations.company_name} - Score: ${entry.averageScore.toFixed(2)} (σ: ${entry.scoreConsistency.toFixed(2)})`);
    });

    return shortlist;

  } catch (error) {
    console.error('❌ Error generating shortlist:', error);
    throw error;
  }
}

/**
 * Generate shortlists for all awards
 */
async function generateAllShortlists(topN = 5) {
  try {
    console.log('🎯 Generating shortlists for all awards...');

    // Get all active awards
    const { data: awards, error } = await supabase
      .from('awards')
      .select('id, award_name')
      .eq('is_active', true);

    if (error) throw error;

    const results = [];

    for (const award of awards) {
      console.log(`\n📋 Processing: ${award.award_name}`);
      const shortlist = await generateShortlist(award.id, topN);
      results.push({
        awardId: award.id,
        awardName: award.award_name,
        shortlistCount: shortlist.length
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
 * Send judge assignment email
 */
async function sendJudgeAssignmentEmail(judge, entry) {
  try {
    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'awards@britishtrade.com',
      to: judge.email,
      subject: `Judge Assignment: ${entry.awards?.award_name || 'British Trade Awards'}`,
      html: `
        <h2>British Trade Awards - Judge Assignment</h2>
        <p>Dear ${judge.full_name || judge.email},</p>
        <p>You have been assigned to judge the following entry:</p>
        <ul>
          <li><strong>Award:</strong> ${entry.awards?.award_name || 'N/A'}</li>
          <li><strong>Entry:</strong> ${entry.entry_number || entry.id}</li>
          <li><strong>Category:</strong> ${entry.awards?.sector || 'N/A'}</li>
        </ul>
        <p>Please log in to the Judge Portal to begin scoring:</p>
        <p><a href="${APP_URL}/judge-portal.html" style="background:#0d6efd;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Open Judge Portal</a></p>
        <p>Thank you for your time and expertise.</p>
        <p><em>British Trade Awards Team</em></p>
      `
    });
    console.log(`Email sent: judge assignment to ${judge.email}`);
  } catch (e) {
    console.error(`Failed to send judge assignment email to ${judge.email}:`, e.message);
  }
}

/**
 * Send shortlist notification email
 */
async function sendShortlistNotificationEmail(entry) {
  try {
    const toEmail = entry.contact_email || entry.organisations?.email;
    if (!toEmail) return;

    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'awards@britishtrade.com',
      to: toEmail,
      subject: `Congratulations! You've been shortlisted - ${entry.awards?.award_name || 'British Trade Awards'}`,
      html: `
        <h2>British Trade Awards - Shortlist Notification</h2>
        <p>Dear ${entry.contact_name || 'Nominee'},</p>
        <p>We are delighted to inform you that <strong>${entry.organisations?.company_name || 'your company'}</strong> has been shortlisted for the <strong>${entry.awards?.award_name || ''}</strong>.</p>
        <p>This is a significant achievement and recognises the outstanding work of your organisation.</p>
        <h3>Next Steps</h3>
        <ul>
          <li>Winners will be announced at the awards ceremony</li>
          <li>You will receive further details about the ceremony shortly</li>
          <li>In the meantime, feel free to share this great news</li>
        </ul>
        <p>Congratulations once again!</p>
        <p><em>British Trade Awards Team</em></p>
      `
    });
    console.log(`Email sent: shortlist notification to ${toEmail}`);
  } catch (e) {
    console.error(`Failed to send shortlist notification:`, e.message);
  }
}

/**
 * Get judging statistics
 */
async function getJudgingStatistics(awardId = null) {
  try {
    let query = supabase
      .from('entries')
      .select('*, judge_scores(*)');

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
      completionRate: 0
    };

    let totalScores = 0;

    entries.forEach(entry => {
      const scores = entry.judge_scores || [];
      const completeScores = scores.filter(s => s.is_complete);

      if (completeScores.length > 0) {
        stats.entriesWithScores++;
      }

      if (completeScores.length >= 3) {
        stats.entriesFullyJudged++;
      }

      totalScores += completeScores.length;
    });

    stats.averageScoresPerEntry = entries.length > 0
      ? (totalScores / entries.length).toFixed(2)
      : 0;

    stats.completionRate = entries.length > 0
      ? ((stats.entriesFullyJudged / entries.length) * 100).toFixed(1) + '%'
      : '0%';

    return stats;

  } catch (error) {
    console.error('Error getting judging statistics:', error);
    throw error;
  }
}

/**
 * API Endpoints
 */

// POST /api/assign-judges
async function assignJudgesEndpoint(req, res) {
  try {
    const { awardId } = req.body;
    const result = await assignJudgesToEntries(awardId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// POST /api/generate-shortlist
async function generateShortlistEndpoint(req, res) {
  try {
    const { awardId, topN } = req.body;
    const shortlist = await generateShortlist(awardId, topN || 5);
    res.json({ success: true, shortlist });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// POST /api/generate-all-shortlists
async function generateAllShortlistsEndpoint(req, res) {
  try {
    const { topN } = req.body;
    const results = await generateAllShortlists(topN || 5);
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// GET /api/judging-stats
async function getJudgingStatsEndpoint(req, res) {
  try {
    const { awardId } = req.query;
    const stats = await getJudgingStatistics(awardId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  assignJudgesToEntries,
  generateShortlist,
  generateAllShortlists,
  getJudgingStatistics,
  assignJudgesEndpoint,
  generateShortlistEndpoint,
  generateAllShortlistsEndpoint,
  getJudgingStatsEndpoint
};
