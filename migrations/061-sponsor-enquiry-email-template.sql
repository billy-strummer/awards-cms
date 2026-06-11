-- Migration 061: Seed sponsor enquiry confirmation email template (full HTML body)
-- Adds the sponsorship enquiry confirmation to the email_templates table so it
-- appears in the CMS Email Templates tab and can be edited without a code deploy.
--
-- The body is stored as raw HTML — the send path substitutes these placeholders
-- with HTML-escaped user values before sending:
--   {NAME}        – enquirer's full name
--   {COMPANY}     – company name
--   {PACKAGE}     – sponsorship package they expressed interest in
--   {ROLE_ROW}    – full <tr> HTML block for job title (or empty string if blank)
--   {MESSAGE_ROW} – full <tr> HTML block for their message (or empty string if blank)

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
  $BODY$
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111111;">

  <!-- Greeting -->
  <tr>
    <td style="padding:40px 40px 24px;">
      <p style="font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#ffffff;margin:0 0 16px;line-height:1.25;">Hi {NAME},</p>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.8;margin:0;">
        Thank you for your interest in sponsoring the <strong style="color:#ffffff;">British Trade Awards 2026</strong>.
        We&rsquo;ve received your enquiry and a member of our partnerships team will be in touch
        within <strong style="color:#C9A227;">2 business days</strong>.
      </p>
    </td>
  </tr>

  <!-- Gold rule -->
  <tr>
    <td style="padding:0 40px 28px;">
      <table width="60" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr>
      </table>
    </td>
  </tr>

  <!-- Enquiry summary card -->
  <tr>
    <td style="padding:0 40px 36px;">
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#C9A227;margin:0 0 14px;">Your Enquiry</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:10px;overflow:hidden;">
        <tr style="background:#1a1a1a;">
          <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.07);">
            <span style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.35);display:block;margin-bottom:4px;">Package</span>
            <span style="font-family:Georgia,'Times New Roman',serif;font-size:17px;color:#C9A227;font-weight:700;">{PACKAGE}</span>
          </td>
        </tr>
        <tr style="background:#161616;">
          <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.07);">
            <span style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.35);display:block;margin-bottom:4px;">Company</span>
            <span style="font-family:Arial,sans-serif;font-size:15px;color:#ffffff;">{COMPANY}</span>
          </td>
        </tr>
        {ROLE_ROW}
        {MESSAGE_ROW}
      </table>
    </td>
  </tr>

  <!-- What happens next -->
  <tr>
    <td style="padding:0 40px 36px;">
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#C9A227;margin:0 0 20px;">What Happens Next</p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
        <tr>
          <td width="40" valign="top">
            <table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:28px;height:28px;border-radius:50%;background:#C9A227;text-align:center;font-family:Georgia,serif;font-size:13px;font-weight:700;color:#000;line-height:28px;">1</td></tr></table>
          </td>
          <td valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;padding-top:4px;">
            Our partnerships team reviews your enquiry and prepares the relevant package details.
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
        <tr>
          <td width="40" valign="top">
            <table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:28px;height:28px;border-radius:50%;background:#C9A227;text-align:center;font-family:Georgia,serif;font-size:13px;font-weight:700;color:#000;line-height:28px;">2</td></tr></table>
          </td>
          <td valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;padding-top:4px;">
            We&rsquo;ll contact you within <strong style="color:#ffffff;">2 business days</strong> to discuss your goals and answer any questions.
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="40" valign="top">
            <table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:28px;height:28px;border-radius:50%;background:#C9A227;text-align:center;font-family:Georgia,serif;font-size:13px;font-weight:700;color:#000;line-height:28px;">3</td></tr></table>
          </td>
          <td valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;padding-top:4px;">
            We&rsquo;ll send a bespoke proposal tailored to your brand and marketing objectives.
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Divider -->
  <tr>
    <td style="padding:0 40px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="height:1px;background:rgba(255,255,255,0.08);"></td></tr>
      </table>
    </td>
  </tr>

  <!-- Sign-off -->
  <tr>
    <td style="padding:24px 40px 32px;">
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:rgba(255,255,255,0.4);margin:0 0 6px;">
        Questions? Simply reply to this email.
      </p>
      <p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#ffffff;margin:0;">
        The British Trade Awards Partnerships Team
      </p>
    </td>
  </tr>

  <!-- Legal note -->
  <tr>
    <td style="padding:16px 40px 28px;border-top:1px solid rgba(201,162,39,0.12);">
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:rgba(255,255,255,0.2);margin:0;line-height:1.7;">
        You&rsquo;re receiving this because you submitted a sponsorship enquiry at
        <a href="https://britishtradeawards.com/become-a-sponsor.html" style="color:rgba(201,162,39,0.4);text-decoration:none;">britishtradeawards.com</a>.
        If this wasn&rsquo;t you, you can safely ignore this message.
      </p>
    </td>
  </tr>

</table>
  $BODY$,
  'Sent automatically when someone submits the sponsorship enquiry form on become-a-sponsor.html. Body is raw HTML — edit the layout, text, and styling directly. Placeholders: {NAME} (enquirer name), {COMPANY}, {PACKAGE}, {ROLE_ROW} (full table row or empty), {MESSAGE_ROW} (full table row or empty).',
  ARRAY['{NAME}', '{COMPANY}', '{PACKAGE}', '{ROLE_ROW}', '{MESSAGE_ROW}'],
  true,
  true
)
ON CONFLICT (template_name) DO UPDATE SET
  template_type        = EXCLUDED.template_type,
  subject              = EXCLUDED.subject,
  body                 = EXCLUDED.body,
  description          = EXCLUDED.description,
  available_placeholders = EXCLUDED.available_placeholders,
  is_active            = EXCLUDED.is_active,
  is_default           = EXCLUDED.is_default;
