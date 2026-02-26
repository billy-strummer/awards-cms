-- ============================================
-- EDITABLE EMAIL HEADER & FOOTER TEMPLATES
-- ============================================
-- Stores the email header and footer as editable templates
-- in the email_templates table. Admins can customise them
-- from the CMS Email Templates section.
--
-- Branding placeholders are replaced at send time with
-- values from the tenant_branding table:
--   {BRAND_NAME}      → company_name
--   {PRIMARY_COLOR}   → primary_color
--   {SECONDARY_COLOR} → secondary_color
--   {ACCENT_COLOR}    → accent_color
--   {LOGO_URL}        → logo_url
--   {CONTACT_EMAIL}   → email_from / email_reply_to
--   {WEBSITE_URL}     → custom_domain
-- ============================================

-- Email Header template
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
  'Auto Email Header',
  'email_header',
  '(system)',
  '<div style="background:linear-gradient(135deg,{PRIMARY_COLOR} 0%,{SECONDARY_COLOR} 100%);padding:28px 32px;text-align:center;border-bottom:3px solid {ACCENT_COLOR};">
  <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
    <td style="vertical-align:middle;padding-right:25px;">
      <img src="{LOGO_URL}" alt="{BRAND_NAME}" style="height:80px;width:auto;display:block;">
    </td>
    <td style="vertical-align:middle;">
      <h1 style="color:{ACCENT_COLOR};margin:0;font-size:22px;font-family:Georgia,''Times New Roman'',serif;letter-spacing:3px;text-transform:uppercase;line-height:1.3;">{BRAND_NAME}</h1>
      <p style="color:{ACCENT_COLOR};margin:5px 0 0;font-size:12px;font-family:Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;opacity:0.9;font-weight:300;">Self-Nomination Entry Confirmation</p>
    </td>
  </tr></table>
</div>',
  true,
  true,
  'Branded header shown at the top of every automated email. Uses branding placeholders.',
  ARRAY['BRAND_NAME', 'PRIMARY_COLOR', 'SECONDARY_COLOR', 'ACCENT_COLOR', 'LOGO_URL']
) ON CONFLICT (template_name) DO NOTHING;

-- Email Footer template
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
  'Auto Email Footer',
  'email_footer',
  '(system)',
  '<div style="background:{SECONDARY_COLOR};padding:24px 32px;text-align:center;font-size:12px;color:#999;">
  <p style="margin:0;">{BRAND_NAME} | <a href="mailto:{CONTACT_EMAIL}" style="color:{ACCENT_COLOR};text-decoration:none;">{CONTACT_EMAIL}</a></p>
</div>',
  true,
  true,
  'Branded footer shown at the bottom of every automated email. Uses branding placeholders.',
  ARRAY['BRAND_NAME', 'SECONDARY_COLOR', 'ACCENT_COLOR', 'CONTACT_EMAIL', 'WEBSITE_URL']
) ON CONFLICT (template_name) DO NOTHING;
