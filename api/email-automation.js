/**
 * @module email-automation
 * Email Automation and Workflow Engine.
 *
 * Features:
 * - Trigger-based email workflows
 * - Template-based emails
 * - Scheduled email campaigns
 * - Deadline reminders
 * - Automated winner announcements
 * - Email queueing and retry logic
 */

const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const { wrapEmail } = require('./_lib/email-header');
const { assertEnv } = require('./_lib/env');

assertEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'RESEND_API_KEY']);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { verifyAuth } = require('./_lib/auth');
const crypto = require('crypto');

// Initialize Resend (replacing SendGrid)
const resend = new Resend(process.env.RESEND_API_KEY);

/** @type {Map<string, {data: Object, time: number} | Promise<Object>>} */
const _brandingCacheMap = new Map();
const BRANDING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load tenant branding from database (cached per tenant with promise-coalescing).
 * Concurrent callers before the first fetch resolves will all receive the same promise,
 * preventing duplicate DB queries on a traffic surge.
 * @param {string} [tenantId='default'] - The tenant identifier.
 * @returns {Promise<Object>} Branding configuration object.
 */
async function loadTenantBranding(tenantId = 'default') {
  const now = Date.now();
  const cached = _brandingCacheMap.get(tenantId);

  // Return resolved cache if still fresh
  if (cached && !(cached instanceof Promise) && now - cached.time < BRANDING_CACHE_TTL) {
    return cached.data;
  }

  // Return in-flight promise (promise-coalescing: concurrent callers share one DB query)
  if (cached instanceof Promise) return cached;

  const fetchPromise = supabase
    .from('tenant_branding')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()
    .then(({ data }) => {
      const branding = data || {};
      _brandingCacheMap.set(tenantId, { data: branding, time: Date.now() });
      return branding;
    })
    .catch((e) => {
      console.error('Failed to load tenant branding:', e);
      _brandingCacheMap.delete(tenantId);
      // Return stale data if available
      return (cached && !(cached instanceof Promise) ? cached.data : null) || {};
    });

  _brandingCacheMap.set(tenantId, fetchPromise);
  return fetchPromise;
}

/**
 * Map template keys to header subtitle text.
 * These subtitles appear in the email header below the brand name.
 */
const HEADER_SUBTITLES = {
  ENTRY_CONFIRMATION: 'Self-Nomination Entry Confirmation',
  NOMINATION_CONFIRMATION: 'Nomination Confirmation',
  PAYMENT_REMINDER: 'Payment Reminder',
  SHORTLIST_NOTIFICATION: 'Entry Approved/Shortlisted',
  WINNER_ANNOUNCEMENT: 'Entry Approved',
  JUDGE_ASSIGNMENT: 'Judging Assignment',
  JUDGE_REMINDER: 'Judging Reminder',
  DEADLINE_REMINDER: 'Document Upload Reminder',
  REVISION_REQUEST: 'Action Required',
  REJECTION: 'Entry Update',
  EVENT_INVITATION: 'Event Invitation',
  TICKET_ISSUED: 'Ticket Issued',
  GENERAL: 'Notification',
  NOTIFICATION: 'Notification',
  INVITE: 'Invitation',
};

/**
 * Email wrapper - delegates to shared email-header.js module.
 * Header/footer are built from branding; subtitle and preheader change per email type.
 * @param {string} bodyContent - The HTML body content to wrap.
 * @param {Object} [branding={}] - Tenant branding configuration.
 * @param {string} [subtitle=''] - Subtitle text for the email header.
 * @param {string} [preheader=''] - Hidden preview text shown in email client inboxes.
 * @returns {string} Complete branded HTML email document.
 */
function wrapEmailTemplate(bodyContent, branding = {}, subtitle = '', preheader = '') {
  return wrapEmail(bodyContent, branding, { subtitle, preheader });
}

const { EMAIL_TEMPLATES, DB_TEMPLATE_TYPE_MAP } = require('./_lib/email-templates');

/**
 * Strip HTML tags and decode common entities to produce a plain-text fallback.
 * @param {string} html
 * @returns {string}
 */
function stripHtmlToText(html) {
  return String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Load an active email template from the database by type.
 * @param {string} templateType - The template type identifier (e.g. 'confirmation', 'winner_announcement').
 * @returns {Promise<{subject: string, body: string}|null>} Template data or null if none found.
 */
async function loadDbTemplate(templateType) {
  try {
    const { data } = await supabase
      .from('email_templates')
      .select('subject, body')
      .eq('template_type', templateType)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1)
      .single();
    return data;
  } catch {
    return null;
  }
}

/**
 * Convert plain-text template body (from CMS) to styled HTML with paragraph wrapping.
 * @param {string} text - Plain text content to convert.
 * @returns {string} HTML string with paragraphs and line breaks.
 */

/**
 * Send email using template with tenant branding.
 * Tries to load the editable template from the CMS database first;
 * falls back to the hardcoded EMAIL_TEMPLATES if no DB row is found.
 *
 * DB templates use {PLACEHOLDER} syntax (single braces, uppercase).
 * Hardcoded templates use {{placeholder}} syntax (double braces, lowercase).
 * @param {string} templateKey - The template key (e.g. 'ENTRY_CONFIRMATION', 'WINNER_ANNOUNCEMENT').
 * @param {string} toEmail - The recipient email address.
 * @param {Object} variables - Key-value pairs for template placeholder replacement.
 * @param {Object} [options] - Additional options.
 * @param {string} [options.tenantId='default'] - Tenant identifier for branding isolation.
 * @returns {Promise<boolean>} True if the email was sent successfully, false otherwise.
 */
async function sendTemplateEmail(templateKey, toEmail, variables, { tenantId = 'default' } = {}) {
  try {
    // Load tenant branding
    const branding = await loadTenantBranding(tenantId);
    const brandName = branding.company_name || process.env.FROM_NAME || 'British Trade Awards';

    const subtitle = HEADER_SUBTITLES[templateKey] || '';

    const escapeHtml = (str) =>
      String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    // --- Try database template first ---
    const dbType = DB_TEMPLATE_TYPE_MAP[templateKey];
    const dbTpl = dbType ? await loadDbTemplate(dbType) : null;

    if (dbTpl) {
      // DB templates use {KEY} placeholders (uppercase, single brace)
      // Map common variable names to uppercase placeholder keys
      const upperVars = {};
      for (const [k, v] of Object.entries(variables || {})) {
        upperVars[k.toUpperCase()] = v || '';
      }
      upperVars.BRAND_NAME = brandName;

      let subject = dbTpl.subject;
      // Escape static HTML chars in the body template first. {KEY} placeholders survive
      // because curly braces are not HTML special characters. Then each user-supplied
      // value is also HTML-escaped before insertion, preventing XSS injection.
      let escapedBody = escapeHtml(dbTpl.body);
      for (const [key, value] of Object.entries(upperVars)) {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        subject = subject.replace(regex, String(value ?? ''));
        escapedBody = escapedBody.replace(regex, escapeHtml(String(value ?? '')));
      }
      const bodyHtml = `<div style="padding:30px 40px;"><p style="margin:0 0 16px 0;">${escapedBody
        .replace(/\n\n/g, '</p><p style="margin:0 0 16px 0;">')
        .replace(/\n/g, '<br>')}</p></div>`;
      const html = wrapEmailTemplate(bodyHtml, branding, subtitle, subtitle);

      const fromEmail = branding.email_from || process.env.FROM_EMAIL || 'awards@britishtradeawards.com';
      await resend.emails.send({
        to: toEmail,
        from: `${brandName} <${fromEmail}>`,
        subject,
        html,
        text: stripHtmlToText(html),
        ...(branding.email_reply_to ? { reply_to: branding.email_reply_to } : {}),
      });

      await logEmailSent(templateKey, toEmail, subject);
      console.log(`✅ Email sent (DB template): ${templateKey} to ${toEmail}`);
      return true;
    }

    // --- Fallback: hardcoded template ---
    const template = EMAIL_TEMPLATES[templateKey];
    if (!template) {
      throw new Error(`Template ${templateKey} not found`);
    }

    const appUrl = process.env.APP_URL || '';
    const allVariables = {
      brand_name: brandName,
      support_email: process.env.FROM_EMAIL || '',
      unsubscribe_link: appUrl ? `${appUrl}/unsubscribe` : '',
      ...variables,
    };

    let subject = template.subject;
    let bodyContent = template.body;

    for (const [key, value] of Object.entries(allVariables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value || '');
      bodyContent = bodyContent.replace(regex, escapeHtml(value || ''));
    }

    const html = wrapEmailTemplate(bodyContent, branding, subtitle, template.preheader || '');

    const fromEmail = branding.email_from || process.env.FROM_EMAIL || 'awards@britishtradeawards.com';
    await resend.emails.send({
      to: toEmail,
      from: `${brandName} <${fromEmail}>`,
      subject,
      html,
      text: stripHtmlToText(html),
      ...(branding.email_reply_to ? { reply_to: branding.email_reply_to } : {}),
    });

    await logEmailSent(templateKey, toEmail, subject);
    console.log(`✅ Email sent (hardcoded fallback): ${templateKey} to ${toEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ Error sending email:`, error);
    await logEmailFailure(templateKey, toEmail, error.message);
    return false;
  }
}

/**
 * Send entry confirmation email for a submitted entry.
 * @param {string} entryId - The ID of the entry to confirm.
 * @returns {Promise<boolean>} True if the email was sent successfully, false otherwise.
 */
async function sendEntryConfirmation(entryId) {
  try {
    const { data: entry } = await supabase
      .from('entries')
      .select('*, organisations(*), awards:award_years(*)')
      .eq('id', entryId)
      .single();

    if (!entry) throw new Error('Entry not found');

    // Fetch key dates from the award season
    const awardSeason = entry.awards || {};
    const formatDate = (d) =>
      d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'TBC';

    const variables = {
      contact_name: entry.contact_name,
      entry_number: entry.entry_number,
      company_name: entry.organisations?.company_name || '',
      award_name: entry.awards?.award_name || 'British Trade Awards',
      entry_title: entry.entry_title,
      judging_start: formatDate(awardSeason.judging_start_date),
      judging_end: formatDate(awardSeason.judging_end_date),
      shortlist_date: formatDate(awardSeason.shortlist_date),
      winner_date: formatDate(awardSeason.winner_announcement_date),
    };

    return await sendTemplateEmail('ENTRY_CONFIRMATION', entry.contact_email, variables);
  } catch (error) {
    console.error('Error sending entry confirmation:', error);
    return false;
  }
}

/**
 * Send nomination confirmation email.
 * @param {string} toEmail - Nominator's email address.
 * @param {Object} variables - Template variables (contact_name, nominee_name, award_name, entry_number, region).
 * @returns {Promise<boolean>} True if the email was sent successfully, false otherwise.
 */
async function sendNominationConfirmation(toEmail, variables) {
  try {
    return await sendTemplateEmail('NOMINATION_CONFIRMATION', toEmail, variables);
  } catch (error) {
    console.error('Error sending nomination confirmation:', error);
    return false;
  }
}

/**
 * Send revision request email when an entry needs changes.
 * @param {string} toEmail - Entrant's email address.
 * @param {Object} variables - Template variables (contact_name, entry_title, entry_number, feedback, action_link).
 * @returns {Promise<boolean>} True if the email was sent successfully.
 */
async function sendRevisionRequest(toEmail, variables) {
  try {
    return await sendTemplateEmail('REVISION_REQUEST', toEmail, variables);
  } catch (error) {
    console.error('Error sending revision request:', error);
    return false;
  }
}

/**
 * Send rejection/not-shortlisted email.
 * @param {string} toEmail - Entrant's email address.
 * @param {Object} variables - Template variables (contact_name, company_name, award_name, entry_number).
 * @returns {Promise<boolean>} True if the email was sent successfully.
 */
async function sendRejection(toEmail, variables) {
  try {
    return await sendTemplateEmail('REJECTION', toEmail, variables);
  } catch (error) {
    console.error('Error sending rejection email:', error);
    return false;
  }
}

/**
 * Send event invitation email.
 * @param {string} toEmail - Invitee's email address.
 * @param {Object} variables - Template variables (contact_name, event_name, event_date, venue, rsvp_link).
 * @returns {Promise<boolean>} True if the email was sent successfully.
 */
async function sendEventInvitation(toEmail, variables) {
  try {
    return await sendTemplateEmail('EVENT_INVITATION', toEmail, variables);
  } catch (error) {
    console.error('Error sending event invitation:', error);
    return false;
  }
}

/**
 * Send ticket issued email.
 * @param {string} toEmail - Attendee's email address.
 * @param {Object} variables - Template variables (contact_name, event_name, event_date, venue, ticket_number).
 * @returns {Promise<boolean>} True if the email was sent successfully.
 */
async function sendTicketIssued(toEmail, variables) {
  try {
    return await sendTemplateEmail('TICKET_ISSUED', toEmail, variables);
  } catch (error) {
    console.error('Error sending ticket issued email:', error);
    return false;
  }
}

/**
 * Send a general-purpose email.
 * @param {string} toEmail - Recipient's email address.
 * @param {Object} variables - Template variables (recipient_name, subject_line, message_body).
 * @returns {Promise<boolean>} True if the email was sent successfully.
 */
async function sendGeneral(toEmail, variables) {
  try {
    return await sendTemplateEmail('GENERAL', toEmail, variables);
  } catch (error) {
    console.error('Error sending general email:', error);
    return false;
  }
}

/**
 * Send a system notification email.
 * @param {string} toEmail - Recipient's email address.
 * @param {Object} variables - Template variables (recipient_name, subject_line, message_body).
 * @returns {Promise<boolean>} True if the email was sent successfully.
 */
async function sendNotification(toEmail, variables) {
  try {
    return await sendTemplateEmail('NOTIFICATION', toEmail, variables);
  } catch (error) {
    console.error('Error sending notification email:', error);
    return false;
  }
}

/**
 * Send an invitation email.
 * @param {string} toEmail - Invitee's email address.
 * @param {Object} variables - Template variables (recipient_name, subject_line, message_body, action_link, action_button_text).
 * @returns {Promise<boolean>} True if the email was sent successfully.
 */
async function sendInvite(toEmail, variables) {
  try {
    return await sendTemplateEmail('INVITE', toEmail, variables);
  } catch (error) {
    console.error('Error sending invite email:', error);
    return false;
  }
}

/**
 * Send deadline reminders to judges with pending scoring assignments.
 * @returns {Promise<boolean>} True if reminders were sent successfully, false otherwise.
 */
async function sendDeadlineReminders() {
  try {
    console.log('📧 Sending deadline reminders...');

    const now = new Date();
    const reminders = [7, 3, 1]; // Days before deadline

    // Entry submission deadline reminders
    for (const daysLeft of reminders) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + daysLeft);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      // Find award seasons closing on this target date
      const { data: closingSeasons } = await supabase
        .from('award_years')
        .select('id, name, entry_close_date')
        .eq('entry_close_date', targetDateStr);

      if (!closingSeasons || closingSeasons.length === 0) continue;

      for (const season of closingSeasons) {
        // Get draft entries for this season to remind them to submit
        const { data: draftEntries } = await supabase
          .from('entries')
          .select('id, contact_name, contact_email, organisations(company_name)')
          .eq('award_id', season.id)
          .eq('status', 'draft');

        // Send in batches of 5 (avoid sequential sends timing out Vercel)
        const ENTRY_BATCH = 5;
        for (let i = 0; i < (draftEntries || []).length; i += ENTRY_BATCH) {
          await Promise.all(
            (draftEntries || []).slice(i, i + ENTRY_BATCH).map((entry) => {
              const variables = {
                contact_name: entry.contact_name,
                company_name: /** @type {any} */ (entry.organisations)?.company_name || '',
                award_name: season.name,
                days_left: String(daysLeft),
                deadline: season.entry_close_date,
                submit_link: `${process.env.APP_URL || 'https://admin.britishtradeawards.com'}/submit-entry.html`,
              };
              return sendTemplateEmail('ENTRY_DEADLINE_REMINDER', entry.contact_email, variables);
            })
          );
        }
      }
    }

    // Judging deadline reminders — batch-fetch all scores + deadline once to avoid N+1
    const { data: judges } = await supabase
      .from('contacts')
      .select('id, full_name, email')
      .eq('contact_type', 'judge')
      .limit(1000);

    const { data: allJudgeScores } = await supabase.from('judge_scores').select('judge_email, judge_id, is_complete');

    const { data: activeAwards } = await supabase
      .from('award_years')
      .select('judging_end_date')
      .eq('is_active', true)
      .not('judging_end_date', 'is', null)
      .order('judging_end_date', { ascending: true })
      .limit(1);
    const judgingDeadline = activeAwards?.[0]?.judging_end_date;
    const daysLeft = judgingDeadline
      ? Math.max(0, Math.ceil((new Date(judgingDeadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;
    const formatDate = (d) =>
      d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'TBC';

    const judgeReminderPromises = (judges || []).map(async (judge) => {
      const scores = (allJudgeScores || []).filter((s) => s.judge_email === judge.email || s.judge_id === judge.id);
      const totalAssigned = scores.length;
      const completed = scores.filter((s) => s.is_complete).length;
      const pending = totalAssigned - completed;

      if (pending > 0) {
        const variables = {
          judge_name: judge.full_name,
          days_left: daysLeft !== null ? String(daysLeft) : 'TBC',
          deadline: formatDate(judgingDeadline),
          scored_count: completed,
          total_count: totalAssigned,
          pending_count: pending,
          judge_portal_link: `${process.env.APP_URL || 'https://admin.britishtradeawards.com'}/judge-portal.html`,
        };
        return sendTemplateEmail('JUDGE_REMINDER', judge.email, variables);
      }
    });

    // Send in batches of 5 to avoid overwhelming Resend
    const BATCH = 5;
    for (let i = 0; i < judgeReminderPromises.length; i += BATCH) {
      await Promise.all(judgeReminderPromises.slice(i, i + BATCH));
    }

    console.log('✅ Deadline reminders sent');
    return true;
  } catch (error) {
    console.error('Error sending deadline reminders:', error);
    return false;
  }
}

/**
 * Send judge assignment notification email with the list of entries to judge.
 * @param {string} judgeEmail - The email address of the judge.
 * @param {string[]} entryIds - Array of entry IDs assigned to the judge.
 * @returns {Promise<boolean>} True if the email was sent successfully, false otherwise.
 */
async function sendJudgeAssignments(judgeEmail, entryIds) {
  try {
    const { data: judge } = await supabase.from('contacts').select('*').eq('email', judgeEmail).single();

    if (!judge) throw new Error('Judge not found');

    // Get award names
    const { data: entries } = await supabase
      .from('entries')
      .select('*, awards:award_years(award_name)')
      .in('id', entryIds);

    const awardList = [...new Set(entries.map((e) => e.awards.award_name))].map((name) => `<li>${name}</li>`).join('');

    // Get judging deadline from the associated award season
    const awardIds = [...new Set(entries.map((e) => e.award_id).filter(Boolean))];
    let judgingDeadline = 'TBC';
    if (awardIds.length > 0) {
      const { data: awardData } = await supabase
        .from('award_years')
        .select('judging_end_date')
        .in('id', awardIds)
        .not('judging_end_date', 'is', null)
        .order('judging_end_date', { ascending: true })
        .limit(1);
      if (awardData?.[0]?.judging_end_date) {
        judgingDeadline = new Date(awardData[0].judging_end_date).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      }
    }

    const variables = {
      judge_name: judge.full_name || judge.email,
      entry_count: entryIds.length,
      deadline: judgingDeadline,
      award_list: awardList,
      judge_portal_link: `${process.env.APP_URL || 'https://admin.britishtradeawards.com'}/judge-portal.html`,
    };

    return await sendTemplateEmail('JUDGE_ASSIGNMENT', judgeEmail, variables);
  } catch (error) {
    console.error('Error sending judge assignment:', error);
    return false;
  }
}

/**
 * Send winner announcement emails to all entries with 'winner' status.
 * @param {string|null} [awardId=null] - Optional award ID to filter announcements to a specific award.
 * @returns {Promise<number>} The number of winner announcements sent.
 */
async function sendWinnerAnnouncements(awardId = null) {
  try {
    console.log('🏆 Sending winner announcements...');

    let query = supabase.from('entries').select('*, organisations(*), awards:award_years(*)').eq('status', 'winner');

    if (awardId) {
      query = query.eq('award_id', awardId);
    }

    const { data: winners } = await query;

    // Fetch upcoming ceremony event details
    const { data: ceremonyEvent } = await supabase
      .from('events')
      .select('event_date, venue, name')
      .ilike('name', '%ceremony%')
      .order('event_date', { ascending: false })
      .limit(1);
    const ceremony = ceremonyEvent?.[0];
    const formatDate = (d) =>
      d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'TBC';

    // Send in batches of 5 to avoid overwhelming Resend within Vercel's 30s timeout
    const CONCURRENT_SENDS = 5;
    let totalSent = 0;
    const winnerList = winners || [];

    for (let i = 0; i < winnerList.length; i += CONCURRENT_SENDS) {
      const batch = winnerList.slice(i, i + CONCURRENT_SENDS);
      const results = await Promise.all(
        batch.map(async (winner) => {
          const variables = {
            contact_name: winner.contact_name,
            company_name: winner.organisations?.company_name || '',
            award_name: winner.awards?.award_name || '',
            ceremony_date: formatDate(ceremony?.event_date),
            ceremony_venue: ceremony?.venue || 'TBC',
            winners_portal_link: `${process.env.APP_URL || 'https://admin.britishtradeawards.com'}/winners-portal.html`,
          };
          return sendTemplateEmail('WINNER_ANNOUNCEMENT', winner.contact_email, variables);
        })
      );
      totalSent += results.filter(Boolean).length;

      // Queue social media posts in bulk (non-blocking fire-and-forget)
      const socialInserts = batch.map((winner) => ({
        content: `Congratulations to ${winner.organisations?.company_name || winner.contact_name} for winning ${winner.awards?.award_name || 'a British Trade Award'}! 🏆 #BritishTradeAwards #Winners`,
        platforms: ['twitter', 'linkedin', 'facebook'],
        status: 'scheduled',
        scheduled_for: new Date().toISOString(),
        post_type: 'winner_announcement',
      }));
      (async () => {
        try {
          const { data: posts } = await supabase.from('social_media_posts').insert(socialInserts).select('id');
          if (posts && posts.length > 0) {
            const { publishToSocialMedia } = require('./social-media-api');
            posts.forEach((p) => publishToSocialMedia(p.id).catch(() => {}));
          }
        } catch (err) {
          console.error('Social media queue failed (non-blocking):', err.message);
        }
      })();
    }

    console.log(`✅ Sent ${totalSent} winner announcements`);
    return totalSent;
  } catch (error) {
    console.error('Error sending winner announcements:', error);
    return 0;
  }
}

/**
 * Send shortlist notification emails to all shortlisted entries.
 * @param {string|null} [awardId=null] - Optional award ID to filter to a specific award.
 * @returns {Promise<number>} The number of shortlist notifications sent.
 */
async function sendShortlistNotifications(awardId = null) {
  try {
    console.log('🌟 Sending shortlist notifications...');

    let query = supabase
      .from('entries')
      .select('*, organisations(*), awards:award_years(*)')
      .eq('is_shortlisted', true);

    if (awardId) {
      query = query.eq('award_id', awardId);
    }

    const { data: shortlisted } = await query;
    if (!shortlisted || shortlisted.length === 0) {
      console.log('No shortlisted entries to notify');
      return 0;
    }

    // Fetch upcoming ceremony event and award season details
    const { data: ceremonyEvent } = await supabase
      .from('events')
      .select('event_date, venue, name')
      .ilike('name', '%ceremony%')
      .order('event_date', { ascending: false })
      .limit(1);
    const ceremony = ceremonyEvent?.[0];
    const formatDate = (d) =>
      d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'TBC';

    // Get winner announcement date from the active award season
    const { data: activeSeason } = await supabase
      .from('award_years')
      .select('winner_announcement_date')
      .eq('is_active', true)
      .not('winner_announcement_date', 'is', null)
      .limit(1);

    for (const entry of shortlisted || []) {
      const variables = {
        contact_name: entry.contact_name,
        company_name: entry.organisations?.company_name || '',
        award_name: entry.awards?.award_name || 'British Trade Awards',
        winner_date: formatDate(activeSeason?.[0]?.winner_announcement_date),
        ceremony_date: formatDate(ceremony?.event_date),
        ceremony_venue: ceremony?.venue || 'TBC',
        ceremony_tickets_link: `${process.env.APP_URL || 'https://admin.britishtradeawards.com'}/tickets`,
      };

      await sendTemplateEmail('SHORTLIST_NOTIFICATION', entry.contact_email, variables);
    }

    console.log(`✅ Sent ${shortlisted.length} shortlist notifications`);
    return shortlisted.length;
  } catch (error) {
    console.error('Error sending shortlist notifications:', error);
    return 0;
  }
}

/**
 * Log a successfully sent email to the email_log table.
 * @param {string} templateKey - The template key used for the email.
 * @param {string} toEmail - The recipient email address.
 * @param {string} subject - The email subject line.
 * @returns {Promise<void>}
 */
async function logEmailSent(templateKey, toEmail, subject, tenantId = 'default') {
  await supabase.from('email_log').insert([
    {
      template_key: templateKey,
      recipient_email: toEmail,
      subject: subject,
      status: 'sent',
      sent_at: new Date().toISOString(),
      ...(tenantId !== 'default' ? { tenant_id: tenantId } : {}),
    },
  ]);
}

/**
 * Log a failed email send attempt to the email_log table.
 * @param {string} templateKey - The template key used for the email.
 * @param {string} toEmail - The intended recipient email address.
 * @param {string} error - The error message describing the failure.
 * @returns {Promise<void>}
 */
async function logEmailFailure(templateKey, toEmail, error, tenantId = 'default') {
  await supabase.from('email_log').insert([
    {
      template_key: templateKey,
      recipient_email: toEmail,
      status: 'failed',
      error_message: error,
      sent_at: new Date().toISOString(),
      ...(tenantId !== 'default' ? { tenant_id: tenantId } : {}),
    },
  ]);
}

/**
 * API endpoint to send a template email (requires authentication).
 * POST /api/send-email
 * @param {Object} req - Express request object with body containing templateKey, toEmail, variables.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
async function sendEmailEndpoint(req, res) {
  try {
    // Auth is verified at the handler level

    const { templateKey, toEmail, variables } = req.body;
    if (!templateKey || !toEmail) {
      return res.status(400).json({ error: 'Missing templateKey or toEmail' });
    }
    const result = await sendTemplateEmail(templateKey, toEmail, variables);
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// POST /api/send-deadline-reminders
async function sendDeadlineRemindersEndpoint(req, res) {
  try {
    const result = await sendDeadlineReminders();
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// POST /api/send-winner-announcements
async function sendWinnerAnnouncementsEndpoint(req, res) {
  try {
    const { awardId } = req.body;
    const count = await sendWinnerAnnouncements(awardId);
    res.json({ success: true, sent: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Vercel serverless handler — routes by query action.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = req.query.action || req.body?.action;

  // Resend webhook actions bypass JWT auth — verified via shared secret instead
  if (action === 'resend-bounce' || action === 'resend-complaint') {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers['x-resend-signature'] || '';
      const payload = JSON.stringify(req.body);
      const expected = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }
    return handleResendSuppressionEvent(req, res);
  }

  // All other actions require JWT authentication
  const user = await verifyAuth(req, res);
  if (!user) return;

  switch (action) {
    case 'send-email':
      return sendEmailEndpoint(req, res);
    case 'send-template':
    case 'sendTemplate': {
      const { templateKey, toEmail, toName, subject: customSubject, html: customHtml, variables } = req.body;
      if (!templateKey || !toEmail) {
        return res.status(400).json({ error: 'Missing templateKey or toEmail' });
      }
      const vars = variables || {};
      if (toName) vars.contact_name = vars.contact_name || toName;
      if (customSubject) vars.subject_line = vars.subject_line || customSubject;
      if (customHtml) vars.message_body = vars.message_body || customHtml;
      const result = await sendTemplateEmail(templateKey, toEmail, vars);
      return res.json({ success: result });
    }
    case 'send-deadline-reminders':
      return sendDeadlineRemindersEndpoint(req, res);
    case 'send-winner-announcements':
      return sendWinnerAnnouncementsEndpoint(req, res);
    default:
      return res.status(400).json({ error: `Unknown action: ${action || 'none'}` });
  }
};

/**
 * Handle Resend bounce/complaint webhook events.
 * Adds the affected address to the email_suppressions table.
 * @param {Object} req - Request object.
 * @param {Object} res - Response object.
 * @returns {Promise<void>}
 */
async function handleResendSuppressionEvent(req, res) {
  const { action, email, reason } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });

  const suppressionReason = action === 'resend-complaint' ? 'spam_complaint' : 'bounce';
  const detail = reason || action;

  try {
    await supabase
      .from('email_suppressions')
      .upsert({ email, reason: suppressionReason, detail }, { onConflict: 'email' });
    console.log(`[email-automation] Suppressed ${email} (${suppressionReason})`);
    return res.status(200).json({ suppressed: email, reason: suppressionReason });
  } catch (err) {
    console.error('[email-automation] Failed to record suppression:', err.message);
    return res.status(500).json({ error: 'Failed to record suppression' });
  }
}

module.exports.sendTemplateEmail = sendTemplateEmail;
module.exports.sendEntryConfirmation = sendEntryConfirmation;
module.exports.sendNominationConfirmation = sendNominationConfirmation;
module.exports.sendRevisionRequest = sendRevisionRequest;
module.exports.sendRejection = sendRejection;
module.exports.sendEventInvitation = sendEventInvitation;
module.exports.sendTicketIssued = sendTicketIssued;
module.exports.sendGeneral = sendGeneral;
module.exports.sendNotification = sendNotification;
module.exports.sendInvite = sendInvite;
module.exports.sendDeadlineReminders = sendDeadlineReminders;
module.exports.sendJudgeAssignments = sendJudgeAssignments;
module.exports.sendWinnerAnnouncements = sendWinnerAnnouncements;
module.exports.sendShortlistNotifications = sendShortlistNotifications;
module.exports.sendEmailEndpoint = sendEmailEndpoint;
module.exports.sendDeadlineRemindersEndpoint = sendDeadlineRemindersEndpoint;
module.exports.sendWinnerAnnouncementsEndpoint = sendWinnerAnnouncementsEndpoint;
