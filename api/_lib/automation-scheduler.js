/**
 * @module automation-scheduler
 * Automation Scheduler with cron jobs for automated tasks.
 *
 * Tasks:
 * - Daily: Check payment reminders, deadline reminders
 * - Weekly: Send judge progress reports
 * - On-demand: Winner announcements, certificate generation
 */

const cron = require('node-cron');
const { sendDeadlineReminders, sendWinnerAnnouncements, sendTemplateEmail } = require('../email-automation');
const { assignJudgesToEntries, generateAllShortlists } = require('../judge-automation');
const { generateAllWinnerCertificates } = require('../certificates-qr');

// Supabase client for scheduler queries
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

/**
 * Scheduled email campaign dispatcher (runs every 5 minutes).
 * Finds campaigns with status='Scheduled' and scheduled_date <= now, then sends them.
 */
cron.schedule(
  '*/5 * * * *',
  async () => {
    try {
      await dispatchScheduledCampaigns();
    } catch (error) {
      console.error('Error dispatching scheduled campaigns:', error);
    }
  },
  {
    timezone: 'Europe/London',
  }
);

/**
 * Daily automation tasks (runs at 9:00 AM)
 */
cron.schedule(
  '0 9 * * *',
  async () => {
    console.log('\nRunning daily automation tasks...');

    try {
      // Send deadline reminders (entry close dates and judging deadlines)
      await sendDeadlineReminders();
      await checkDeadlineReminders();

      // Check for overdue invoices and send payment reminders
      await sendPaymentReminders();

      console.log('Daily automation complete\n');
    } catch (error) {
      console.error('Error in daily automation:', error);
    }
  },
  {
    timezone: 'Europe/London',
  }
);

/**
 * Weekly automation tasks (runs Monday at 8:00 AM)
 */
cron.schedule(
  '0 8 * * 1',
  async () => {
    console.log('\nRunning weekly automation tasks...');

    try {
      // Send judge progress reports
      await sendJudgeProgressReports();

      // Generate weekly statistics
      await generateWeeklyStats();

      console.log('Weekly automation complete\n');
    } catch (error) {
      console.error('Error in weekly automation:', error);
    }
  },
  {
    timezone: 'Europe/London',
  }
);

/**
 * Judging deadline check (runs daily at 10:00 AM during judging period)
 */
cron.schedule(
  '0 10 * * *',
  async () => {
    console.log('\nChecking judging progress...');

    try {
      // Get judging deadline from active awards
      const judgingDeadline = await getJudgingDeadline();

      if (!judgingDeadline) {
        console.log('No active judging deadline found');
        return;
      }

      const now = new Date();
      const daysUntilDeadline = Math.ceil((Number(judgingDeadline) - Number(now)) / (1000 * 60 * 60 * 24));

      if (daysUntilDeadline <= 7 && daysUntilDeadline > 0) {
        console.log(`Judging deadline in ${daysUntilDeadline} days`);
      }

      if (daysUntilDeadline === 0) {
        console.log('Judging deadline reached - generating shortlists');
        await generateAllShortlists();
      }

      console.log('Judging check complete\n');
    } catch (error) {
      console.error('Error in judging check:', error);
    }
  },
  {
    timezone: 'Europe/London',
  }
);

/**
 * Dispatch all scheduled email campaigns whose send time has arrived.
 * Finds email_campaigns with status='Scheduled' and scheduled_date <= now,
 * calls the send_campaign_emails RPC for each, and updates the status to 'Sent' or 'Failed'.
 * @returns {Promise<void>}
 */
async function dispatchScheduledCampaigns() {
  const now = new Date().toISOString();

  // Fetch due campaigns
  const { data: campaigns, error } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('status', 'Scheduled')
    .lte('scheduled_date', now);

  if (error) {
    console.error('dispatchScheduledCampaigns: query error', error);
    return;
  }

  if (!campaigns || campaigns.length === 0) {
    return; // Nothing to send
  }

  console.log(`dispatchScheduledCampaigns: found ${campaigns.length} campaign(s) due`);

  for (const campaign of campaigns) {
    // Mark as Sending immediately to prevent double-dispatch
    await supabase
      .from('email_campaigns')
      .update({ status: 'Sending' })
      .eq('id', campaign.id)
      .eq('status', 'Scheduled');

    try {
      // Parse stored campaign metadata from notes field
      let meta = {};
      try {
        meta = campaign.notes ? JSON.parse(campaign.notes) : {};
      } catch (_) {
        meta = {};
      }

      const listId = meta.list_id;
      if (!listId) {
        throw new Error('No list_id in campaign notes — cannot send');
      }

      const { data: rpcResult, error: rpcError } = await supabase.rpc('send_campaign_emails', {
        p_list_id: listId,
        p_subject: campaign.subject || campaign.campaign_name || 'Campaign',
        p_html: meta.html || '',
        p_from_name: meta.from_name || process.env.FROM_NAME || 'British Trade Awards',
        p_from_email: meta.from_email || process.env.FROM_EMAIL || '',
        p_reply_to: meta.reply_to || meta.from_email || process.env.FROM_EMAIL || '',
        p_campaign_name: campaign.campaign_name || campaign.subject || 'Campaign',
      });

      if (rpcError) throw rpcError;
      if (rpcResult && !rpcResult.success) throw new Error(rpcResult.error || 'RPC returned failure');

      const sentCount = rpcResult?.sent ?? campaign.total_recipients ?? 0;

      await supabase
        .from('email_campaigns')
        .update({
          status: 'Sent',
          sent_date: new Date().toISOString(),
          total_recipients: sentCount,
        })
        .eq('id', campaign.id);

      console.log(`dispatchScheduledCampaigns: sent campaign "${campaign.campaign_name}" to ${sentCount} recipients`);
    } catch (sendErr) {
      console.error(`dispatchScheduledCampaigns: failed to send campaign ${campaign.id}:`, sendErr);

      await supabase.from('email_campaigns').update({ status: 'Failed' }).eq('id', campaign.id);
    }
  }
}

/**
 * Get the nearest judging deadline from active awards.
 * @returns {Promise<Date|null>} The nearest judging deadline as a Date, or null if none found.
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
 * Send payment reminders for overdue invoices.
 * Skips invoices that have been reminded within the last 7 days.
 * @returns {Promise<void>}
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
      console.log('No overdue invoices found');
      return;
    }

    console.log(`Found ${overdueInvoices.length} overdue invoices`);

    // Update status to overdue
    for (const invoice of overdueInvoices) {
      await supabase.from('invoices').update({ status: 'overdue' }).eq('id', invoice.id);

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

      // Send payment reminder email
      const recipientEmail = invoice.organisations?.email;
      if (recipientEmail) {
        const daysOverdue = Math.ceil((new Date(today) - new Date(invoice.due_date)) / (1000 * 60 * 60 * 24));
        await sendTemplateEmail('PAYMENT_REMINDER', recipientEmail, {
          contact_name: invoice.organisations?.company_name || 'Customer',
          entry_number: invoice.invoice_number,
          entry_title: `Invoice ${invoice.invoice_number}`,
          entry_fee: String(parseFloat(invoice.total_amount || 0).toFixed(2)),
          payment_link: `${process.env.APP_URL || 'https://admin.britishtradeawards.com'}/payment?invoice=${invoice.id}`,
          days_overdue: String(daysOverdue),
        });
      }

      // Log payment reminder
      await supabase.from('payment_reminders').insert({
        invoice_id: invoice.id,
        organisation_id: invoice.organisation_id,
        reminder_type: 'overdue',
        sent_at: new Date().toISOString(),
        status: 'sent',
      });

      console.log(
        `Payment reminder sent for invoice ${invoice.invoice_number} (${invoice.organisations?.company_name})`
      );
    }
  } catch (error) {
    console.error('Error sending payment reminders:', error);
  }
}

/**
 * Send weekly judge progress reports for all active awards.
 * Logs progress percentages to the activity_logs table.
 * @returns {Promise<void>}
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
        .eq('award_id', award.id)
        .eq('status', 'submitted');

      const progress = totalEntries > 0 ? ((scoredEntries / totalEntries) * 100).toFixed(1) : 0;

      console.log(`Award: ${award.award_name} - ${scoredEntries}/${totalEntries} entries scored (${progress}%)`);

      // Log to activity_logs for admin dashboard visibility
      await supabase.from('activity_logs').insert({
        action: 'judge_progress_report',
        details: JSON.stringify({
          award_id: award.id,
          award_name: award.award_name,
          total_entries: totalEntries,
          scored_entries: scoredEntries,
          progress_percentage: progress,
        }),
        created_at: new Date().toISOString(),
      });
    }

    console.log('Judge progress reports generated');
  } catch (error) {
    console.error('Error generating judge progress reports:', error);
  }
}

/**
 * Generate weekly statistics summary including new entries, organisations, and revenue.
 * Logs the summary to the activity_logs table.
 * @returns {Promise<void>}
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

    console.log(
      `Weekly Stats: ${newEntries || 0} new entries, ${newOrgs || 0} new orgs, GBP ${weeklyRevenue.toFixed(2)} revenue`
    );

    // Log stats
    await supabase.from('activity_logs').insert({
      action: 'weekly_stats_report',
      details: JSON.stringify({
        week_start: weekStart,
        new_entries: newEntries || 0,
        new_organisations: newOrgs || 0,
        weekly_revenue: weeklyRevenue,
      }),
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generating weekly stats:', error);
  }
}

/**
 * Check for upcoming award deadlines and send reminder emails to entrants and judges.
 * Checks entry_close_date at 7, 3, and 1 day intervals, and judging_deadline similarly.
 * @returns {Promise<void>}
 */
async function checkDeadlineReminders() {
  try {
    const now = new Date();
    const intervals = [7, 3, 1];
    const appUrl = process.env.APP_URL || 'https://admin.britishtradeawards.com';

    const todayMidnight = new Date(now.toISOString().split('T')[0] + 'T00:00:00.000Z').toISOString();

    for (const daysLeft of intervals) {
      const target = new Date(now);
      target.setDate(target.getDate() + daysLeft);
      const targetStr = target.toISOString().split('T')[0];

      // --- Entry close date reminders ---
      const { data: closingAwards } = await supabase
        .from('award_years')
        .select('id, name, entry_close_date')
        .eq('entry_close_date', targetStr);

      for (const award of closingAwards || []) {
        const { data: entries } = await supabase
          .from('entries')
          .select('contact_name, contact_email')
          .eq('award_id', award.id)
          .in('status', ['submitted', 'under_review', 'draft'])
          .not('contact_email', 'is', null);

        for (const entry of entries || []) {
          if (!entry.contact_email) continue;
          // Dedup: skip if already sent today
          const { count: alreadySent } = await supabase
            .from('email_log')
            .select('id', { count: 'exact', head: true })
            .eq('template_key', 'ENTRY_DEADLINE_REMINDER')
            .eq('recipient_email', entry.contact_email)
            .gte('sent_at', todayMidnight);
          if ((alreadySent || 0) > 0) continue;
          try {
            await fetch(`${appUrl}/api/email-automation`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'sendTemplate',
                templateKey: 'ENTRY_DEADLINE_REMINDER',
                toEmail: entry.contact_email,
                variables: {
                  contact_name: entry.contact_name || 'Entrant',
                  award_name: award.name || 'Award',
                  days_left: String(daysLeft),
                  deadline: award.entry_close_date,
                  deadline_type: 'Entry Submission',
                },
              }),
            });
          } catch (emailErr) {
            console.warn(
              `checkDeadlineReminders: failed to send entry reminder to ${entry.contact_email}:`,
              emailErr.message
            );
          }
        }
      }

      // --- Judging deadline reminders ---
      const { data: judgingAwards } = await supabase
        .from('awards')
        .select('id, award_name, judging_deadline')
        .eq('judging_deadline', targetStr)
        .eq('is_active', true);

      for (const award of judgingAwards || []) {
        const { data: assignments } = await supabase
          .from('judge_assignments')
          .select('judge_email')
          .eq('award_id', award.id)
          .neq('status', 'completed');

        const judgeEmails = [...new Set((assignments || []).map((a) => a.judge_email).filter(Boolean))];

        for (const judgeEmail of judgeEmails) {
          // Dedup: skip if already sent today
          const { count: alreadySentJudge } = await supabase
            .from('email_log')
            .select('id', { count: 'exact', head: true })
            .eq('template_key', 'DEADLINE_REMINDER')
            .eq('recipient_email', judgeEmail)
            .gte('sent_at', todayMidnight);
          if ((alreadySentJudge || 0) > 0) continue;
          try {
            await fetch(`${appUrl}/api/email-automation`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'sendTemplate',
                templateKey: 'DEADLINE_REMINDER',
                toEmail: judgeEmail,
                variables: {
                  contact_name: 'Judge',
                  award_name: award.award_name || 'Award',
                  days_left: String(daysLeft),
                  deadline: award.judging_deadline,
                  deadline_type: 'Judging',
                },
              }),
            });
          } catch (emailErr) {
            console.warn(`checkDeadlineReminders: failed to send judge reminder to ${judgeEmail}:`, emailErr.message);
          }
        }
      }
    }

    console.log('checkDeadlineReminders: complete');
  } catch (error) {
    console.error('checkDeadlineReminders error:', error);
  }
}

/**
 * Manually trigger winner announcements and certificate generation.
 * @returns {Promise<{success: boolean, emailsSent: number, certificatesGenerated: number}>} Results.
 * @throws {Error} If announcement or certificate generation fails.
 */
async function triggerWinnerAnnouncements() {
  console.log('Triggering winner announcements...');

  try {
    const emailCount = await sendWinnerAnnouncements();
    const certResults = await generateAllWinnerCertificates();

    console.log(`Announced ${emailCount} winners`);
    console.log(`Generated ${certResults.filter((r) => r.success).length} certificates`);

    return {
      success: true,
      emailsSent: emailCount,
      certificatesGenerated: certResults.filter((r) => r.success).length,
    };
  } catch (error) {
    console.error('Error in winner announcements:', error);
    throw error;
  }
}

/**
 * Manually trigger judge assignments for entries.
 * @param {string|null} [awardId=null] - Optional award ID to limit assignment.
 * @returns {Promise<{assigned: number, conflicts: number}>} Assignment results.
 * @throws {Error} If assignment fails.
 */
async function triggerJudgeAssignments(awardId = null) {
  console.log('Triggering judge assignments...');

  try {
    const result = await assignJudgesToEntries(awardId);

    console.log(`Assigned ${result.assigned} judges to entries`);

    return result;
  } catch (error) {
    console.error('Error in judge assignments:', error);
    throw error;
  }
}

/**
 * Manually trigger shortlist generation and send notifications.
 * @param {string|null} [awardId=null] - Optional award ID to limit to a specific award.
 * @returns {Promise<Array<{awardId: string, shortlistCount: number}>>} Shortlist results per award.
 * @throws {Error} If shortlist generation fails.
 */
async function triggerShortlistGeneration(awardId = null) {
  console.log('Triggering shortlist generation...');

  try {
    let results;

    if (awardId) {
      const { generateShortlist } = require('../judge-automation');
      const shortlist = await generateShortlist(awardId);
      results = [{ awardId, shortlistCount: shortlist.length }];
    } else {
      results = await generateAllShortlists();
    }

    const { sendShortlistNotifications } = require('../email-automation');
    await sendShortlistNotifications(awardId);

    console.log('Shortlists generated and notifications sent');

    return results;
  } catch (error) {
    console.error('Error in shortlist generation:', error);
    throw error;
  }
}

/**
 * Register automation API endpoints on an Express app.
 * @param {Object} app - Express application instance.
 * @returns {void}
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
        nextJudgingDeadline: judgingDeadline ? judgingDeadline.toISOString() : null,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  console.log('Automation endpoints registered');
}

/**
 * Start the automation scheduler and log cron schedule details.
 * @returns {void}
 */
function startScheduler() {
  console.log('Automation scheduler started');
  console.log('Daily tasks: 9:00 AM GMT');
  console.log('Weekly tasks: Monday 8:00 AM GMT');
  console.log('Judging checks: 10:00 AM GMT');
}

/**
 * Vercel serverless handler — routes by query action.
 * Can be triggered by Vercel Cron or manual API calls.
 */
module.exports = async function handler(req, res) {
  const action = req.query.action || req.body?.action;

  try {
    switch (action) {
      case 'winner-announcements':
        await triggerWinnerAnnouncements();
        return res.json({ success: true, action: 'winner-announcements' });
      case 'judge-assignments':
        await triggerJudgeAssignments(req.body?.awardId);
        return res.json({ success: true, action: 'judge-assignments' });
      case 'shortlist-generation':
        await triggerShortlistGeneration(req.body?.awardId);
        return res.json({ success: true, action: 'shortlist-generation' });
      case 'payment-reminders':
        await sendPaymentReminders();
        return res.json({ success: true, action: 'payment-reminders' });
      case 'judge-progress':
        await sendJudgeProgressReports();
        return res.json({ success: true, action: 'judge-progress' });
      case 'weekly-stats':
        await generateWeeklyStats();
        return res.json({ success: true, action: 'weekly-stats' });
      case 'send-scheduled-campaigns':
        await dispatchScheduledCampaigns();
        return res.json({ success: true, action: 'send-scheduled-campaigns' });
      default:
        return res.status(400).json({
          error:
            'Invalid action. Use: winner-announcements, judge-assignments, shortlist-generation, payment-reminders, judge-progress, weekly-stats, send-scheduled-campaigns',
        });
    }
  } catch (error) {
    console.error('Automation error:', error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports.startScheduler = startScheduler;
module.exports.setupAutomationEndpoints = setupAutomationEndpoints;
module.exports.triggerWinnerAnnouncements = triggerWinnerAnnouncements;
module.exports.triggerJudgeAssignments = triggerJudgeAssignments;
module.exports.triggerShortlistGeneration = triggerShortlistGeneration;
module.exports.sendPaymentReminders = sendPaymentReminders;
module.exports.sendJudgeProgressReports = sendJudgeProgressReports;
module.exports.generateWeeklyStats = generateWeeklyStats;
module.exports.dispatchScheduledCampaigns = dispatchScheduledCampaigns;

// Start scheduler if running directly
if (require.main === module) {
  startScheduler();
  console.log('\nScheduler is running. Press Ctrl+C to stop.\n');
}
