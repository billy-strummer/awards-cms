/**
 * Hardcoded email templates and template type mappings for email-automation.js.
 * sendTemplateEmail() tries the DB first (email_templates table); these are fallbacks.
 */

/**
 * Map template keys (used in code) to database template_type values.
 * sendTemplateEmail() tries to load from the DB first using these types.
 */
const DB_TEMPLATE_TYPE_MAP = {
  SPONSOR_ENQUIRY_CONFIRMATION: 'sponsor_enquiry_confirmation',
  ENTRY_CONFIRMATION: 'confirmation',
  NOMINATION_CONFIRMATION: 'nomination_confirmation',
  ENTRY_DEADLINE_REMINDER: 'entry_deadline_reminder',
  PAYMENT_REMINDER: 'payment_reminder',
  SHORTLIST_NOTIFICATION: 'approval',
  NOT_SHORTLISTED: 'entry_not_shortlisted',
  WINNER_NOTIFICATION: 'winner_notification',
  ENTRY_RECEIVED: 'entry_received',
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
 * Convert plain-text template body (from CMS) to styled HTML with paragraph wrapping.
 * @param {string} text - Plain text content to convert.
 * @returns {string} HTML string with paragraphs and line breaks.
 */
// textToHtml imported from ./_lib/email-header

/**
 * Hardcoded email template body content (fallback when no DB template found).
 * The wrapper is applied at send time using tenant branding.
 * The {{brand_name}} placeholder is replaced with the tenant's company name.
 */
const EMAIL_TEMPLATES = {
  SPONSOR_ENQUIRY_CONFIRMATION: {
    preheader: "We've received your sponsorship enquiry and will be in touch within 2 business days.",
    subject: 'Sponsorship enquiry received — British Trade Awards 2026',
    body: `
      <div style="padding: 30px 40px;">
        <p>Hi {NAME},</p>
        <p>Thank you for your interest in sponsoring the <strong>British Trade Awards 2026</strong>. We've received your enquiry and a member of our partnerships team will be in touch within <strong>2 business days</strong>.</p>
        <p><strong>Package interest:</strong> {PACKAGE}<br>
        <strong>Company:</strong> {COMPANY}</p>
        <p>Questions? Simply reply to this email.</p>
        <p>The British Trade Awards Partnerships Team</p>
      </div>
    `,
  },

  ENTRY_DEADLINE_REMINDER: {
    preheader: "Don't miss the deadline — submit your entry today.",
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
        <p style="text-align:center;font-size:12px;color:#6c757d;border-top:1px solid #e9ecef;padding-top:16px;margin-top:24px;">To stop receiving these reminders, <a href="{{unsubscribe_link}}" style="color:#6c757d;">unsubscribe here</a>.</p>
      </div>`,
  },
  ENTRY_CONFIRMATION: {
    preheader: 'Your entry has been received — here are the details.',
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
    preheader: 'Your nomination has been received — keep your reference number safe.',
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
    preheader: 'Your entry is pending payment — complete it to secure your place.',
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

        <p>If you have any questions, please <a href="mailto:{{support_email}}">contact us</a>.</p>
        <p style="text-align:center;font-size:12px;color:#6c757d;border-top:1px solid #e9ecef;padding-top:16px;margin-top:24px;">To stop receiving these reminders, <a href="{{unsubscribe_link}}" style="color:#6c757d;">unsubscribe here</a>.</p>
      </div>
    `,
  },

  SHORTLIST_NOTIFICATION: {
    preheader: 'Congratulations — your entry has been shortlisted!',
    subject: "🌟 Congratulations - You've Been Shortlisted!",
    body: `
      <div style="padding: 30px 40px;">
        <h1 style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 28px; color: #1a1a1a;">🌟 You've Been Shortlisted!</h1>
        <p>Dear {{contact_name}},</p>

        <p>We're delighted to inform you that <strong>{{company_name}}</strong> has been shortlisted for the <strong>{{award_name}}</strong> at the {{brand_name}}!</p>

        <div style="background-color: #667eea; color: white; padding: 30px; border-radius: 12px; margin: 20px 0; text-align: center;">
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
    preheader: "You're a winner — here is everything you need to know.",
    subject: '🏆 WINNER - {{award_name}}!',
    body: `
      <div style="background-color: #FFD700; padding: 40px; text-align: center;">
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
            <td style="background-color: #FFD700; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
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
    preheader: 'You have new entries to judge — review your assignments.',
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

        <p>Please complete your scoring by the deadline. If you have any questions or conflicts of interest, please <a href="mailto:{{support_email}}">contact us</a> immediately.</p>

        <p>Thank you for your contribution to the awards!</p>
      </div>
    `,
  },

  JUDGE_REMINDER: {
    preheader: 'Judging deadline is approaching — complete your scores today.',
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
    preheader: 'A deadline is approaching — action required.',
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
        <p style="text-align:center;font-size:12px;color:#6c757d;border-top:1px solid #e9ecef;padding-top:16px;margin-top:24px;">To stop receiving these reminders, <a href="{{unsubscribe_link}}" style="color:#6c757d;">unsubscribe here</a>.</p>
      </div>
    `,
  },

  REVISION_REQUEST: {
    preheader: 'Your entry requires changes before it can proceed to judging.',
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

        <p>If you have any questions, please <a href="mailto:{{support_email}}">contact us</a>.</p>
        <p><strong>{{brand_name}} Team</strong></p>
      </div>
    `,
  },

  REJECTION: {
    preheader: 'An update on your entry submission for this years awards.',
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
    preheader: 'You are cordially invited — see the details inside.',
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
    preheader: 'Your event ticket has been issued — present this at check-in.',
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
    preheader: '',
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
    preheader: '',
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
    preheader: 'You have been invited — see the details inside.',
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

  ENTRY_RECEIVED: {
    preheader: 'Your entry has been received — we will be in touch.',
    subject: '✅ Entry Received — {{entry_number}}',
    body: `
      <div style="padding: 30px 40px;">
        <h1 style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 28px; color: #1a1a1a;">Entry Received</h1>
        <p>Dear {{contact_name}},</p>
        <p>Thank you for submitting your entry <strong>{{entry_title}}</strong> ({{entry_number}}) for <strong>{{award_name}}</strong>.</p>
        <p>We have received your submission and it is now being processed. You will hear from us with an update as the judging progresses.</p>
        <p>Kind regards,<br><strong>{{brand_name}} Team</strong></p>
      </div>
    `,
  },

  NOT_SHORTLISTED: {
    preheader: 'An update on your entry in this years awards.',
    subject: 'Your Entry — {{entry_number}} | {{brand_name}}',
    body: `
      <div style="padding: 30px 40px;">
        <h1 style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 28px; color: #1a1a1a;">Entry Update</h1>
        <p>Dear {{contact_name}},</p>
        <p>Thank you for entering <strong>{{entry_title}}</strong> ({{entry_number}}) in the <strong>{{award_name}}</strong>.</p>
        <p>After careful consideration by our judging panel, we regret to inform you that your entry has not been shortlisted on this occasion.</p>
        <p>We appreciate the time and effort you put into your submission and encourage you to enter future programmes.</p>
        <p>Kind regards,<br><strong>{{brand_name}} Team</strong></p>
      </div>
    `,
  },

  WINNER_NOTIFICATION: {
    preheader: 'Congratulations — your entry has been selected as a winner!',
    subject: "🏆 Congratulations — You're a Winner! | {{brand_name}}",
    body: `
      <div style="padding: 30px 40px;">
        <h1 style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 28px; color: #1a1a1a;">Congratulations — You\'re a Winner!</h1>
        <p>Dear {{contact_name}},</p>
        <p>We are thrilled to inform you that your entry <strong>{{entry_title}}</strong> ({{entry_number}}) has been selected as a winner of the <strong>{{award_name}}</strong>.</p>
        <p>Further details about the awards ceremony and your winner certificate will follow shortly.</p>
        <p>Congratulations once again!</p>
        <p>Kind regards,<br><strong>{{brand_name}} Team</strong></p>
      </div>
    `,
  },
};

module.exports = { EMAIL_TEMPLATES, DB_TEMPLATE_TYPE_MAP };
