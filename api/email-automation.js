/**
 * Email Automation & Workflow Engine
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
const { wrapEmail, loadHeaderFooterTemplates } = require('./email-header');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Initialize Resend (replacing SendGrid)
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Load tenant branding from database (cached for 5 minutes)
 */
let _brandingCache = null;
let _brandingCacheTime = 0;
const BRANDING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function loadTenantBranding() {
  const now = Date.now();
  if (_brandingCache && (now - _brandingCacheTime) < BRANDING_CACHE_TTL) {
    return _brandingCache;
  }
  try {
    const { data } = await supabase
      .from('tenant_branding')
      .select('*')
      .eq('tenant_id', 'default')
      .maybeSingle();
    _brandingCache = data || {};
    _brandingCacheTime = now;
    return _brandingCache;
  } catch (e) {
    console.error('Failed to load tenant branding:', e);
    return _brandingCache || {};
  }
}

/**
 * Map template keys to header subtitle text.
 * These subtitles appear in the email header below the brand name.
 */
const HEADER_SUBTITLES = {
  ENTRY_CONFIRMATION:     'Self-Nomination Entry Confirmation',
  PAYMENT_REMINDER:       'Payment Reminder',
  SHORTLIST_NOTIFICATION: 'Entry Approved/Shortlisted',
  WINNER_ANNOUNCEMENT:    'Entry Approved',
  JUDGE_ASSIGNMENT:       'Judging Assignment',
  JUDGE_REMINDER:         'Judging Reminder',
  DEADLINE_REMINDER:      'Document Upload Reminder',
};

/**
 * Email wrapper - loads header/footer templates from DB, then delegates
 * to shared email-header.js module.  Falls back to hardcoded header/footer
 * if no DB templates exist.
 */
async function wrapEmailTemplate(bodyContent, branding = {}, subtitle = '') {
  const templates = await loadHeaderFooterTemplates(supabase);
  return wrapEmail(bodyContent, branding, {
    headerHtml: templates.header,
    footerHtml: templates.footer,
    subtitle,
  });
}

/**
 * Email template body content (without wrapper).
 * The wrapper is applied at send time using tenant branding.
 * The {{brand_name}} placeholder is replaced with the tenant's company name.
 */
const EMAIL_TEMPLATES = {
  ENTRY_CONFIRMATION: {
    subject: '✅ Entry Confirmed - {{entry_number}}',
    body: `
      <div style="padding: 30px 40px;">
        <h1 style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 28px; color: #1a1a1a;">Entry Submitted Successfully!</h1>
        <p>Dear {{contact_name}},</p>
        <p>Thank you for submitting your entry for the <strong>{{award_name}}</strong>.</p>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Entry Details:</h3>
          <p style="margin: 5px 0;"><strong>Entry Number:</strong> {{entry_number}}</p>
          <p style="margin: 5px 0;"><strong>Company:</strong> {{company_name}}</p>
          <p style="margin: 5px 0;"><strong>Award:</strong> {{award_name}}</p>
          <p style="margin: 5px 0;"><strong>Entry Title:</strong> {{entry_title}}</p>
        </div>

        <h3>What Happens Next?</h3>
        <ol>
          <li>Your entry will be reviewed by our judging panel</li>
          <li>Judging period: {{judging_start}} - {{judging_end}}</li>
          <li>Shortlist announced: {{shortlist_date}}</li>
          <li>Winners announced: {{winner_date}}</li>
        </ol>

        <p>You'll receive email updates at each stage of the process.</p>

        <p>Best of luck!</p>
        <p><strong>{{brand_name}} Team</strong></p>
      </div>
    `
  },

  PAYMENT_REMINDER: {
    subject: '💳 Payment Pending - Entry {{entry_number}}',
    body: `
      <div style="padding: 30px 40px;">
        <h1 style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 28px; color: #1a1a1a;">Payment Reminder</h1>
        <p>Dear {{contact_name}},</p>
        <p>Your entry <strong>{{entry_number}}</strong> is currently pending payment.</p>

        <p><strong>Amount Due:</strong> £{{entry_fee}}</p>
        <p><strong>Entry:</strong> {{entry_title}}</p>

        <p>Please complete your payment to confirm your entry:</p>
        <table cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
          <tr>
            <td style="background: #0d6efd; border-radius: 6px;">
              <a href="{{payment_link}}" style="color: #ffffff; padding: 12px 24px; text-decoration: none; display: inline-block; font-family: Arial, sans-serif; font-weight: bold;">
                Complete Payment
              </a>
            </td>
          </tr>
        </table>

        <p>If you have any questions, please contact us.</p>
      </div>
    `
  },

  SHORTLIST_NOTIFICATION: {
    subject: '🌟 Congratulations - You\'ve Been Shortlisted!',
    body: `
      <div style="padding: 30px 40px;">
        <h1 style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 28px; color: #1a1a1a;">🌟 You've Been Shortlisted!</h1>
        <p>Dear {{contact_name}},</p>

        <p>We're delighted to inform you that <strong>{{company_name}}</strong> has been shortlisted for the <strong>{{award_name}}</strong> at the {{brand_name}}!</p>

        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin: 20px 0; text-align: center;">
          <h2 style="color: white; margin: 0;">Shortlisted</h2>
          <h3 style="color: white; opacity: 0.9; margin: 10px 0 0 0;">{{award_name}}</h3>
        </div>

        <p>Your entry impressed our judges and made it through to the final round.</p>

        <h3>Next Steps:</h3>
        <ul>
          <li><strong>Winner Announcement:</strong> {{winner_date}}</li>
          <li><strong>Awards Ceremony:</strong> {{ceremony_date}} at {{ceremony_venue}}</li>
          <li>Book your tickets to the ceremony</li>
        </ul>

        <table cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
          <tr>
            <td style="background: #28a745; border-radius: 6px;">
              <a href="{{ceremony_tickets_link}}" style="color: #ffffff; padding: 12px 24px; text-decoration: none; display: inline-block; font-family: Arial, sans-serif; font-weight: bold;">
                Book Ceremony Tickets
              </a>
            </td>
          </tr>
        </table>

        <p>Congratulations once again!</p>
        <p><strong>{{brand_name}} Team</strong></p>
      </div>
    `
  },

  WINNER_ANNOUNCEMENT: {
    subject: '🏆 WINNER - {{award_name}}!',
    body: `
      <div style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); padding: 40px; text-align: center;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center">
              <div style="display: inline-block; background: rgba(255,255,255,0.2); border-radius: 50%; width: 80px; height: 80px; line-height: 80px; font-size: 48px; margin-bottom: 10px;">🏆</div>
            </td>
          </tr>
          <tr>
            <td align="center">
              <h1 style="color: #ffffff; font-family: Arial, sans-serif; font-size: 36px; margin: 10px 0 0 0; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">WINNER!</h1>
            </td>
          </tr>
        </table>
      </div>

      <div style="padding: 30px 40px;">
        <p>Dear {{contact_name}},</p>

        <p style="font-size: 18px;"><strong>Congratulations!</strong> We are thrilled to announce that <strong>{{company_name}}</strong> is the winner of the <strong>{{award_name}}</strong> at the {{brand_name}}!</p>

        <p>Your exceptional work has set the standard for excellence.</p>

        <div style="background: #fffbeb; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <h3 style="margin-top: 0; color: #92400e;">Your Winner's Package Includes:</h3>
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="padding: 4px 0; font-size: 15px;">✅ Digital winner's certificate</td></tr>
            <tr><td style="padding: 4px 0; font-size: 15px;">✅ Winner's logo and badge for your marketing</td></tr>
            <tr><td style="padding: 4px 0; font-size: 15px;">✅ Press release and media coverage</td></tr>
            <tr><td style="padding: 4px 0; font-size: 15px;">✅ Feature on our website and social media</td></tr>
            <tr><td style="padding: 4px 0; font-size: 15px;">✅ Winner's trophy (presented at ceremony)</td></tr>
          </table>
        </div>

        <table cellpadding="0" cellspacing="0" border="0" style="margin: 25px 0;" align="center">
          <tr>
            <td style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
              <a href="{{winners_portal_link}}" style="color: #1a1a1a; padding: 14px 30px; text-decoration: none; display: inline-block; font-family: Arial, sans-serif; font-weight: bold; font-size: 16px;">
                Access Winner's Portal
              </a>
            </td>
          </tr>
        </table>

        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; font-size: 15px;"><strong>Awards Ceremony</strong></p>
          <p style="margin: 8px 0 0 0; font-size: 15px;">{{ceremony_date}} at {{ceremony_venue}}</p>
        </div>

        <p>We look forward to celebrating with you!</p>

        <p><strong>{{brand_name}} Team</strong></p>
      </div>
    `
  },

  JUDGE_ASSIGNMENT: {
    subject: '⚖️ New Judging Assignment - {{brand_name}}',
    body: `
      <div style="padding: 30px 40px;">
        <h1 style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 28px; color: #1a1a1a;">New Judging Assignment</h1>
        <p>Dear {{judge_name}},</p>

        <p>You have been assigned {{entry_count}} new entries to judge for the {{brand_name}}.</p>

        <p><strong>Judging Deadline:</strong> {{deadline}}</p>

        <h3>Awards to Judge:</h3>
        <ul>
          {{award_list}}
        </ul>

        <table cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
          <tr>
            <td style="background: #0d6efd; border-radius: 6px;">
              <a href="{{judge_portal_link}}" style="color: #ffffff; padding: 12px 24px; text-decoration: none; display: inline-block; font-family: Arial, sans-serif; font-weight: bold;">
                Start Judging
              </a>
            </td>
          </tr>
        </table>

        <p>Please complete your scoring by the deadline. If you have any questions or conflicts of interest, please contact us immediately.</p>

        <p>Thank you for your contribution to the awards!</p>
      </div>
    `
  },

  JUDGE_REMINDER: {
    subject: '⏰ Judging Deadline Reminder - {{days_left}} Days Left',
    body: `
      <div style="padding: 30px 40px;">
        <h1 style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 28px; color: #1a1a1a;">Judging Deadline Approaching</h1>
        <p>Dear {{judge_name}},</p>

        <p>This is a reminder that the judging deadline is approaching in <strong>{{days_left}} days</strong>.</p>

        <p><strong>Deadline:</strong> {{deadline}}</p>

        <h3>Your Progress:</h3>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 5px 0;">✅ Completed: {{scored_count}}/{{total_count}} entries</p>
          <p style="margin: 5px 0;">⏳ Remaining: {{pending_count}} entries</p>
        </div>

        <table cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
          <tr>
            <td style="background: #0d6efd; border-radius: 6px;">
              <a href="{{judge_portal_link}}" style="color: #ffffff; padding: 12px 24px; text-decoration: none; display: inline-block; font-family: Arial, sans-serif; font-weight: bold;">
                Continue Judging
              </a>
            </td>
          </tr>
        </table>

        <p>Thank you for your time and expertise!</p>
      </div>
    `
  },

  DEADLINE_REMINDER: {
    subject: '⏰ Reminder: {{deadline_type}} Deadline in {{days_left}} Days',
    body: `
      <div style="padding: 30px 40px;">
        <h1 style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 28px; color: #1a1a1a;">Deadline Reminder</h1>
        <p>Dear {{recipient_name}},</p>

        <p>This is a reminder that the <strong>{{deadline_type}}</strong> deadline is approaching.</p>

        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <h3 style="margin-top: 0;">⏰ {{days_left}} Days Remaining</h3>
          <p style="margin-bottom: 0;"><strong>Deadline:</strong> {{deadline_date}}</p>
        </div>

        <p>{{action_required}}</p>

        <table cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
          <tr>
            <td style="background: #0d6efd; border-radius: 6px;">
              <a href="{{action_link}}" style="color: #ffffff; padding: 12px 24px; text-decoration: none; display: inline-block; font-family: Arial, sans-serif; font-weight: bold;">
                {{action_button_text}}
              </a>
            </td>
          </tr>
        </table>
      </div>
    `
  }
};

/**
 * Send email using template with tenant branding
 */
async function sendTemplateEmail(templateKey, toEmail, variables) {
  try {
    const template = EMAIL_TEMPLATES[templateKey];
    if (!template) {
      throw new Error(`Template ${templateKey} not found`);
    }

    // Load tenant branding
    const branding = await loadTenantBranding();
    const brandName = branding.company_name || process.env.FROM_NAME || 'British Trade Awards';

    // Add brand_name to variables so templates can reference it
    const allVariables = { brand_name: brandName, ...variables };

    // Replace variables in subject and body
    let subject = template.subject;
    let bodyContent = template.body;

    const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    for (const [key, value] of Object.entries(allVariables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value || '');
      bodyContent = bodyContent.replace(regex, escapeHtml(value || ''));
    }

    // Wrap body content with branded email template (dynamic subtitle per template type)
    const subtitle = HEADER_SUBTITLES[templateKey] || '';
    const html = await wrapEmailTemplate(bodyContent, branding, subtitle);

    // Use branded from address
    const fromEmail = branding.email_from || process.env.FROM_EMAIL || 'awards@britishtradeawards.com';
    const fromAddress = `${brandName} <${fromEmail}>`;

    await resend.emails.send({
      to: toEmail,
      from: fromAddress,
      subject: subject,
      html: html,
      ...(branding.email_reply_to ? { reply_to: branding.email_reply_to } : {})
    });

    // Log email sent
    await logEmailSent(templateKey, toEmail, subject);

    console.log(`✅ Email sent: ${templateKey} to ${toEmail}`);
    return true;

  } catch (error) {
    console.error(`❌ Error sending email:`, error);

    // Log email failure
    await logEmailFailure(templateKey, toEmail, error.message);

    return false;
  }
}

/**
 * Send entry confirmation email
 */
async function sendEntryConfirmation(entryId) {
  try {
    const { data: entry } = await supabase
      .from('entries')
      .select('*, organisations(*), awards:award_years(*)')
      .eq('id', entryId)
      .single();

    if (!entry) throw new Error('Entry not found');

    const variables = {
      contact_name: entry.contact_name,
      entry_number: entry.entry_number,
      company_name: entry.organisations.company_name,
      award_name: entry.awards.award_name,
      entry_title: entry.entry_title,
      judging_start: 'January 15, 2025',
      judging_end: 'TBC',
      shortlist_date: 'February 25, 2025',
      winner_date: 'TBC'
    };

    return await sendTemplateEmail('ENTRY_CONFIRMATION', entry.contact_email, variables);

  } catch (error) {
    console.error('Error sending entry confirmation:', error);
    return false;
  }
}

/**
 * Send deadline reminders
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

      // Get entries in draft status near deadline
      // TODO: Implement based on your deadline structure
    }

    // Judging deadline reminders
    const { data: judges } = await supabase
      .from('contacts')
      .select('*')
      .eq('contact_type', 'judge');

    const { data: allScores } = await supabase
      .from('judge_scores')
      .select('*');

    for (const judge of judges || []) {
      const judgeScores = (allScores || []).filter(s => s.judge_email === judge.email || s.judge_id === judge.id);
      const totalAssigned = judgeScores.length || 0;
      const completed = judgeScores.filter(s => s.is_complete).length || 0;
      const pending = totalAssigned - completed;

      if (pending > 0) {
        const variables = {
          judge_name: judge.full_name,
          days_left: '7', // Calculate actual days
          deadline: 'TBC',
          scored_count: completed,
          total_count: totalAssigned,
          pending_count: pending,
          judge_portal_link: `${process.env.APP_URL || 'https://admin.britishtrade.com'}/judge-portal.html`
        };

        await sendTemplateEmail('JUDGE_REMINDER', judge.email, variables);
      }
    }

    console.log('✅ Deadline reminders sent');
    return true;

  } catch (error) {
    console.error('Error sending deadline reminders:', error);
    return false;
  }
}

/**
 * Send judge assignments
 */
async function sendJudgeAssignments(judgeEmail, entryIds) {
  try {
    const { data: judge } = await supabase
      .from('contacts')
      .select('*')
      .eq('email', judgeEmail)
      .single();

    if (!judge) throw new Error('Judge not found');

    // Get award names
    const { data: entries } = await supabase
      .from('entries')
      .select('*, awards:award_years(award_name)')
      .in('id', entryIds);

    const awardList = [...new Set(entries.map(e => e.awards.award_name))]
      .map(name => `<li>${name}</li>`)
      .join('');

    const variables = {
      judge_name: judge.full_name || judge.email,
      entry_count: entryIds.length,
      deadline: 'TBC',
      award_list: awardList,
      judge_portal_link: `${process.env.APP_URL || 'https://admin.britishtrade.com'}/judge-portal.html`
    };

    return await sendTemplateEmail('JUDGE_ASSIGNMENT', judgeEmail, variables);

  } catch (error) {
    console.error('Error sending judge assignment:', error);
    return false;
  }
}

/**
 * Send winner announcements
 */
async function sendWinnerAnnouncements(awardId = null) {
  try {
    console.log('🏆 Sending winner announcements...');

    let query = supabase
      .from('entries')
      .select('*, organisations(*), awards:award_years(*)')
      .eq('status', 'winner');

    if (awardId) {
      query = query.eq('award_id', awardId);
    }

    const { data: winners } = await query;

    for (const winner of winners || []) {
      const variables = {
        contact_name: winner.contact_name,
        company_name: winner.organisations.company_name,
        award_name: winner.awards.award_name,
        ceremony_date: 'TBC',
        ceremony_venue: 'The Grand Hall, London',
        winners_portal_link: `${process.env.APP_URL || 'https://admin.britishtrade.com'}/winners-portal.html`
      };

      await sendTemplateEmail('WINNER_ANNOUNCEMENT', winner.contact_email, variables);

      // Also send social media auto-posts
      // TODO: Integrate with social-media.js
    }

    console.log(`✅ Sent ${(winners || []).length} winner announcements`);
    return (winners || []).length;

  } catch (error) {
    console.error('Error sending winner announcements:', error);
    return 0;
  }
}

/**
 * Send shortlist notifications
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

    for (const entry of shortlisted || []) {
      const variables = {
        contact_name: entry.contact_name,
        company_name: entry.organisations.company_name,
        award_name: entry.awards.award_name,
        winner_date: 'TBC',
        ceremony_date: 'TBC',
        ceremony_venue: 'The Grand Hall, London',
        ceremony_tickets_link: `${process.env.APP_URL || 'https://admin.britishtrade.com'}/tickets`
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
 * Log email sent
 */
async function logEmailSent(templateKey, toEmail, subject) {
  await supabase.from('email_log').insert([{
    template_key: templateKey,
    recipient_email: toEmail,
    subject: subject,
    status: 'sent',
    sent_at: new Date().toISOString()
  }]);
}

/**
 * Log email failure
 */
async function logEmailFailure(templateKey, toEmail, error) {
  await supabase.from('email_log').insert([{
    template_key: templateKey,
    recipient_email: toEmail,
    status: 'failed',
    error_message: error,
    sent_at: new Date().toISOString()
  }]);
}

/**
 * API Endpoints
 */

// POST /api/send-email (requires authentication)
async function sendEmailEndpoint(req, res) {
  try {
    // Verify caller is authenticated
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

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

module.exports = {
  sendTemplateEmail,
  sendEntryConfirmation,
  sendDeadlineReminders,
  sendJudgeAssignments,
  sendWinnerAnnouncements,
  sendShortlistNotifications,
  sendEmailEndpoint,
  sendDeadlineRemindersEndpoint,
  sendWinnerAnnouncementsEndpoint
};
