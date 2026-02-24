/* ==================================================== */
/* RESEND.COM EMAIL INTEGRATION                          */
/* Replaces SendGrid - uses Resend for transactional     */
/* and campaign emails                                   */
/* ==================================================== */

const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const FROM_EMAIL = process.env.FROM_EMAIL || 'awards@britishtradeawards.com';
const FROM_NAME = process.env.FROM_NAME || 'British Trade Awards';

/**
 * Wrap email content in BTA branded HTML template
 */
function wrapEmailTemplate(subject, bodyHtml, preheader = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${subject}</title>
<style>
  body { margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
  .header { background: linear-gradient(135deg, #1a237e 0%, #0d47a1 100%); padding: 32px; text-align: center; }
  .header h1 { color: #cc9900; margin: 0; font-size: 24px; }
  .header p { color: #ffffff; margin: 8px 0 0; font-size: 14px; }
  .body { padding: 32px; color: #333333; line-height: 1.6; font-size: 15px; }
  .footer { background: #f8f9fa; padding: 24px 32px; text-align: center; font-size: 12px; color: #6c757d; }
  .footer a { color: #0d6efd; text-decoration: none; }
  .btn { display: inline-block; padding: 12px 28px; background: #cc9900; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
</style>
</head>
<body>
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
<div class="container">
  <div class="header">
    <h1>British Trade Awards</h1>
    <p>Celebrating Excellence in British Trade</p>
  </div>
  <div class="body">${bodyHtml}</div>
  <div class="footer">
    <p>British Trade Awards | <a href="https://britishtrade.com">britishtrade.com</a></p>
    <p style="margin-top:8px;">You received this email because you are associated with the British Trade Awards.</p>
    <p><a href="{{{unsubscribe_url}}}">Unsubscribe</a> | <a href="{{{preferences_url}}}">Email Preferences</a></p>
  </div>
</div>
</body></html>`;
}

/**
 * Send a single email via Resend
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
      tags: tags || undefined
    });

    if (error) throw error;

    // Log to database
    await supabase.from('notification_queue').insert({
      notification_type: 'email',
      recipient_email: Array.isArray(to) ? to.join(', ') : to,
      subject,
      status: 'sent',
      sent_at: new Date().toISOString(),
      template_data: { resend_id: data?.id }
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
      last_error: error.message
    });

    return { success: false, error: error.message };
  }
}

/**
 * Send a templated email (winner notification, invite, etc.)
 */
async function sendTemplatedEmail({ to, templateType, data }) {
  const templates = {
    winner_notification: {
      subject: `Congratulations! ${data.company_name} wins ${data.award_category}`,
      body: `<h2>Congratulations!</h2>
        <p>We are delighted to inform you that <strong>${data.company_name}</strong> has been selected as the winner of the <strong>${data.award_category}</strong> award for ${data.year}.</p>
        <p>This prestigious award recognizes your outstanding achievements and contributions to your industry.</p>
        ${data.event_name ? `<h3>Event Details</h3><ul><li><strong>Event:</strong> ${data.event_name}</li><li><strong>Date:</strong> ${data.event_date}</li><li><strong>Venue:</strong> ${data.venue}</li></ul>` : ''}
        <p>We look forward to celebrating your success!</p>
        <a href="${data.confirm_url || '#'}" class="btn">Confirm Attendance</a>`
    },
    event_invitation: {
      subject: `You're Invited: ${data.event_name}`,
      body: `<h2>You're Invited!</h2>
        <p>You are cordially invited to attend the <strong>${data.event_name}</strong>.</p>
        <ul><li><strong>Date:</strong> ${data.event_date}</li><li><strong>Venue:</strong> ${data.venue}</li></ul>
        <p>We would be honoured by your presence at this special occasion.</p>
        <a href="${data.rsvp_url || '#'}" class="btn">RSVP Now</a>`
    },
    entry_confirmation: {
      subject: `Entry Received: ${data.award_category}`,
      body: `<h2>Entry Confirmed</h2>
        <p>Thank you for submitting your entry for the <strong>${data.award_category}</strong> award.</p>
        <p><strong>Entry Reference:</strong> ${data.entry_number || 'N/A'}</p>
        <p>Our team will review your submission. You will be notified of progress updates.</p>`
    },
    payment_reminder: {
      subject: `Payment Reminder: Invoice ${data.invoice_number}`,
      body: `<h2>Payment Reminder</h2>
        <p>This is a reminder that invoice <strong>${data.invoice_number}</strong> for <strong>&pound;${data.amount}</strong> is due on <strong>${data.due_date}</strong>.</p>
        <a href="${data.payment_url || '#'}" class="btn">Pay Now</a>`
    },
    shortlist_notification: {
      subject: `Congratulations! You've Been Shortlisted for ${data.award_category}`,
      body: `<h2>You've Been Shortlisted!</h2>
        <p>We are pleased to inform you that <strong>${data.company_name}</strong> has been shortlisted for the <strong>${data.award_category}</strong> award.</p>
        <p>The final winners will be announced at the awards ceremony.</p>`
    },
    judge_assignment: {
      subject: 'New Judging Assignment - British Trade Awards',
      body: `<h2>Judging Assignment</h2>
        <p>You have been assigned <strong>${data.entry_count || 0}</strong> entries to judge for the British Trade Awards ${data.year}.</p>
        <p>Please complete your scoring by <strong>${data.deadline || 'the deadline'}</strong>.</p>
        <a href="${data.portal_url || '#'}" class="btn">Open Judge Portal</a>`
    },
    ticket_issued: {
      subject: `Your Ticket: ${data.event_name}`,
      body: `<h2>Your Ticket</h2>
        <p>Your ticket for <strong>${data.event_name}</strong> has been issued.</p>
        <p><strong>Ticket Number:</strong> ${data.ticket_number}</p>
        <p><strong>Date:</strong> ${data.event_date}</p>
        <p><strong>Venue:</strong> ${data.venue}</p>
        <p>Please present this ticket at check-in.</p>`
    }
  };

  const template = templates[templateType];
  if (!template) {
    return { success: false, error: `Unknown template type: ${templateType}` };
  }

  const html = wrapEmailTemplate(template.subject, template.body);
  return sendEmail({ to, subject: template.subject, html, tags: [{ name: 'template', value: templateType }] });
}

/**
 * Send a campaign email to a list of recipients
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
    await supabase.from('email_campaigns').update({ status: 'sending', sent_date: new Date().toISOString() }).eq('id', campaignId);

    let sent = 0;
    let failed = 0;
    const errors = [];

    // Send in batches of 10 (Resend rate limit friendly)
    for (let i = 0; i < subscribers.length; i += 10) {
      const batch = subscribers.slice(i, i + 10);

      const results = await Promise.allSettled(
        batch.map(sub => {
          let body = campaign.html_content || campaign.body || '';
          body = body.replace(/\{first_name\}/g, sub.first_name || '');
          body = body.replace(/\{last_name\}/g, sub.last_name || '');
          body = body.replace(/\{email\}/g, sub.email || '');

          const html = wrapEmailTemplate(campaign.subject, body);
          return sendEmail({
            to: sub.email,
            subject: campaign.subject,
            html,
            tags: [{ name: 'campaign', value: campaignId }]
          });
        })
      );

      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value.success) sent++;
        else { failed++; errors.push(r.reason?.message || r.value?.error || 'Unknown'); }
      });

      // Small delay between batches
      if (i + 10 < subscribers.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Update campaign with results
    await supabase.from('email_campaigns').update({
      status: failed === subscribers.length ? 'failed' : 'sent',
      total_recipients: subscribers.length,
      sent_count: sent,
      failed_count: failed
    }).eq('id', campaignId);

    return { success: true, sent, failed, total: subscribers.length };

  } catch (error) {
    console.error('Campaign send error:', error);
    await supabase.from('email_campaigns').update({ status: 'failed' }).eq('id', campaignId);
    return { success: false, error: error.message };
  }
}

/**
 * Send a test email for previewing templates
 */
async function sendTestEmail(to, subject, htmlContent) {
  const html = wrapEmailTemplate(subject, htmlContent);
  return sendEmail({ to, subject: `[TEST] ${subject}`, html });
}

/**
 * Process the notification queue (called by cron)
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

  let processed = 0;

  for (const notification of pending) {
    await supabase.from('notification_queue').update({ status: 'sending', attempts: notification.attempts + 1 }).eq('id', notification.id);

    const result = await sendEmail({
      to: notification.recipient_email,
      subject: notification.subject,
      html: notification.body
    });

    if (result.success) {
      await supabase.from('notification_queue').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', notification.id);
      processed++;
    } else {
      const newStatus = notification.attempts + 1 >= notification.max_attempts ? 'failed' : 'pending';
      await supabase.from('notification_queue').update({ status: newStatus, last_error: result.error }).eq('id', notification.id);
    }
  }

  return { processed, total: pending.length };
}

module.exports = {
  sendEmail,
  sendTemplatedEmail,
  sendCampaignEmail,
  sendTestEmail,
  processNotificationQueue,
  wrapEmailTemplate
};
