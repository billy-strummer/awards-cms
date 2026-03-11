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

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY
);

// Initialize Resend (replacing SendGrid)
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Load tenant branding from database (cached for 5 minutes).
 * @returns {Promise<Object>} Branding configuration object.
 */
/** @type {Map<string, {data: Object, time: number}>} */
const _brandingCacheMap = new Map();
const BRANDING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load tenant branding from database (cached for 5 minutes per tenant).
 * @param {string} [tenantId='default'] - The tenant identifier.
 * @returns {Promise<Object>} Branding configuration object.
 */
async function loadTenantBranding(tenantId = 'default') {
  const now = Date.now();
  const cached = _brandingCacheMap.get(tenantId);
  if (cached && now - cached.time < BRANDING_CACHE_TTL) {
    return cached.data;
  }
  try {
    const { data } = await supabase.from('tenant_branding').select('*').eq('tenant_id', tenantId).maybeSingle();
    const branding = data || {};
    _brandingCacheMap.set(tenantId, { data: branding, time: now });
    return branding;
  } catch (e) {
    console.error('Failed to load tenant branding:', e);
    return cached?.data || {};
  }
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
 * Header/footer are built from branding; subtitle changes per email type.
 * @param {string} bodyContent - The HTML body content to wrap.
 * @param {Object} [branding={}] - Tenant branding configuration.
 * @param {string} [subtitle=''] - Subtitle text for the email header.
 * @returns {string} Complete branded HTML email document.
 */
function wrapEmailTemplate(bodyContent, branding = {}, subtitle = '') {
  return wrapEmail(bodyContent, branding, { subtitle });
}

/**
 * Map template keys (used in code) to database template_type values.
 * sendTemplateEmail() tries to load from the DB first using these types.
 */
const DB_TEMPLATE_TYPE_MAP = {
  ENTRY_CONFIRMATION: 'confirmation',
  NOMINATION_CONFIRMATION: 'nomination_confirmation',
  ENTRY_DEADLINE_REMINDER: 'entry_deadline_reminder',
  PAYMENT_REMINDER: 'payment_reminder',
  SHORTLIST_NOTIFICATION: 'approval',
  WINNER_ANNOUNCEMENT: 'winner_announcement',
  JUDGE_ASSIGNMENT: 'judge_assignment',
  JUDGE_REMINDER: 'judge_reminder',
  DEADLINE_REMINDER: 'deadline_reminder',
  REVISION_REQUEST: 'revision_request',
  REJECTION: 'rejection',
  EVENT_INVITATION: 'event_invitation',
  TICKET_ISSUED: 'ticket_issued',
  GENERAL: 'general',
  NOTIFICATION: 'notification',
  INVITE: 'invite',
};

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
function textToHtml(text) {
  const escaped = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = escaped.replace(/\n\n/g, '</p><p style="margin:0 0 16px 0;">').replace(/\n/g, '<br>');
  return `<div style="padding:30px 40px;"><p style="margin:0 0 16px 0;">${html}</p></div>`;
}

/**
 * Hardcoded email template body content (fallback when no DB template found).
 * The wrapper is applied at send time using tenant branding.
 * The {{brand_name}} placeholder is replaced with the tenant's company name.
 */
const EMAIL_TEMPLATES = {
  ENTRY_DEADLINE_REMINDER: {
    subject: '⏰ Entry Deadline Approaching - {{award_name}}',
    body: `
      <div style="padding: 30px 40px;">
        <h1 style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 28px; color: #1a1a1a;">Entry Deadline Reminder</h1>
        <p>Dear {{contact_name}},</p>
        <p>This is a reminder that the entry deadline for <strong>{{award_name}}</strong> is approaching.</p>
        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0;"><strong>Days remaining:</strong> {{days_left}}</p>
          <p style="margin: 5px 0 0;"><strong>Deadline:</strong> {{deadline}}</p>
        </div>
        <p>Don't miss your chance to be recognised. Submit your entry today!</p>
        <a href="{{submit_link}}" style="display:inline-block;background:#0d6efd;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;margin:16px 0">Submit Entry</a>
        <p><strong>{{brand_name}} Team</strong></p>
      </div>`,
  },
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
    `,
  },

  NOMINATION_CONFIRMATION: {
    subject: 'Nomination Received - {{entry_number}} | {{brand_name}}',
    body: `
      <div style="padding: 30px 40px;">
        <h1 style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 28px; color: #1a1a1a;">Nomination Confirmation</h1>
        <p>Dear {{contact_name}},</p>
        <p>Thank you for submitting your nomination for the {{brand_name}}. We are pleased to confirm that your nomination has been received and is now being processed.</p>

        <div style="background: #fffdf5; border-left: 4px solid #D4AF37; padding: 16px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <h3 style="margin: 0 0 12px; color: #1a1a1a; font-size: 16px;">Nomination Details</h3>
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr><td style="padding: 4px 8px; color: #6c757d; width: 120px;">Reference:</td><td style="padding: 4px 8px; font-weight: 600;">{{entry_number}}</td></tr>
            <tr><td style="padding: 4px 8px; color: #6c757d;">Nominee:</td><td style="padding: 4px 8px;">{{nominee_name}}</td></tr>
            <tr><td style="padding: 4px 8px; color: #6c757d;">Category:</td><td style="padding: 4px 8px;">{{award_name}}</td></tr>
          </table>
        </div>

        <h3 style="color: #1a1a1a; font-size: 16px;">What Happens Next</h3>
        <ol style="padding-left: 20px;">
          <li style="margin-bottom: 8px;">Our team will review your nomination to ensure all details are complete.</li>
          <li style="margin-bottom: 8px;">Shortlisted nominations will be assessed by our independent judging panel.</li>
          <li style="margin-bottom: 8px;">Winners will be announced at the awards ceremony.</li>
        </ol>

        <p>Please keep your nomination reference number <strong>{{entry_number}}</strong> safe for future correspondence.</p>

        <p style="margin-top: 24px;">Kind regards,<br><strong>{{brand_name}} Team</strong></p>
      </div>
    `,
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
    `,
  },

  SHORTLIST_NOTIFICATION: {
    subject: "🌟 Congratulations - You've Been Shortlisted!",
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
    `,
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
    `,
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
    `,
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
    `,
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
    `,
  },

  REVISION_REQUEST: {
    subject: '📝 Action Required: Changes Requested - {{entry_title}}',
    body: `
      <div style="padding: 30px 40px;">
        <h1 style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 28px; color: #1a1a1a;">Changes Requested</h1>
        <p>Dear {{contact_name}},</p>

        <p>Your entry <strong>{{entry_title}}</strong> ({{entry_number}}) requires some changes before it can proceed to the judging stage.</p>

        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <h3 style="margin-top: 0; color: #856404;">Feedback from our team:</h3>
          <p style="margin-bottom: 0;">{{feedback}}</p>
        </div>

        <p>Please review the feedback and update your entry at your earliest convenience.</p>

        <table cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
          <tr>
            <td style="background: #0d6efd; border-radius: 6px;">
              <a href="{{action_link}}" style="color: #ffffff; padding: 12px 24px; text-decoration: none; display: inline-block; font-family: Arial, sans-serif; font-weight: bold;">
                Review & Update Entry
              </a>
            </td>
          </tr>
        </table>

        <p>If you have any questions, please contact us.</p>
        <p><strong>{{brand_name}} Team</strong></p>
      </div>
    `,
  },

  REJECTION: {
    subject: 'Your Entry Update - {{entry_number}} | {{brand_name}}',
    body: `
      <div style="padding: 30px 40px;">
        <h1 style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 28px; color: #1a1a1a;">Entry Update</h1>
        <p>Dear {{contact_name}},</p>

        <p>Thank you for entering <strong>{{company_name}}</strong> into the <strong>{{award_name}}</strong> category at the {{brand_name}}.</p>

        <div style="background: #f8f9fa; padding: 15px 20px; border-radius: 8px; margin: 20px 0;">
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr><td style="padding: 4px 8px; color: #6c757d; width: 120px;">Reference:</td><td style="padding: 4px 8px;">{{entry_number}}</td></tr>
            <tr><td style="padding: 4px 8px; color: #6c757d;">Company:</td><td style="padding: 4px 8px;">{{company_name}}</td></tr>
            <tr><td style="padding: 4px 8px; color: #6c757d;">Category:</td><td style="padding: 4px 8px;">{{award_name}}</td></tr>
          </table>
        </div>

        <p>After careful consideration by our judging panel, we regret to inform you that your entry has not been selected for the shortlist on this occasion.</p>

        <p>We received an exceptionally high standard of entries this year, making the selection process extremely competitive. Not being shortlisted is in no way a reflection on the quality of your business or the work you do.</p>

        <p>We would very much welcome an entry from you again next year and wish you continued success.</p>

        <p>Kind regards,<br><strong>{{brand_name}} Team</strong></p>
      </div>
    `,
  },

  EVENT_INVITATION: {
    subject: "✉️ You're Invited: {{event_name}}",
    body: `
      <div style="padding: 30px 40px;">
        <h1 style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 28px; color: #1a1a1a;">You're Invited!</h1>
        <p>Dear {{contact_name}},</p>

        <p>You are cordially invited to attend the <strong>{{event_name}}</strong>.</p>

        <div style="background: #f0f4ff; border-left: 4px solid #0d6efd; padding: 16px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr><td style="padding: 4px 8px; color: #6c757d; width: 80px;">Date:</td><td style="padding: 4px 8px; font-weight: 600;">{{event_date}}</td></tr>
            <tr><td style="padding: 4px 8px; color: #6c757d;">Venue:</td><td style="padding: 4px 8px;">{{venue}}</td></tr>
          </table>
        </div>

        <p>We would be honoured by your presence at this special occasion.</p>

        <table cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
          <tr>
            <td style="background: #0d6efd; border-radius: 6px;">
              <a href="{{rsvp_link}}" style="color: #ffffff; padding: 12px 24px; text-decoration: none; display: inline-block; font-family: Arial, sans-serif; font-weight: bold;">
                RSVP Now
              </a>
            </td>
          </tr>
        </table>

        <p><strong>{{brand_name}} Team</strong></p>
      </div>
    `,
  },

  TICKET_ISSUED: {
    subject: '🎟️ Your Ticket: {{event_name}}',
    body: `
      <div style="padding: 30px 40px;">
        <h1 style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 28px; color: #1a1a1a;">Your Ticket</h1>
        <p>Dear {{contact_name}},</p>

        <p>Your ticket for <strong>{{event_name}}</strong> has been issued.</p>

        <div style="background: #f0f4ff; border-left: 4px solid #0d6efd; padding: 16px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr><td style="padding: 4px 8px; color: #6c757d; width: 120px;">Ticket No:</td><td style="padding: 4px 8px; font-weight: 600;">{{ticket_number}}</td></tr>
            <tr><td style="padding: 4px 8px; color: #6c757d;">Event:</td><td style="padding: 4px 8px;">{{event_name}}</td></tr>
            <tr><td style="padding: 4px 8px; color: #6c757d;">Date:</td><td style="padding: 4px 8px;">{{event_date}}</td></tr>
            <tr><td style="padding: 4px 8px; color: #6c757d;">Venue:</td><td style="padding: 4px 8px;">{{venue}}</td></tr>
          </table>
        </div>

        <p>Please present this ticket at check-in. You may also receive a QR code closer to the event date.</p>

        <p><strong>{{brand_name}} Team</strong></p>
      </div>
    `,
  },

  GENERAL: {
    subject: '{{subject_line}}',
    body: `
      <div style="padding: 30px 40px;">
        <p>Dear {{recipient_name}},</p>
        <p>{{message_body}}</p>
        <p>Kind regards,<br><strong>{{brand_name}} Team</strong></p>
      </div>
    `,
  },

  NOTIFICATION: {
    subject: '🔔 {{subject_line}} - {{brand_name}}',
    body: `
      <div style="padding: 30px 40px;">
        <h1 style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 28px; color: #1a1a1a;">{{subject_line}}</h1>
        <p>Dear {{recipient_name}},</p>
        <p>{{message_body}}</p>
        <p><strong>{{brand_name}} Team</strong></p>
      </div>
    `,
  },

  INVITE: {
    subject: '✉️ {{subject_line}} - {{brand_name}}',
    body: `
      <div style="padding: 30px 40px;">
        <h1 style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 28px; color: #1a1a1a;">You're Invited</h1>
        <p>Dear {{recipient_name}},</p>
        <p>{{message_body}}</p>

        <table cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
          <tr>
            <td style="background: #0d6efd; border-radius: 6px;">
              <a href="{{action_link}}" style="color: #ffffff; padding: 12px 24px; text-decoration: none; display: inline-block; font-family: Arial, sans-serif; font-weight: bold;">
                {{action_button_text}}
              </a>
            </td>
          </tr>
        </table>

        <p><strong>{{brand_name}} Team</strong></p>
      </div>
    `,
  },
};

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
      let bodyText = dbTpl.body;
      for (const [key, value] of Object.entries(upperVars)) {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        subject = subject.replace(regex, value);
        bodyText = bodyText.replace(regex, value);
      }

      const bodyHtml = textToHtml(bodyText);
      const html = wrapEmailTemplate(bodyHtml, branding, subtitle);

      const fromEmail = branding.email_from || process.env.FROM_EMAIL || 'awards@britishtradeawards.com';
      await resend.emails.send({
        to: toEmail,
        from: `${brandName} <${fromEmail}>`,
        subject,
        html,
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

    const allVariables = { brand_name: brandName, ...variables };

    let subject = template.subject;
    let bodyContent = template.body;

    const escapeHtml = (str) =>
      String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    for (const [key, value] of Object.entries(allVariables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value || '');
      bodyContent = bodyContent.replace(regex, escapeHtml(value || ''));
    }

    const html = wrapEmailTemplate(bodyContent, branding, subtitle);

    const fromEmail = branding.email_from || process.env.FROM_EMAIL || 'awards@britishtradeawards.com';
    await resend.emails.send({
      to: toEmail,
      from: `${brandName} <${fromEmail}>`,
      subject,
      html,
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
      company_name: entry.organisations.company_name,
      award_name: entry.awards.award_name,
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

        for (const entry of draftEntries || []) {
          const variables = {
            contact_name: entry.contact_name,
            company_name: entry.organisations?.company_name || '',
            award_name: season.name,
            days_left: String(daysLeft),
            deadline: season.entry_close_date,
            submit_link: `${process.env.APP_URL || 'https://admin.britishtradeawards.com'}/submit-entry.html`,
          };

          await sendTemplateEmail('ENTRY_DEADLINE_REMINDER', entry.contact_email, variables);
        }
      }
    }

    // Judging deadline reminders
    const { data: judges } = await supabase.from('contacts').select('*').eq('contact_type', 'judge');

    const { data: allScores } = await supabase.from('judge_scores').select('*');

    for (const judge of judges || []) {
      const judgeScores = (allScores || []).filter((s) => s.judge_email === judge.email || s.judge_id === judge.id);
      const totalAssigned = judgeScores.length || 0;
      const completed = judgeScores.filter((s) => s.is_complete).length || 0;
      const pending = totalAssigned - completed;

      if (pending > 0) {
        // Get nearest judging deadline from active awards
        const { data: activeAwards } = await supabase
          .from('award_years')
          .select('judging_end_date')
          .eq('is_active', true)
          .not('judging_end_date', 'is', null)
          .order('judging_end_date', { ascending: true })
          .limit(1);
        const judgingDeadline = activeAwards?.[0]?.judging_end_date;
        const daysLeft = judgingDeadline
          ? Math.max(0, Math.ceil((new Date(judgingDeadline) - now) / (1000 * 60 * 60 * 24)))
          : null;
        const formatDate = (d) =>
          d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'TBC';

        const variables = {
          judge_name: judge.full_name,
          days_left: daysLeft !== null ? String(daysLeft) : 'TBC',
          deadline: formatDate(judgingDeadline),
          scored_count: completed,
          total_count: totalAssigned,
          pending_count: pending,
          judge_portal_link: `${process.env.APP_URL || 'https://admin.britishtradeawards.com'}/judge-portal.html`,
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

    for (const winner of winners || []) {
      const variables = {
        contact_name: winner.contact_name,
        company_name: winner.organisations.company_name,
        award_name: winner.awards.award_name,
        ceremony_date: formatDate(ceremony?.event_date),
        ceremony_venue: ceremony?.venue || 'TBC',
        winners_portal_link: `${process.env.APP_URL || 'https://admin.britishtradeawards.com'}/winners-portal.html`,
      };

      await sendTemplateEmail('WINNER_ANNOUNCEMENT', winner.contact_email, variables);

      // Auto-post winner announcement to social media
      try {
        const postContent = `Congratulations to ${winner.organisations?.company_name || winner.contact_name} for winning ${winner.awards?.award_name || 'a British Trade Award'}! 🏆 #BritishTradeAwards #Winners`;
        const { data: socialPost } = await supabase
          .from('social_media_posts')
          .insert({
            content: postContent,
            platforms: ['twitter', 'linkedin', 'facebook'],
            status: 'scheduled',
            scheduled_for: new Date().toISOString(),
            post_type: 'winner_announcement',
          })
          .select('id')
          .single();

        if (socialPost) {
          const { publishToSocialMedia } = require('./social-media-api');
          await publishToSocialMedia(socialPost.id);
        }
      } catch (socialError) {
        console.error('Social media auto-post failed (non-blocking):', socialError.message);
      }
    }

    console.log(`✅ Sent ${(winners || []).length} winner announcements`);
    return (winners || []).length;
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
        company_name: entry.organisations.company_name,
        award_name: entry.awards.award_name,
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

  // Verify authentication for all actions
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const action = req.query.action || req.body?.action;

  switch (action) {
    case 'send-email':
      return sendEmailEndpoint(req, res);
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
