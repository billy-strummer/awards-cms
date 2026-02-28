/**
 * Automation Scheduler
 * Cron jobs for automated tasks
 *
 * Tasks:
 * - Daily: Check payment reminders, deadline reminders
 * - Weekly: Send judge progress reports
 * - On-demand: Winner announcements, certificate generation
 */

const cron = require('node-cron');
const { sendDeadlineReminders, sendWinnerAnnouncements } = require('./email-automation');
const { assignJudgesToEntries, generateAllShortlists } = require('./judge-automation');
const { generateAllWinnerCertificates } = require('./certificates-qr');

// Supabase client for scheduler queries
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Daily automation tasks (runs at 9:00 AM)
 */
cron.schedule('0 9 * * *', async () => {
  console.warn('\nRunning daily automation tasks...');

  try {
    // Send deadline reminders
    await sendDeadlineReminders();

    // Check for overdue invoices and send payment reminders
    await sendPaymentReminders();

    console.warn('Daily automation complete\n');
  } catch (error) {
    console.error('Error in daily automation:', error);
  }
}, {
  timezone: 'Europe/London'
});

/**
 * Weekly automation tasks (runs Monday at 8:00 AM)
 */
cron.schedule('0 8 * * 1', async () => {
  console.warn('\nRunning weekly automation tasks...');

  try {
    // Send judge progress reports
    await sendJudgeProgressReports();

    // Generate weekly statistics
    await generateWeeklyStats();

    console.warn('Weekly automation complete\n');
  } catch (error) {
    console.error('Error in weekly automation:', error);
  }
}, {
  timezone: 'Europe/London'
});

/**
 * Judging deadline check (runs daily at 10:00 AM during judging period)
 */
cron.schedule('0 10 * * *', async () => {
  console.warn('\nChecking judging progress...');

  try {
    // Get judging deadline from active awards
    const judgingDeadline = await getJudgingDeadline();

    if (!judgingDeadline) {
      console.warn('No active judging deadline found');
      return;
    }

    const now = new Date();
    const daysUntilDeadline = Math.ceil((judgingDeadline - now) / (1000 * 60 * 60 * 24));

    if (daysUntilDeadline <= 7 && daysUntilDeadline > 0) {
      console.warn(`Judging deadline in ${daysUntilDeadline} days`);
    }

    if (daysUntilDeadline === 0) {
      console.warn('Judging deadline reached - generating shortlists');
      await generateAllShortlists();
    }

    console.warn('Judging check complete\n');
  } catch (error) {
    console.error('Error in judging check:', error);
  }
}, {
  timezone: 'Europe/London'
});

/**
 * Get the nearest judging deadline from active awards
 */
async function getJudgingDeadline() {
  try {
    const { data: awards, error } = await supabase
      .from('awards')
      .select('judging_deadline')
      .eq('is_active', true)
      .not('judging_deadline', 'is', null)
      .order('judging_deadline', { ascending: true })
      .limit(1);

    if (error || !awards || awards.length === 0) return null;

    return new Date(awards[0].judging_deadline);
  } catch (error) {
    console.error('Error getting judging deadline:', error);
    return null;
  }
}

/**
 * Send payment reminders for overdue invoices
 */
async function sendPaymentReminders() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Find overdue invoices
    const { data: overdueInvoices, error } = await supabase
      .from('invoices')
      .select('*, organisations(company_name, email)')
      .lt('due_date', today)
      .in('payment_status', ['unpaid', 'partial'])
      .neq('status', 'cancelled');

    if (error) throw error;

    if (!overdueInvoices || overdueInvoices.length === 0) {
      console.warn('No overdue invoices found');
      return;
    }

    console.warn(`Found ${overdueInvoices.length} overdue invoices`);

    // Update status to overdue
    for (const invoice of overdueInvoices) {
      await supabase
        .from('invoices')
        .update({ status: 'overdue' })
        .eq('id', invoice.id);

      // Check if a reminder was already sent recently (within 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentReminders } = await supabase
        .from('payment_reminders')
        .select('id')
        .eq('invoice_id', invoice.id)
        .gte('sent_at', sevenDaysAgo.toISOString())
        .limit(1);

      if (recentReminders && recentReminders.length > 0) {
        continue; // Skip - already reminded recently
      }

      // Log payment reminder
      await supabase
        .from('payment_reminders')
        .insert({
          invoice_id: invoice.id,
          organisation_id: invoice.organisation_id,
          reminder_type: 'overdue',
          sent_at: new Date().toISOString(),
          status: 'sent'
        });

      console.warn(`Payment reminder logged for invoice ${invoice.invoice_number} (${invoice.organisations?.company_name})`);
    }

  } catch (error) {
    console.error('Error sending payment reminders:', error);
  }
}

/**
 * Send weekly judge progress reports
 */
async function sendJudgeProgressReports() {
  try {
    // Get all active awards with entries needing judging
    const { data: awards, error: awardsError } = await supabase
      .from('awards')
      .select('id, award_name')
      .eq('is_active', true);

    if (awardsError || !awards) return;

    for (const award of awards) {
      // Count entries and scored entries
      const { count: totalEntries } = await supabase
        .from('entries')
        .select('id', { count: 'exact', head: true })
        .eq('award_id', award.id)
        .eq('status', 'submitted');

      const { count: scoredEntries } = await supabase
        .from('judge_scores')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'submitted');

      const progress = totalEntries > 0 ? ((scoredEntries / totalEntries) * 100).toFixed(1) : 0;

      console.warn(`Award: ${award.award_name} - ${scoredEntries}/${totalEntries} entries scored (${progress}%)`);

      // Log to activity_logs for admin dashboard visibility
      await supabase
        .from('activity_logs')
        .insert({
          action: 'judge_progress_report',
          details: JSON.stringify({
            award_id: award.id,
            award_name: award.award_name,
            total_entries: totalEntries,
            scored_entries: scoredEntries,
            progress_percentage: progress
          }),
          created_at: new Date().toISOString()
        });
    }

    console.warn('Judge progress reports generated');

  } catch (error) {
    console.error('Error generating judge progress reports:', error);
  }
}

/**
 * Generate weekly statistics summary
 */
async function generateWeeklyStats() {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekStart = oneWeekAgo.toISOString();

    // New entries this week
    const { count: newEntries } = await supabase
      .from('entries')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekStart);

    // New payments this week
    const { data: payments } = await supabase
      .from('payments')
      .select('amount')
      .gte('payment_date', weekStart.split('T')[0])
      .eq('status', 'completed');

    const weeklyRevenue = (payments || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    // New organisations this week
    const { count: newOrgs } = await supabase
      .from('organisations')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekStart);

    console.warn(`Weekly Stats: ${newEntries || 0} new entries, ${newOrgs || 0} new orgs, GBP ${weeklyRevenue.toFixed(2)} revenue`);

    // Log stats
    await supabase
      .from('activity_logs')
      .insert({
        action: 'weekly_stats_report',
        details: JSON.stringify({
          week_start: weekStart,
          new_entries: newEntries || 0,
          new_organisations: newOrgs || 0,
          weekly_revenue: weeklyRevenue
        }),
        created_at: new Date().toISOString()
      });

  } catch (error) {
    console.error('Error generating weekly stats:', error);
  }
}

/**
 * Manual trigger functions (called via API)
 */

async function triggerWinnerAnnouncements() {
  console.warn('Triggering winner announcements...');

  try {
    const emailCount = await sendWinnerAnnouncements();
    const certResults = await generateAllWinnerCertificates();

    console.warn(`Announced ${emailCount} winners`);
    console.warn(`Generated ${certResults.filter(r => r.success).length} certificates`);

    return {
      success: true,
      emailsSent: emailCount,
      certificatesGenerated: certResults.filter(r => r.success).length
    };

  } catch (error) {
    console.error('Error in winner announcements:', error);
    throw error;
  }
}

async function triggerJudgeAssignments(awardId = null) {
  console.warn('Triggering judge assignments...');

  try {
    const result = await assignJudgesToEntries(awardId);

    console.warn(`Assigned ${result.assigned} judges to entries`);

    return result;

  } catch (error) {
    console.error('Error in judge assignments:', error);
    throw error;
  }
}

async function triggerShortlistGeneration(awardId = null) {
  console.warn('Triggering shortlist generation...');

  try {
    let results;

    if (awardId) {
      const { generateShortlist } = require('./judge-automation');
      const shortlist = await generateShortlist(awardId);
      results = [{ awardId, shortlistCount: shortlist.length }];
    } else {
      results = await generateAllShortlists();
    }

    const { sendShortlistNotifications } = require('./email-automation');
    await sendShortlistNotifications(awardId);

    console.warn('Shortlists generated and notifications sent');

    return results;

  } catch (error) {
    console.error('Error in shortlist generation:', error);
    throw error;
  }
}

/**
 * API Endpoints
 */

function setupAutomationEndpoints(app) {
  app.post('/api/automation/trigger-winner-announcements', async (req, res) => {
    try {
      const result = await triggerWinnerAnnouncements();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/automation/trigger-judge-assignments', async (req, res) => {
    try {
      const { awardId } = req.body;
      const result = await triggerJudgeAssignments(awardId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/automation/trigger-shortlist-generation', async (req, res) => {
    try {
      const { awardId } = req.body;
      const results = await triggerShortlistGeneration(awardId);
      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/automation/trigger-payment-reminders', async (req, res) => {
    try {
      await sendPaymentReminders();
      res.json({ success: true, message: 'Payment reminders processed' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/automation/status', async (req, res) => {
    try {
      const judgingDeadline = await getJudgingDeadline();
      res.json({
        scheduler: 'running',
        timezone: 'Europe/London',
        dailyTasks: '09:00 GMT',
        weeklyTasks: 'Monday 08:00 GMT',
        judgingChecks: '10:00 GMT',
        nextJudgingDeadline: judgingDeadline ? judgingDeadline.toISOString() : null
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  console.warn('Automation endpoints registered');
}

/**
 * Start scheduler
 */
function startScheduler() {
  console.warn('Automation scheduler started');
  console.warn('Daily tasks: 9:00 AM GMT');
  console.warn('Weekly tasks: Monday 8:00 AM GMT');
  console.warn('Judging checks: 10:00 AM GMT');
}

module.exports = {
  startScheduler,
  setupAutomationEndpoints,
  triggerWinnerAnnouncements,
  triggerJudgeAssignments,
  triggerShortlistGeneration,
  sendPaymentReminders,
  sendJudgeProgressReports,
  generateWeeklyStats
};

// Start scheduler if running directly
if (require.main === module) {
  startScheduler();
  console.warn('\nScheduler is running. Press Ctrl+C to stop.\n');
}
