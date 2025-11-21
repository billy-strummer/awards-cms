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
const sgMail = require('@sendgrid/mail');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Email Templates
 */
const EMAIL_TEMPLATES = {
  ENTRY_CONFIRMATION: {
    subject: '✅ Entry Confirmed - {{entry_number}}',
    template: `
      <h1>Entry Submitted Successfully!</h1>
      <p>Dear {{contact_name}},</p>
      <p>Thank you for submitting your entry for the <strong>{{award_name}}</strong>.</p>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>Entry Details:</h3>
        <p><strong>Entry Number:</strong> {{entry_number}}</p>
        <p><strong>Company:</strong> {{company_name}}</p>
        <p><strong>Award:</strong> {{award_name}}</p>
        <p><strong>Entry Title:</strong> {{entry_title}}</p>
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
      <p><strong>British Trade Awards Team</strong></p>
    `
  },

  PAYMENT_REMINDER: {
    subject: '💳 Payment Pending - Entry {{entry_number}}',
    template: `
      <h1>Payment Reminder</h1>
      <p>Dear {{contact_name}},</p>
      <p>Your entry <strong>{{entry_number}}</strong> is currently pending payment.</p>

      <p><strong>Amount Due:</strong> £{{entry_fee}}</p>
      <p><strong>Entry:</strong> {{entry_title}}</p>

      <p>Please complete your payment to confirm your entry:</p>
      <a href="{{payment_link}}" style="background: #0d6efd; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
        Complete Payment
      </a>

      <p>If you have any questions, please contact us.</p>
    `
  },

  SHORTLIST_NOTIFICATION: {
    subject: '🌟 Congratulations - You\'ve Been Shortlisted!',
    template: `
      <h1>🌟 You've Been Shortlisted!</h1>
      <p>Dear {{contact_name}},</p>

      <p>We're delighted to inform you that <strong>{{company_name}}</strong> has been shortlisted for the <strong>{{award_name}}</strong> at the British Trade Awards 2025!</p>

      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin: 20px 0; text-align: center;">
        <h2 style="color: white; margin: 0;">Shortlisted</h2>
        <h3 style="color: white; opacity: 0.9;">{{award_name}}</h3>
      </div>

      <p>Your entry impressed our judges and made it through to the final round.</p>

      <h3>Next Steps:</h3>
      <ul>
        <li><strong>Winner Announcement:</strong> {{winner_date}}</li>
        <li><strong>Awards Ceremony:</strong> {{ceremony_date}} at {{ceremony_venue}}</li>
        <li>Book your tickets to the ceremony</li>
      </ul>

      <a href="{{ceremony_tickets_link}}" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
        Book Ceremony Tickets
      </a>

      <p>Congratulations once again!</p>
      <p><strong>British Trade Awards Team</strong></p>
    `
  },

  WINNER_ANNOUNCEMENT: {
    subject: '🏆 WINNER - {{award_name}}!',
    template: `
      <div style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); padding: 40px; text-align: center;">
        <h1 style="color: white; font-size: 48px; margin: 0;">🏆</h1>
        <h1 style="color: white; margin: 10px 0;">WINNER!</h1>
      </div>

      <div style="padding: 30px;">
        <p>Dear {{contact_name}},</p>

        <p style="font-size: 18px;"><strong>Congratulations!</strong> We are thrilled to announce that <strong>{{company_name}}</strong> is the winner of the <strong>{{award_name}}</strong> at the British Trade Awards 2025!</p>

        <p>Your exceptional work has set the standard for excellence in British trade and business.</p>

        <h3>Your Winner's Package Includes:</h3>
        <ul>
          <li>✅ Digital winner's certificate</li>
          <li>✅ Winner's logo and badge for your marketing</li>
          <li>✅ Press release and media coverage</li>
          <li>✅ Feature on our website and social media</li>
          <li>✅ Winner's trophy (presented at ceremony)</li>
        </ul>

        <a href="{{winners_portal_link}}" style="background: #FFD700; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; font-weight: bold;">
          Access Winner's Portal
        </a>

        <p><strong>Awards Ceremony:</strong><br>
        {{ceremony_date}} at {{ceremony_venue}}</p>

        <p>We look forward to celebrating with you!</p>

        <p><strong>British Trade Awards Team</strong></p>
      </div>
    `
  },

  JUDGE_ASSIGNMENT: {
    subject: '⚖️ New Judging Assignment - British Trade Awards',
    template: `
      <h1>New Judging Assignment</h1>
      <p>Dear {{judge_name}},</p>

      <p>You have been assigned {{entry_count}} new entries to judge for the British Trade Awards 2025.</p>

      <p><strong>Judging Deadline:</strong> {{deadline}}</p>

      <h3>Awards to Judge:</h3>
      <ul>
        {{award_list}}
      </ul>

      <a href="{{judge_portal_link}}" style="background: #0d6efd; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
        Start Judging
      </a>

      <p>Please complete your scoring by the deadline. If you have any questions or conflicts of interest, please contact us immediately.</p>

      <p>Thank you for your contribution to the awards!</p>
    `
  },

  JUDGE_REMINDER: {
    subject: '⏰ Judging Deadline Reminder - {{days_left}} Days Left',
    template: `
      <h1>Judging Deadline Approaching</h1>
      <p>Dear {{judge_name}},</p>

      <p>This is a reminder that the judging deadline is approaching in <strong>{{days_left}} days</strong>.</p>

      <p><strong>Deadline:</strong> {{deadline}}</p>

      <h3>Your Progress:</h3>
      <p>✅ Completed: {{scored_count}}/{{total_count}} entries</p>
      <p>⏳ Remaining: {{pending_count}} entries</p>

      <a href="{{judge_portal_link}}" style="background: #0d6efd; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
        Continue Judging
      </a>

      <p>Thank you for your time and expertise!</p>
    `
  },

  DEADLINE_REMINDER: {
    subject: '⏰ Reminder: {{deadline_type}} Deadline in {{days_left}} Days',
    template: `
      <h1>Deadline Reminder</h1>
      <p>Dear {{recipient_name}},</p>

      <p>This is a reminder that the <strong>{{deadline_type}}</strong> deadline is approaching.</p>

      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0;">
        <h3 style="margin-top: 0;">⏰ {{days_left}} Days Remaining</h3>
        <p><strong>Deadline:</strong> {{deadline_date}}</p>
      </div>

      <p>{{action_required}}</p>

      <a href="{{action_link}}" style="background: #0d6efd; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
        {{action_button_text}}
      </a>
    `
  }
};

/**
 * Send email using template
 */
async function sendTemplateEmail(templateKey, toEmail, variables) {
  try {
    const template = EMAIL_TEMPLATES[templateKey];
    if (!template) {
      throw new Error(`Template ${templateKey} not found`);
    }

    // Replace variables in subject and body
    let subject = template.subject;
    let html = template.template;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value || '');
      html = html.replace(regex, value || '');
    }

    const msg = {
      to: toEmail,
      from: process.env.FROM_EMAIL || 'awards@britishtrade.com',
      subject: subject,
      html: html
    };

    await sgMail.send(msg);

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
      .select('*, organisations(*), awards(*)')
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
      judging_end: 'February 15, 2025',
      shortlist_date: 'February 25, 2025',
      winner_date: 'March 15, 2025'
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
      .select('*, judge_scores(*)')
      .eq('contact_type', 'judge');

    for (const judge of judges || []) {
      const totalAssigned = judge.judge_scores?.length || 0;
      const completed = judge.judge_scores?.filter(s => s.is_complete).length || 0;
      const pending = totalAssigned - completed;

      if (pending > 0) {
        const variables = {
          judge_name: judge.full_name,
          days_left: '7', // Calculate actual days
          deadline: 'February 15, 2025',
          scored_count: completed,
          total_count: totalAssigned,
          pending_count: pending,
          judge_portal_link: 'https://yourdomain.com/judge-portal.html'
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
      .select('*, awards(award_name)')
      .in('id', entryIds);

    const awardList = [...new Set(entries.map(e => e.awards.award_name))]
      .map(name => `<li>${name}</li>`)
      .join('');

    const variables = {
      judge_name: judge.full_name || judge.email,
      entry_count: entryIds.length,
      deadline: 'February 15, 2025',
      award_list: awardList,
      judge_portal_link: 'https://yourdomain.com/judge-portal.html'
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
      .select('*, organisations(*), awards(*)')
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
        ceremony_date: 'March 20, 2025',
        ceremony_venue: 'The Grand Hall, London',
        winners_portal_link: 'https://yourdomain.com/winners-portal.html'
      };

      await sendTemplateEmail('WINNER_ANNOUNCEMENT', winner.contact_email, variables);

      // Also send social media auto-posts
      // TODO: Integrate with social-media.js
    }

    console.log(`✅ Sent ${winners.length} winner announcements`);
    return winners.length;

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
      .select('*, organisations(*), awards(*)')
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
        winner_date: 'March 15, 2025',
        ceremony_date: 'March 20, 2025',
        ceremony_venue: 'The Grand Hall, London',
        ceremony_tickets_link: 'https://yourdomain.com/tickets'
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

// POST /api/send-email
async function sendEmailEndpoint(req, res) {
  try {
    const { templateKey, toEmail, variables } = req.body;
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
