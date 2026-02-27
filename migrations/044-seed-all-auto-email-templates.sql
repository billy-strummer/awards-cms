-- ============================================
-- 044 - Seed all automated email templates
-- ============================================
-- Every auto-generated email now has an editable template in the CMS.
-- Sending functions load from email_templates first, falling back to
-- hardcoded defaults only when no active template is found.

-- Payment Confirmation (after successful Stripe payment)
INSERT INTO email_templates (
  template_name, template_type, subject, body,
  is_active, is_default, description, available_placeholders
) VALUES (
  'Payment Confirmation',
  'payment_confirmation',
  'Entry Confirmed: {ENTRY_NUMBER} - British Trade Awards',
  'Dear {CONTACT_NAME},

Thank you for your entry! Your entry {ENTRY_NUMBER} has been received and payment confirmed.

Entry: {ENTRY_TITLE}
Company: {COMPANY_NAME}

You can upload supporting documents at:
{UPLOAD_LINK}

We will be in touch with next steps. Good luck!

Kind regards,
The British Trade Awards Team',
  true, true,
  'Sent automatically after successful payment via Stripe',
  ARRAY['ENTRY_NUMBER', 'CONTACT_NAME', 'COMPANY_NAME', 'ENTRY_TITLE', 'UPLOAD_LINK']
) ON CONFLICT (template_name) DO NOTHING;

-- Payment Failed
INSERT INTO email_templates (
  template_name, template_type, subject, body,
  is_active, is_default, description, available_placeholders
) VALUES (
  'Payment Failed',
  'payment_failed',
  'Payment Issue: {ENTRY_NUMBER} - British Trade Awards',
  'Dear {CONTACT_NAME},

We were unable to process payment for entry {ENTRY_NUMBER}.

Reason: {ERROR_MESSAGE}

Please try again or contact us for assistance at {CONTACT_EMAIL}

Kind regards,
The British Trade Awards Team',
  true, true,
  'Sent automatically when a Stripe payment fails',
  ARRAY['ENTRY_NUMBER', 'CONTACT_NAME', 'COMPANY_NAME', 'ERROR_MESSAGE', 'CONTACT_EMAIL']
) ON CONFLICT (template_name) DO NOTHING;

-- Refund Confirmation
INSERT INTO email_templates (
  template_name, template_type, subject, body,
  is_active, is_default, description, available_placeholders
) VALUES (
  'Refund Confirmation',
  'refund_confirmation',
  'Refund Processed: {ENTRY_NUMBER} - British Trade Awards',
  'Dear {CONTACT_NAME},

A refund has been processed for entry {ENTRY_NUMBER}.

The refund should appear on your statement within 5-10 business days.

If you have any questions, please contact us at {CONTACT_EMAIL}

Kind regards,
The British Trade Awards Team',
  true, true,
  'Sent automatically when a Stripe refund is processed',
  ARRAY['ENTRY_NUMBER', 'CONTACT_NAME', 'COMPANY_NAME', 'CONTACT_EMAIL']
) ON CONFLICT (template_name) DO NOTHING;

-- Winner Announcement
INSERT INTO email_templates (
  template_name, template_type, subject, body,
  is_active, is_default, description, available_placeholders
) VALUES (
  'Winner Announcement',
  'winner_announcement',
  'WINNER - {AWARD_NAME}!',
  'Dear {CONTACT_NAME},

Congratulations! We are thrilled to announce that {COMPANY_NAME} is the winner of the {AWARD_NAME} at the British Trade Awards!

Your exceptional work has set the standard for excellence.

Your Winner''s Package Includes:
- Digital winner''s certificate
- Winner''s logo and badge for your marketing
- Press release and media coverage
- Feature on our website and social media
- Winner''s trophy (presented at ceremony)

Awards Ceremony: {CEREMONY_DATE} at {CEREMONY_VENUE}

We look forward to celebrating with you!

Kind regards,
The British Trade Awards Team',
  true, true,
  'Sent to winners when results are announced',
  ARRAY['CONTACT_NAME', 'COMPANY_NAME', 'AWARD_NAME', 'CEREMONY_DATE', 'CEREMONY_VENUE', 'WINNERS_PORTAL_LINK']
) ON CONFLICT (template_name) DO NOTHING;

-- Payment Reminder
INSERT INTO email_templates (
  template_name, template_type, subject, body,
  is_active, is_default, description, available_placeholders
) VALUES (
  'Payment Reminder',
  'payment_reminder',
  'Payment Pending - Entry {ENTRY_NUMBER}',
  'Dear {CONTACT_NAME},

Your entry {ENTRY_NUMBER} is currently pending payment.

Amount Due: £{ENTRY_FEE}
Entry: {ENTRY_TITLE}

Please complete your payment to confirm your entry:
{PAYMENT_LINK}

If you have any questions, please contact us at {CONTACT_EMAIL}

Kind regards,
The British Trade Awards Team',
  true, true,
  'Sent as a reminder when an entry fee is outstanding',
  ARRAY['ENTRY_NUMBER', 'CONTACT_NAME', 'COMPANY_NAME', 'ENTRY_TITLE', 'ENTRY_FEE', 'PAYMENT_LINK', 'CONTACT_EMAIL']
) ON CONFLICT (template_name) DO NOTHING;

-- Judge Assignment
INSERT INTO email_templates (
  template_name, template_type, subject, body,
  is_active, is_default, description, available_placeholders
) VALUES (
  'Judge Assignment',
  'judge_assignment',
  'New Judging Assignment - British Trade Awards',
  'Dear {JUDGE_NAME},

You have been assigned {ENTRY_COUNT} new entries to judge for the British Trade Awards.

Judging Deadline: {DEADLINE}

Please log in to the Judge Portal to begin scoring:
{JUDGE_PORTAL_LINK}

Please complete your scoring by the deadline. If you have any questions or conflicts of interest, please contact us immediately.

Thank you for your contribution to the awards!

Kind regards,
The British Trade Awards Team',
  true, true,
  'Sent when entries are assigned to a judge for scoring',
  ARRAY['JUDGE_NAME', 'ENTRY_COUNT', 'DEADLINE', 'JUDGE_PORTAL_LINK']
) ON CONFLICT (template_name) DO NOTHING;

-- Judge Reminder
INSERT INTO email_templates (
  template_name, template_type, subject, body,
  is_active, is_default, description, available_placeholders
) VALUES (
  'Judge Reminder',
  'judge_reminder',
  'Judging Deadline Reminder - {DAYS_LEFT} Days Left',
  'Dear {JUDGE_NAME},

This is a reminder that the judging deadline is approaching in {DAYS_LEFT} days.

Deadline: {DEADLINE}

Your Progress:
- Completed: {SCORED_COUNT}/{TOTAL_COUNT} entries
- Remaining: {PENDING_COUNT} entries

Please log in to the Judge Portal to continue scoring:
{JUDGE_PORTAL_LINK}

Thank you for your time and expertise!

Kind regards,
The British Trade Awards Team',
  true, true,
  'Reminder sent to judges when the scoring deadline approaches',
  ARRAY['JUDGE_NAME', 'DAYS_LEFT', 'DEADLINE', 'SCORED_COUNT', 'TOTAL_COUNT', 'PENDING_COUNT', 'JUDGE_PORTAL_LINK']
) ON CONFLICT (template_name) DO NOTHING;

-- Deadline Reminder (general)
INSERT INTO email_templates (
  template_name, template_type, subject, body,
  is_active, is_default, description, available_placeholders
) VALUES (
  'Deadline Reminder',
  'deadline_reminder',
  'Reminder: {DEADLINE_TYPE} Deadline in {DAYS_LEFT} Days',
  'Dear {RECIPIENT_NAME},

This is a reminder that the {DEADLINE_TYPE} deadline is approaching.

{DAYS_LEFT} Days Remaining
Deadline: {DEADLINE_DATE}

{ACTION_REQUIRED}

Kind regards,
The British Trade Awards Team',
  true, true,
  'General deadline reminder (entry submissions, uploads, etc.)',
  ARRAY['RECIPIENT_NAME', 'DEADLINE_TYPE', 'DAYS_LEFT', 'DEADLINE_DATE', 'ACTION_REQUIRED', 'ACTION_LINK']
) ON CONFLICT (template_name) DO NOTHING;

-- Revision / Changes Requested
INSERT INTO email_templates (
  template_name, template_type, subject, body,
  is_active, is_default, description, available_placeholders
) VALUES (
  'Changes Requested',
  'revision_request',
  'Action Required: Changes Requested - {ENTRY_TITLE}',
  'Dear {CONTACT_NAME},

Your entry {ENTRY_TITLE} ({ENTRY_NUMBER}) requires changes before it can proceed.

Feedback:
{FEEDBACK}

Please log in to review the feedback and resubmit your entry.

Kind regards,
The British Trade Awards Team',
  true, true,
  'Sent when an admin requests changes to a submitted entry',
  ARRAY['CONTACT_NAME', 'ENTRY_TITLE', 'ENTRY_NUMBER', 'FEEDBACK']
) ON CONFLICT (template_name) DO NOTHING;

-- Event Invitation
INSERT INTO email_templates (
  template_name, template_type, subject, body,
  is_active, is_default, description, available_placeholders
) VALUES (
  'Event Invitation',
  'event_invitation',
  'You''re Invited: {EVENT_NAME}',
  'Dear {CONTACT_NAME},

You are cordially invited to attend the {EVENT_NAME}.

Date: {EVENT_DATE}
Venue: {VENUE}

We would be honoured by your presence at this special occasion.

Please RSVP at your earliest convenience:
{RSVP_URL}

Kind regards,
The British Trade Awards Team',
  true, true,
  'Invitation sent for awards ceremonies and other events',
  ARRAY['CONTACT_NAME', 'EVENT_NAME', 'EVENT_DATE', 'VENUE', 'RSVP_URL']
) ON CONFLICT (template_name) DO NOTHING;

-- Ticket Issued
INSERT INTO email_templates (
  template_name, template_type, subject, body,
  is_active, is_default, description, available_placeholders
) VALUES (
  'Ticket Issued',
  'ticket_issued',
  'Your Ticket: {EVENT_NAME}',
  'Dear {CONTACT_NAME},

Your ticket for {EVENT_NAME} has been issued.

Ticket Number: {TICKET_NUMBER}
Date: {EVENT_DATE}
Venue: {VENUE}

Please present this ticket at check-in.

Kind regards,
The British Trade Awards Team',
  true, true,
  'Sent when an event ticket is issued to an attendee',
  ARRAY['CONTACT_NAME', 'EVENT_NAME', 'TICKET_NUMBER', 'EVENT_DATE', 'VENUE']
) ON CONFLICT (template_name) DO NOTHING;
