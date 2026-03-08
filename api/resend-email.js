/**
 * @module resend-email
 * Resend.com Email Integration.
 * Replaces SendGrid - uses Resend for transactional
 * and campaign emails.
 */

const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');
const { wrapEmail } = require('./_lib/email-header');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || 'awards@britishtradeawards.com';
const FROM_NAME = process.env.FROM_NAME || 'British Trade Awards';

/**
 * Map template types to header subtitle text.
 * These subtitles appear in the email header below the brand name.
 */
const HEADER_SUBTITLES = {
  winner_notification: 'Entry Approved',
  event_invitation: 'Event Invitation',
  entry_confirmation: 'Self-Nomination Entry Confirmation',
  payment_reminder: 'Payment Reminder',
  shortlist_notification: 'Entry Approved/Shortlisted',
  judge_assignment: 'Judging Assignment',
  ticket_issued: 'Ticket Issued',
};

/**
 * Wrap email content in branded HTML template.
 * Header/footer are built from branding; subtitle changes per email type.
 * @param {string} subject - The email subject line.
 * @param {string} bodyHtml - The HTML body content to wrap.
 * @param {string} [preheader=''] - Hidden preheader text for email clients.
 * @param {Object} [branding={}] - Tenant branding configuration.
 * @param {string} [subtitle=''] - Subtitle text displayed in the email header.
 * @returns {string} Complete branded HTML email document.
 */
function wrapEmailTemplate(subject, bodyHtml, preheader = '', branding = {}, subtitle = '') {
  return wrapEmail(bodyHtml, branding, { subject, preheader, subtitle });
}

/**
 * Send a single email via Resend and log the result to the notification queue.
 * @param {Object} options - Email options.
 * @param {string|string[]} options.to - Recipient email address(es).
 * @param {string} options.subject - Email subject line.
 * @param {string} options.html - HTML body content.
 * @param {string} [options.text] - Plain text fallback body.
 * @param {string} [options.replyTo] - Reply-to email address.
 * @param {Array<{name: string, value: string}>} [options.tags] - Email tags for tracking.
 * @returns {Promise<{success: boolean, id?: string, error?: string}>} Send result.
 */
async function sendEmail({ to, subject, html, text, replyTo, tags }) {
  try {
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text: text || undefined,
      reply_to: replyTo || undefined,
      tags: tags || undefined,
    });

    if (error) throw error;

    // Log to database
    await supabase.from('notification_queue').insert({
      notification_type: 'email',
      recipient_email: Array.isArray(to) ? to.join(', ') : to,
      subject,
      status: 'sent',
      sent_at: new Date().toISOString(),
      template_data: { resend_id: data?.id },
    });

    return { success: true, id: data?.id };
  } catch (error) {
    console.error('Resend send error:', error);

    // Log failure
    await supabase.from('notification_queue').insert({
      notification_type: 'email',
      recipient_email: Array.isArray(to) ? to.join(', ') : to,
      subject,
      status: 'failed',
      last_error: error.message,
    });

    return { success: false, error: error.message };
  }
}

/**
 * Send a templated email (winner notification, invite, etc.).
 * @param {Object} options - Templated email options.
 * @param {string} options.to - Recipient email address.
 * @param {string} options.templateType - Template identifier (e.g. 'winner_notification', 'event_invitation').
 * @param {Object} options.data - Template variable data for placeholder replacement.
 * @returns {Promise<{success: boolean, id?: string, error?: string}>} Send result.
 */
async function sendTemplatedEmail({ to, templateType, data }) {
  // Escape user-provided values to prevent HTML injection in emails
  const esc = (str) =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const safeData = {};
  for (const [key, value] of Object.entries(data || {})) {
    safeData[key] = typeof value === 'string' ? esc(value) : value;
  }
  const d = safeData;
  const templates = {
    winner_notification: {
      subject: `Congratulations! ${d.company_name} wins ${d.award_category}`,
      body: `<h2>Congratulations!</h2>
        <p>We are delighted to inform you that <strong>${d.company_name}</strong> has been selected as the winner of the <strong>${d.award_category}</strong> award for ${d.year}.</p>
        <p>This prestigious award recognizes your outstanding achievements and contributions to your industry.</p>
        ${d.event_name ? `<h3>Event Details</h3><ul><li><strong>Event:</strong> ${d.event_name}</li><li><strong>Date:</strong> ${d.event_date}</li><li><strong>Venue:</strong> ${d.venue}</li></ul>` : ''}
        <p>We look forward to celebrating your success!</p>
        <a href="${data.confirm_url || '#'}" class="btn">Confirm Attendance</a>`,
    },
    event_invitation: {
      subject: `You're Invited: ${d.event_name}`,
      body: `<h2>You're Invited!</h2>
        <p>You are cordially invited to attend the <strong>${d.event_name}</strong>.</p>
        <ul><li><strong>Date:</strong> ${d.event_date}</li><li><strong>Venue:</strong> ${d.venue}</li></ul>
        <p>We would be honoured by your presence at this special occasion.</p>
        <a href="${data.rsvp_url || '#'}" class="btn">RSVP Now</a>`,
    },
    entry_confirmation: {
      subject: `Entry Received: ${d.award_category}`,
      body: `<h2>Entry Confirmed</h2>
        <p>Thank you for submitting your entry for the <strong>${d.award_category}</strong> award.</p>
        <p><strong>Entry Reference:</strong> ${d.entry_number || 'N/A'}</p>
        <p>Our team will review your submission. You will be notified of progress updates.</p>`,
    },
    payment_reminder: {
      subject: `Payment Reminder: Invoice ${d.invoice_number}`,
      body: `<h2>Payment Reminder</h2>
        <p>This is a reminder that invoice <strong>${d.invoice_number}</strong> for <strong>&pound;${d.amount}</strong> is due on <strong>${d.due_date}</strong>.</p>
        <a href="${data.payment_url || '#'}" class="btn">Pay Now</a>`,
    },
    shortlist_notification: {
      subject: `Congratulations! You've Been Shortlisted for ${d.award_category}`,
      body: `<h2>You've Been Shortlisted!</h2>
        <p>We are pleased to inform you that <strong>${d.company_name}</strong> has been shortlisted for the <strong>${d.award_category}</strong> award.</p>
        <p>The final winners will be announced at the awards ceremony.</p>`,
    },
    judge_assignment: {
      subject: 'New Judging Assignment - British Trade Awards',
      body: `<h2>Judging Assignment</h2>
        <p>You have been assigned <strong>${d.entry_count || 0}</strong> entries to judge for the British Trade Awards ${d.year}.</p>
        <p>Please complete your scoring by <strong>${d.deadline || 'the deadline'}</strong>.</p>
        <a href="${data.portal_url || '#'}" class="btn">Open Judge Portal</a>`,
    },
    ticket_issued: {
      subject: `Your Ticket: ${d.event_name}`,
      body: `<h2>Your Ticket</h2>
        <p>Your ticket for <strong>${d.event_name}</strong> has been issued.</p>
        <p><strong>Ticket Number:</strong> ${d.ticket_number}</p>
        <p><strong>Date:</strong> ${d.event_date}</p>
        <p><strong>Venue:</strong> ${d.venue}</p>
        <p>Please present this ticket at check-in.</p>`,
    },
  };

  const template = templates[templateType];
  if (!template) {
    return { success: false, error: `Unknown template type: ${templateType}` };
  }

  const subtitle = HEADER_SUBTITLES[templateType] || '';
  const html = await wrapEmailTemplate(template.subject, template.body, '', {}, subtitle);
  return sendEmail({ to, subject: template.subject, html, tags: [{ name: 'template', value: templateType }] });
}

/**
 * Send a campaign email to all active subscribers in the campaign's email list.
 * Sends in batches of 10 with rate-limiting delays.
 * @param {string} campaignId - The ID of the email campaign to send.
 * @returns {Promise<{success: boolean, sent?: number, failed?: number, total?: number, error?: string}>} Campaign send results.
 */
async function sendCampaignEmail(campaignId) {
  try {
    // Load campaign from DB
    const { data: campaign, error: campError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campError || !campaign) throw new Error('Campaign not found');

    // Load subscribers from the campaign's email list
    const { data: subscribers, error: subError } = await supabase
      .from('email_list_subscribers')
      .select('email, first_name, last_name')
      .eq('list_id', campaign.list_id)
      .eq('status', 'active');

    if (subError) throw subError;

    if (!subscribers || subscribers.length === 0) {
      return { success: false, error: 'No subscribers in list' };
    }

    // Update campaign status
    await supabase
      .from('email_campaigns')
      .update({ status: 'sending', sent_date: new Date().toISOString() })
      .eq('id', campaignId);

    let sent = 0;
    let failed = 0;
    const errors = [];

    // Send in batches of 10 (Resend rate limit friendly)
    for (let i = 0; i < subscribers.length; i += 10) {
      const batch = subscribers.slice(i, i + 10);

      const results = await Promise.allSettled(
        batch.map(async (sub) => {
          let body = campaign.html_content || campaign.body || '';
          body = body.replace(/\{first_name\}/g, sub.first_name || '');
          body = body.replace(/\{last_name\}/g, sub.last_name || '');
          body = body.replace(/\{email\}/g, sub.email || '');

          const html = await wrapEmailTemplate(campaign.subject, body);
          return sendEmail({
            to: sub.email,
            subject: campaign.subject,
            html,
            tags: [{ name: 'campaign', value: campaignId }],
          });
        })
      );

      results.forEach((r) => {
        if (r.status === 'fulfilled' && r.value.success) sent++;
        else {
          failed++;
          // @ts-ignore - TS doesn't narrow PromiseSettledResult well
          errors.push(/** @type {any} */ (r).reason?.message || /** @type {any} */ (r).value?.error || 'Unknown');
        }
      });

      // Small delay between batches
      if (i + 10 < subscribers.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Update campaign with results
    await supabase
      .from('email_campaigns')
      .update({
        status: failed === subscribers.length ? 'failed' : 'sent',
        total_recipients: subscribers.length,
        sent_count: sent,
        failed_count: failed,
      })
      .eq('id', campaignId);

    return { success: true, sent, failed, total: subscribers.length };
  } catch (error) {
    console.error('Campaign send error:', error);
    await supabase.from('email_campaigns').update({ status: 'failed' }).eq('id', campaignId);
    return { success: false, error: error.message };
  }
}

/**
 * Send a test email for previewing templates.
 * Prefixes subject with "[TEST]" to distinguish from production emails.
 * @param {string} to - Recipient email address.
 * @param {string} subject - Email subject line.
 * @param {string} htmlContent - HTML body content to preview.
 * @returns {Promise<{success: boolean, id?: string, error?: string}>} Send result.
 */
async function sendTestEmail(to, subject, htmlContent) {
  const html = await wrapEmailTemplate(subject, htmlContent);
  return sendEmail({ to, subject: `[TEST] ${subject}`, html });
}

/**
 * Process the notification queue (called by cron).
 * Each queued notification is wrapped with the branded header and footer
 * so every outbound email has a consistent look.
 * Processes up to 50 pending notifications per invocation with retry support.
 * @returns {Promise<{processed: number, total?: number}>} Count of processed and total pending notifications.
 */
async function processNotificationQueue() {
  const { data: pending } = await supabase
    .from('notification_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .lt('attempts', 3)
    .order('scheduled_for')
    .limit(50);

  if (!pending || pending.length === 0) return { processed: 0 };

  // Load branding once for the whole batch
  let branding = {};
  try {
    const { data } = await supabase.from('tenant_branding').select('*').eq('tenant_id', 'default').maybeSingle();
    branding = data || {};
  } catch (_) {
    /* use defaults */
  }

  let processed = 0;

  for (const notification of pending) {
    await supabase
      .from('notification_queue')
      .update({ status: 'sending', attempts: notification.attempts + 1 })
      .eq('id', notification.id);

    // Wrap the notification body with branded header & footer
    const html = wrapEmailTemplate(
      notification.subject,
      notification.body,
      '',
      branding,
      notification.template_key ? HEADER_SUBTITLES[notification.template_key] || '' : ''
    );

    const result = await sendEmail({
      to: notification.recipient_email,
      subject: notification.subject,
      html,
    });

    if (result.success) {
      await supabase
        .from('notification_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', notification.id);
      processed++;
    } else {
      const newStatus = notification.attempts + 1 >= notification.max_attempts ? 'failed' : 'pending';
      await supabase
        .from('notification_queue')
        .update({ status: newStatus, last_error: result.error })
        .eq('id', notification.id);
    }
  }

  return { processed, total: pending.length };
}

/**
 * Send an invoice email with branded formatting.
 * @param {Object} options - Invoice email options.
 * @param {string} options.to - Recipient email address.
 * @param {string} options.subject - Email subject line.
 * @param {string} options.message - Email body message text.
 * @param {string} [options.cc] - CC email address.
 * @param {Object} options.invoice - Invoice data for template.
 * @returns {Promise<{success: boolean, id?: string, error?: string}>} Send result.
 */
async function sendInvoiceEmail({ to, subject, message, cc, invoice }) {
  const lineItemsHtml = (invoice.line_items || [])
    .map(
      (item) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee">${item.description || ''}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity || 1}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #eee;text-align:right">&pound;${parseFloat(item.unit_price || 0).toFixed(2)}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #eee;text-align:right">&pound;${parseFloat(item.total || 0).toFixed(2)}</td></tr>`
    )
    .join('');

  const bodyHtml = `
    <h2>Invoice ${invoice.invoice_number || ''}</h2>
    <p>${message.replace(/\n/g, '<br>')}</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0">
      <thead>
        <tr style="background:#f5f5f5">
          <th style="padding:8px;text-align:left">Description</th>
          <th style="padding:8px;text-align:center">Qty</th>
          <th style="padding:8px;text-align:right">Unit Price</th>
          <th style="padding:8px;text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${lineItemsHtml}</tbody>
      <tfoot>
        ${invoice.tax_amount ? `<tr><td colspan="3" style="padding:8px;text-align:right"><strong>Tax:</strong></td><td style="padding:8px;text-align:right">&pound;${parseFloat(invoice.tax_amount).toFixed(2)}</td></tr>` : ''}
        <tr><td colspan="3" style="padding:8px;text-align:right"><strong>Total:</strong></td><td style="padding:8px;text-align:right"><strong>&pound;${parseFloat(invoice.total_amount || 0).toFixed(2)}</strong></td></tr>
      </tfoot>
    </table>
    ${invoice.due_date ? `<p><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString('en-GB')}</p>` : ''}
    ${invoice.payment_url ? `<a href="${invoice.payment_url}" style="display:inline-block;background:#0d6efd;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;margin:16px 0">Pay Now</a>` : ''}
  `;

  const html = wrapEmailTemplate(subject, bodyHtml, '', {}, 'Invoice');

  const emailOpts = { to, subject, html, tags: [{ name: 'template', value: 'invoice' }] };
  if (cc) emailOpts.to = /** @type {any} */ ([to, cc]);

  return sendEmail(emailOpts);
}

/**
 * Vercel serverless handler for email operations.
 * Supports: send-invoice, send-templated, send-campaign, send-test, process-queue
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.body;

  try {
    switch (action) {
      case 'send-invoice': {
        const { to, subject, message, cc, invoice } = req.body;
        if (!to || !subject || !invoice) {
          return res.status(400).json({ error: 'Missing required fields: to, subject, invoice' });
        }
        const result = await sendInvoiceEmail({ to, subject, message, cc, invoice });
        return res.status(result.success ? 200 : 500).json(result);
      }
      case 'send-templated': {
        const { to, templateType, data } = req.body;
        if (!to || !templateType) {
          return res.status(400).json({ error: 'Missing required fields: to, templateType' });
        }
        const result = await sendTemplatedEmail({ to, templateType, data });
        return res.status(result.success ? 200 : 500).json(result);
      }
      case 'send-campaign': {
        const { campaignId } = req.body;
        if (!campaignId) {
          return res.status(400).json({ error: 'Missing required field: campaignId' });
        }
        const result = await sendCampaignEmail(campaignId);
        return res.status(result.success ? 200 : 500).json(result);
      }
      case 'send-test': {
        const { to, subject: testSubject, htmlContent } = req.body;
        if (!to || !testSubject) {
          return res.status(400).json({ error: 'Missing required fields: to, subject' });
        }
        const result = await sendTestEmail(to, testSubject, htmlContent);
        return res.status(result.success ? 200 : 500).json(result);
      }
      case 'send': {
        const { to: sendTo, subject: sendSubject, message: sendMessage } = req.body;
        if (!sendTo || !sendSubject) {
          return res.status(400).json({ error: 'Missing required fields: to, subject' });
        }
        const result = await sendEmail({ to: sendTo, subject: sendSubject, html: sendMessage });
        return res.status(result.success ? 200 : 500).json(result);
      }
      case 'process-queue': {
        const result = await processNotificationQueue();
        return res.status(200).json(result);
      }
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error('Email API error:', error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports.sendEmail = sendEmail;
module.exports.sendTemplatedEmail = sendTemplatedEmail;
module.exports.sendCampaignEmail = sendCampaignEmail;
module.exports.sendTestEmail = sendTestEmail;
module.exports.processNotificationQueue = processNotificationQueue;
module.exports.sendInvoiceEmail = sendInvoiceEmail;
module.exports.wrapEmailTemplate = wrapEmailTemplate;
