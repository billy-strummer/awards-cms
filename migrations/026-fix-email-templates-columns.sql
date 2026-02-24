-- ============================================================
-- Migration 026: Fix email_templates column names
-- The table was created in migration 000 with 'name' but the
-- application code (email-templates.js, edge functions) expects
-- 'template_name', 'template_type', and 'available_placeholders'.
-- ============================================================

-- Add missing columns
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS template_name TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS template_type TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS available_placeholders TEXT[];
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Copy existing 'name' values into 'template_name' where missing
UPDATE email_templates
SET template_name = name
WHERE template_name IS NULL AND name IS NOT NULL;

-- Add unique constraint on template_name (required for ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_name_unique
ON email_templates(template_name);

-- Clear any old rows that have no usable name
DELETE FROM email_templates WHERE template_name IS NULL AND name IS NULL;

-- Now insert the default templates (uses ON CONFLICT to skip if already present)
INSERT INTO email_templates (
  template_name, template_type, subject, body,
  is_active, is_default, description, available_placeholders
) VALUES (
  'Entry Confirmation',
  'confirmation',
  'Entry Received - {ENTRY_NUMBER} | British Trade Awards',
  'Dear {CONTACT_NAME},

Thank you for entering the British Trade Awards. We are pleased to confirm that your entry has been received and is now being processed.

Your Entry Details:
- Entry Reference: {ENTRY_NUMBER}
- Company: {COMPANY_NAME}
- Category: {AWARD_NAME}
- Sector: {SECTOR}
- Region: {REGION}

What Happens Next:
1. Our team will review your entry to ensure all details are complete.
2. You may upload any supporting documents (case studies, images, testimonials or other materials) using the link below.
3. Shortlisted entries will be assessed by our independent judging panel.
4. Winners will be announced at the awards ceremony.

Upload Supporting Documents:
{UPLOAD_LINK}

Accepted formats: PDF, Word, Excel, JPG, PNG (max 10MB per file)

Key Dates:
- Entry Deadline: {DEADLINE_DATE}
- Winners Announced: {ANNOUNCEMENT_DATE}

Please keep your entry reference number safe for future correspondence.

If you have any questions about your entry or the awards process, please contact us at {CONTACT_EMAIL}

Kind regards,
The British Trade Awards Team',
  true, true,
  'Default confirmation email sent when an entry is submitted',
  ARRAY['ENTRY_NUMBER', 'CONTACT_NAME', 'COMPANY_NAME', 'AWARD_NAME', 'SECTOR', 'REGION', 'UPLOAD_LINK', 'DEADLINE_DATE', 'ANNOUNCEMENT_DATE', 'CONTACT_EMAIL']
) ON CONFLICT (template_name) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  template_type = EXCLUDED.template_type,
  available_placeholders = EXCLUDED.available_placeholders,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  is_default = EXCLUDED.is_default,
  updated_at = NOW();

INSERT INTO email_templates (
  template_name, template_type, subject, body,
  is_active, is_default, description, available_placeholders
) VALUES (
  'Document Upload Reminder',
  'reminder',
  'Supporting Documents Reminder - {ENTRY_NUMBER} | British Trade Awards',
  'Dear {CONTACT_NAME},

We wanted to let you know that we have not yet received any supporting documents for your British Trade Awards entry.

- Entry Reference: {ENTRY_NUMBER}
- Company: {COMPANY_NAME}
- Category: {AWARD_NAME}

While supporting documents are not mandatory, they can significantly strengthen your entry. Case studies, project images, client testimonials and accreditation certificates all help our judges assess your work.

You can upload your documents here:
{UPLOAD_LINK}

Accepted formats: PDF, Word, Excel, JPG, PNG (max 10MB per file)

The deadline for all entries and supporting materials is {DEADLINE_DATE}.

If you have already uploaded your documents, please disregard this message. If you need any assistance, please contact us at {CONTACT_EMAIL}

Kind regards,
The British Trade Awards Team',
  true, false,
  'Reminder email for entries missing supporting documents',
  ARRAY['ENTRY_NUMBER', 'CONTACT_NAME', 'COMPANY_NAME', 'AWARD_NAME', 'UPLOAD_LINK', 'DEADLINE_DATE', 'CONTACT_EMAIL']
) ON CONFLICT (template_name) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  template_type = EXCLUDED.template_type,
  available_placeholders = EXCLUDED.available_placeholders,
  description = EXCLUDED.description,
  updated_at = NOW();

INSERT INTO email_templates (
  template_name, template_type, subject, body,
  is_active, is_default, description, available_placeholders
) VALUES (
  'Entry Approved/Shortlisted',
  'approval',
  'You Have Been Shortlisted - {ENTRY_NUMBER} | British Trade Awards',
  'Dear {CONTACT_NAME},

Congratulations! We are delighted to inform you that {COMPANY_NAME} has been shortlisted in the {AWARD_NAME} category at the British Trade Awards.

- Entry Reference: {ENTRY_NUMBER}
- Company: {COMPANY_NAME}
- Category: {AWARD_NAME}

What Happens Next:
Your entry will now be assessed by our independent panel of judges. The judging process evaluates the quality of work, customer service, innovation and overall contribution to the trade industry.

Winners will be announced on {ANNOUNCEMENT_DATE}. We will be in touch with further details about the awards ceremony in due course.

This is a fantastic achievement and a testament to the quality of your work. Well done to you and your team.

Kind regards,
The British Trade Awards Team',
  true, false,
  'Notification sent when entry is approved/shortlisted',
  ARRAY['ENTRY_NUMBER', 'CONTACT_NAME', 'COMPANY_NAME', 'AWARD_NAME', 'ANNOUNCEMENT_DATE']
) ON CONFLICT (template_name) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  template_type = EXCLUDED.template_type,
  available_placeholders = EXCLUDED.available_placeholders,
  description = EXCLUDED.description,
  updated_at = NOW();

INSERT INTO email_templates (
  template_name, template_type, subject, body,
  is_active, is_default, description, available_placeholders
) VALUES (
  'Entry Not Shortlisted',
  'rejection',
  'Your Entry Update - {ENTRY_NUMBER} | British Trade Awards',
  'Dear {CONTACT_NAME},

Thank you for entering {COMPANY_NAME} into the {AWARD_NAME} category at the British Trade Awards.

- Entry Reference: {ENTRY_NUMBER}
- Company: {COMPANY_NAME}
- Category: {AWARD_NAME}

After careful consideration by our judging panel, we regret to inform you that your entry has not been selected for the shortlist on this occasion.

We received an exceptionally high standard of entries this year, making the selection process extremely competitive. Not being shortlisted is in no way a reflection on the quality of your business or the work you do.

We would very much welcome an entry from you again next year and wish you continued success.

Kind regards,
The British Trade Awards Team',
  true, false,
  'Notification sent when entry is not shortlisted',
  ARRAY['ENTRY_NUMBER', 'CONTACT_NAME', 'COMPANY_NAME', 'AWARD_NAME']
) ON CONFLICT (template_name) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  template_type = EXCLUDED.template_type,
  available_placeholders = EXCLUDED.available_placeholders,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Keep name column in sync with template_name
UPDATE email_templates
SET name = template_name
WHERE name IS NULL AND template_name IS NOT NULL;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
