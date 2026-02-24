-- ============================================
-- EMAIL TEMPLATES - DATABASE SCHEMA
-- ============================================

-- Table: email_templates
-- Store customizable email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name VARCHAR(255) UNIQUE NOT NULL,
  template_type VARCHAR(100) NOT NULL, -- confirmation, reminder, approval, rejection, etc.
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255),
  last_modified_by VARCHAR(255),

  -- Template info
  description TEXT,
  available_placeholders TEXT[] -- Array of available placeholders for this template
);

-- Insert default confirmation email template
INSERT INTO email_templates (
  template_name,
  template_type,
  subject,
  body,
  is_active,
  is_default,
  description,
  available_placeholders
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
  true,
  true,
  'Default confirmation email sent when an entry is submitted',
  ARRAY['ENTRY_NUMBER', 'CONTACT_NAME', 'COMPANY_NAME', 'AWARD_NAME', 'SECTOR', 'REGION', 'UPLOAD_LINK', 'DEADLINE_DATE', 'ANNOUNCEMENT_DATE', 'CONTACT_EMAIL']
) ON CONFLICT (template_name) DO NOTHING;

-- Insert document upload reminder template
INSERT INTO email_templates (
  template_name,
  template_type,
  subject,
  body,
  is_active,
  is_default,
  description,
  available_placeholders
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
  true,
  false,
  'Reminder email for entries missing supporting documents',
  ARRAY['ENTRY_NUMBER', 'CONTACT_NAME', 'COMPANY_NAME', 'AWARD_NAME', 'UPLOAD_LINK', 'DEADLINE_DATE', 'CONTACT_EMAIL']
) ON CONFLICT (template_name) DO NOTHING;

-- Insert approval notification template
INSERT INTO email_templates (
  template_name,
  template_type,
  subject,
  body,
  is_active,
  is_default,
  description,
  available_placeholders
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
  true,
  false,
  'Notification sent when entry is approved/shortlisted',
  ARRAY['ENTRY_NUMBER', 'CONTACT_NAME', 'COMPANY_NAME', 'AWARD_NAME', 'ANNOUNCEMENT_DATE']
) ON CONFLICT (template_name) DO NOTHING;

-- Insert rejection notification template
INSERT INTO email_templates (
  template_name,
  template_type,
  subject,
  body,
  is_active,
  is_default,
  description,
  available_placeholders
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
  true,
  false,
  'Notification sent when entry is not shortlisted',
  ARRAY['ENTRY_NUMBER', 'CONTACT_NAME', 'COMPANY_NAME', 'AWARD_NAME']
) ON CONFLICT (template_name) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);

-- Comments
COMMENT ON TABLE email_templates IS 'Customizable email templates for automated communications';
COMMENT ON COLUMN email_templates.available_placeholders IS 'Array of placeholder variables that can be used in this template';
