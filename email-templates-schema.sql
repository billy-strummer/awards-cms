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
  'British Trade Awards - Entry Received ({ENTRY_NUMBER})',
  'Dear {CONTACT_NAME},

Thank you for submitting your entry to the British Trade Awards!

Entry Details:
- Entry Number: {ENTRY_NUMBER}
- Company: {COMPANY_NAME}
- Award Category: {AWARD_NAME}
- Sector: {SECTOR}
- Region: {REGION}

Next Steps:
To complete your entry, please upload your supporting documents using the link below:

{UPLOAD_LINK}

What to upload:
- Supporting documents (PDF, Word, Excel)
- Images (JPG, PNG)
- Case studies or presentations
- Any other relevant materials

Maximum file size: 10MB per file

Important Dates:
- Entry Deadline: {DEADLINE_DATE}
- Winners Announced: {ANNOUNCEMENT_DATE}

If you have any questions, please contact us at {CONTACT_EMAIL}

Best regards,
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
  'Reminder: Upload Supporting Documents - {ENTRY_NUMBER}',
  'Dear {CONTACT_NAME},

This is a friendly reminder that we have not yet received your supporting documents for entry {ENTRY_NUMBER}.

To complete your entry submission, please upload your documents using this link:

{UPLOAD_LINK}

Entry Details:
- Company: {COMPANY_NAME}
- Award: {AWARD_NAME}

Deadline: {DEADLINE_DATE}

If you have already uploaded your documents, please disregard this reminder.

If you need assistance, please contact us at {CONTACT_EMAIL}

Best regards,
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
  'Congratulations! Your Entry Has Been Shortlisted - {ENTRY_NUMBER}',
  'Dear {CONTACT_NAME},

We are delighted to inform you that your entry has been shortlisted for the British Trade Awards!

Entry Details:
- Entry Number: {ENTRY_NUMBER}
- Company: {COMPANY_NAME}
- Award Category: {AWARD_NAME}

What happens next:
Your entry will now be reviewed by our panel of expert judges. Winners will be announced on {ANNOUNCEMENT_DATE}.

We will be in touch with further details about the awards ceremony.

Congratulations once again on this achievement!

Best regards,
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
  'British Trade Awards Update - {ENTRY_NUMBER}',
  'Dear {CONTACT_NAME},

Thank you for taking the time to submit your entry to the British Trade Awards.

Entry Details:
- Entry Number: {ENTRY_NUMBER}
- Company: {COMPANY_NAME}
- Award Category: {AWARD_NAME}

After careful consideration by our panel of judges, we regret to inform you that your entry has not been selected for the shortlist on this occasion.

We received an exceptionally high number of entries this year, making the selection process extremely competitive.

We encourage you to enter again next year and wish you every success in the future.

Best regards,
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
