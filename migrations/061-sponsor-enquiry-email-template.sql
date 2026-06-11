-- Migration 061: Seed sponsor enquiry confirmation email template
-- Adds the sponsorship enquiry confirmation to the email_templates table so it
-- appears in the CMS Email Templates tab and can be edited without a code deploy.
--
-- Placeholders (single-brace uppercase) available in the body:
--   {NAME}     – enquirer's full name
--   {COMPANY}  – company name
--   {PACKAGE}  – sponsorship package they expressed interest in
--   {ROLE}     – their job title (may be blank)
--   {MESSAGE}  – optional message they submitted

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
  'Sponsorship Enquiry Confirmation',
  'sponsor_enquiry_confirmation',
  'Sponsorship Enquiry Confirmation',
  'Sponsorship enquiry received — British Trade Awards 2026',
  E'Hi {NAME},\n\nThank you for your interest in sponsoring the British Trade Awards 2026. We''ve received your enquiry and a member of our partnerships team will be in touch within 2 business days.\n\nPackage interest: {PACKAGE}\nCompany: {COMPANY}\n\nIf you have any questions in the meantime, simply reply to this email.\n\nThe British Trade Awards Partnerships Team',
  'Sent automatically to anyone who submits the sponsorship enquiry form on become-a-sponsor.html.',
  ARRAY['{NAME}', '{COMPANY}', '{PACKAGE}', '{ROLE}', '{MESSAGE}'],
  true,
  true
)
ON CONFLICT (template_name) DO NOTHING;
