/**
 * @module automation-scheduler
 * Automation business logic for scheduled tasks (deadline reminders, payment
 * reminders, scheduled campaign dispatch, judging deadline checks, weekly
 * judge progress reports, weekly stats, GDPR retention cleanup).
 *
 * Production scheduling is via Vercel Cron (see vercel.json's `crons` array),
 * which invokes `runDailyAutomation()` once per day through
 * `api/judge-automation.js`'s `cron-tick` action (this file lives in
 * `api/_lib/`, which Vercel does not route HTTP traffic to directly — see
 * DEPLOYMENT-GUIDE.md's Automation section for the full explanation).
 *
 * This file previously registered its own schedule via `node-cron`, which
 * never actually ran in production: node-cron needs a long-lived process to
 * keep its in-memory timers alive, and Vercel serverless functions are
 * spun up per-request with no persistent process between invocations. That
 * approach has been removed in favour of the Vercel Cron + runDailyAutomation
 * design above — see RELEASE-REPORT-V1.md for the history of this finding.
 */

const { sendDeadlineReminders, sendWinnerAnnouncements, sendTemplateEmail } = require('../email-automation');
const { assignJudgesToEntries, generateAllShortlists } = require('../judge-automation');
const { generateAllWinnerCertificates } = require('../certificates-qr');

// Supabase client for scheduler queries
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

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
 * Check the nearest active judging deadline and generate shortlists once it's
 * reached. Uses <= 0 (not === 0) so a missed day — e.g. this check's first
 * run happens after the deadline already passed — still generates shortlists
 * rather than silently never firing. Safe to call more than once: shortlist
 * generation only touches entries with status 'submitted', so entries
 * already shortlisted by an earlier run are skipped automatically.
 * @returns {Promise<{deadlineFound: boolean, daysUntilDeadline?: number, shortlistsGenerated?: boolean}>}
 */
async function runJudgingDeadlineCheck() {
  const judgingDeadline = await getJudgingDeadline();
  if (!judgingDeadline) {
    console.log('runJudgingDeadlineCheck: no active judging deadline found');
    return { deadlineFound: false };
  }

  const now = new Date();
  const daysUntilDeadline = Math.ceil((Number(judgingDeadline) - Number(now)) / (1000 * 60 * 60 * 24));

  if (daysUntilDeadline <= 7 && daysUntilDeadline > 0) {
    console.log(`runJudgingDeadlineCheck: judging deadline in ${daysUntilDeadline} day(s)`);
  }

  if (daysUntilDeadline <= 0) {
    console.log('runJudgingDeadlineCheck: deadline reached — generating shortlists');
    await generateAllShortlists();
    return { deadlineFound: true, daysUntilDeadline, shortlistsGenerated: true };
  }

  return { deadlineFound: true, daysUntilDeadline, shortlistsGenerated: false };
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
 * GDPR Article 5(1)(e) retention cleanup.
 * Deletes personal data older than configured retention periods.
 * Runs automatically via weekly cron and can be triggered manually.
 * @returns {Promise<{deleted: Object}>} Count of deleted records per table.
 */
async function runRetentionCleanup() {
  const now = new Date();
  const deleted = {};

  function cutoff(years) {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - years);
    return d.toISOString();
  }

  // Audit logs: 2 years
  const { data: auditDeleted } = await supabase
    .from('cms_audit_logs')
    .delete()
    .lt('created_at', cutoff(2))
    .select('id');
  deleted.cms_audit_logs = auditDeleted?.length || 0;

  // Email logs: 1 year
  const { data: emailDeleted } = await supabase
    .from('notification_queue')
    .delete()
    .lt('created_at', cutoff(1))
    .eq('status', 'sent')
    .select('id');
  deleted.notification_queue = emailDeleted?.length || 0;

  // Public vote records: 1 year
  const { data: votesDeleted } = await supabase.from('public_votes').delete().lt('created_at', cutoff(1)).select('id');
  deleted.public_votes = votesDeleted?.length || 0;

  // Event guests: 3 years after event (approximate: 3 years from created_at)
  const { data: guestsDeleted } = await supabase.from('event_guests').delete().lt('created_at', cutoff(3)).select('id');
  deleted.event_guests = guestsDeleted?.length || 0;

  const totalDeleted = Object.values(deleted).reduce((a, b) => a + b, 0);
  console.log(`[retention-cleanup] Deleted ${totalDeleted} records:`, deleted);

  await supabase.from('cms_audit_logs').insert({
    action: 'retention_cleanup',
    entity_type: 'system',
    details: JSON.stringify({ deleted }),
    performed_by: 'automation-scheduler',
  });

  return { deleted };
}

/**
 * Run the full daily automation tick. This is the real production entry
 * point, invoked once per day by Vercel Cron via
 * api/judge-automation.js's `cron-tick` action (see that file and
 * DEPLOYMENT-GUIDE.md's Automation section for the full wiring).
 *
 * Consolidates what used to be 5 separate node-cron schedules — which never
 * actually ran on Vercel — into a single entry point that fits Vercel's
 * Hobby-plan "at most once per day" cron limit, using the current day of
 * week (Europe/London) to preserve the original weekly/Sunday cadence for
 * tasks that don't need to run every day.
 *
 * Reliability: each sub-task runs independently — one failing task (e.g. an
 * email provider hiccup) is caught and logged without preventing the rest
 * from running.
 *
 * Idempotency / retry-safety: every sub-task's own domain logic already
 * de-dupes against database state before sending anything (see
 * checkDeadlineReminders' and sendPaymentReminders' "already sent" checks,
 * dispatchScheduledCampaigns' immediate status flip to 'Sending', and
 * runJudgingDeadlineCheck's status-filtered shortlist generation) — so
 * invoking this function more than once on the same day (a manual
 * re-trigger, or Vercel retrying a slow/failed invocation) is safe and will
 * not double-send anything.
 *
 * Observability: every sub-task and the overall run logs to
 * console.log/console.error, which lands in Vercel's function logs (see
 * MONITORING.md).
 *
 * @returns {Promise<{startedAt: string, finishedAt: string, dayOfWeek: number, tasksRun: string[], results: Object}>}
 *   A structured summary of every task attempted and its outcome.
 */
async function runDailyAutomation() {
  const startedAt = new Date();
  // Compute the current day of week in Europe/London so the weekly/Sunday
  // tasks below fire on the intended local day regardless of the server's
  // own timezone (Vercel Cron schedules are always evaluated in UTC).
  const londonNow = new Date(startedAt.toLocaleString('en-US', { timeZone: 'Europe/London' }));
  const dayOfWeek = londonNow.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday

  const results = {};

  const run = async (key, fn) => {
    const taskStart = Date.now();
    try {
      const value = await fn();
      results[key] = {
        status: 'ok',
        durationMs: Date.now() - taskStart,
        ...(value !== undefined ? { result: value } : {}),
      };
    } catch (error) {
      results[key] = { status: 'error', durationMs: Date.now() - taskStart, error: error.message };
      console.error(`[automation] task "${key}" failed:`, error);
    }
  };

  // Daily tasks — every invocation
  await run('entryDeadlineReminders', () => sendDeadlineReminders());
  await run('deadlineReminders', () => checkDeadlineReminders());
  await run('paymentReminders', () => sendPaymentReminders());
  await run('scheduledCampaigns', () => dispatchScheduledCampaigns());
  await run('judgingDeadlineCheck', () => runJudgingDeadlineCheck());

  // Weekly tasks — Monday only (Europe/London), matches the original 8am
  // Monday node-cron schedule's intent
  if (dayOfWeek === 1) {
    await run('judgeProgressReports', () => sendJudgeProgressReports());
    await run('weeklyStats', () => generateWeeklyStats());
  }

  // GDPR retention cleanup — Sunday only (Europe/London), matches the
  // original weekly cleanup schedule's intent
  if (dayOfWeek === 0) {
    await run('retentionCleanup', () => runRetentionCleanup());
  }

  const summary = {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    dayOfWeek,
    tasksRun: Object.keys(results),
    results,
  };

  console.log('[automation] daily tick complete:', JSON.stringify(summary));
  return summary;
}

// This module exports plain business-logic functions only — no HTTP handler.
// The one real HTTP entry point for automation is api/judge-automation.js's
// `cron-tick` action, which requires runDailyAutomation directly. (An
// earlier version of this file also exported its own (req, res) handler
// switch, but nothing ever routed HTTP traffic to it — this file lives in
// api/_lib/, which Vercel does not deploy as a function — so it was dead
// code and has been removed.)
module.exports = {
  runDailyAutomation,
  runJudgingDeadlineCheck,
  checkDeadlineReminders,
  getJudgingDeadline,
  triggerWinnerAnnouncements,
  triggerJudgeAssignments,
  triggerShortlistGeneration,
  sendPaymentReminders,
  sendJudgeProgressReports,
  generateWeeklyStats,
  dispatchScheduledCampaigns,
  runRetentionCleanup,
};

// Run one full daily tick when this file is executed directly — useful for
// local manual testing (`node api/_lib/automation-scheduler.js`) without
// needing to simulate a Vercel Cron HTTP request.
if (require.main === module) {
  runDailyAutomation()
    .then((summary) => {
      console.log('Manual run complete:', JSON.stringify(summary, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('Manual run failed:', error);
      process.exit(1);
    });
}
