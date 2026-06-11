-- Migration 062: Seed Nomination Confirmation email template
-- The nomination_confirmation type was referenced in code but never seeded to the
-- database, so it did not appear in the CMS Email Templates section.

INSERT INTO email_templates (
  template_name,
  template_type,
  name,
  subject,
  body,
  description,
  available_placeholders,
  is_active,
  is_default
)
VALUES (
  'Nomination Confirmation',
  'nomination_confirmation',
  'Nomination Confirmation',
  'Nomination Received - {ENTRY_NUMBER} | British Trade Awards',
  $BODY$Dear {CONTACT_NAME},

Thank you for submitting your nomination for the British Trade Awards. We are pleased to confirm that your nomination has been received and is now being processed.

Nomination Details:
- Reference: {ENTRY_NUMBER}
- Nominee: {NOMINEE_NAME}
- Category: {AWARD_NAME}

What Happens Next:
1. Our team will review your nomination to ensure all details are complete.
2. Shortlisted nominations will be assessed by our independent judging panel.
3. Winners will be announced at the awards ceremony.

Please keep your nomination reference number {ENTRY_NUMBER} safe for future correspondence.

If you have any questions, please contact us at {CONTACT_EMAIL}

Kind regards,
The British Trade Awards Team$BODY$,
  'Sent automatically when a peer nomination is submitted via the public nomination form.',
  ARRAY['ENTRY_NUMBER', 'CONTACT_NAME', 'NOMINEE_NAME', 'AWARD_NAME', 'CONTACT_EMAIL'],
  true,
  true
)
ON CONFLICT (template_name) DO NOTHING;
