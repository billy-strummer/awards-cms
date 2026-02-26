-- ============================================
-- UPDATE EMAIL HEADER TO EXACT WEBSITE REPLICA
-- ============================================
-- Matches the header in submit-entry.html exactly:
--   - Padding: 35px 40px (was 28px 32px)
--   - Logo height: 100px (was 80px)
--   - Heading font-size: 28px (was 22px), font-weight: 900
--   - Heading text-shadow: 0 2px 8px rgba(0,0,0,0.5)
--   - Subtitle font-size: 14px (was 12px), opacity: 0.95
--   - Outer card: border-radius 16px, 2px gold border,
--     gold box-shadow matching the website card
--
-- The subtitle text is dynamic per email type (e.g.
-- "Self-Nomination Entry Confirmation" for entry emails).
--
-- CANONICAL SOURCE: api/email-header.js
-- ============================================

CREATE OR REPLACE FUNCTION send_entry_confirmation_email(p_entry_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_entry RECORD;
  v_brand RECORD;
  v_subject TEXT;
  v_html TEXT;
  v_award_name TEXT;
  v_sector TEXT;
  v_region TEXT;
  v_result JSONB;
  v_company_name TEXT := '';
  v_brand_name TEXT;
  v_primary_color TEXT;
  v_secondary_color TEXT;
  v_accent_color TEXT;
  v_contact_email TEXT;
  v_logo_url TEXT;
  v_header_html TEXT;
  v_from_address TEXT;
  v_reply_to TEXT;
  v_website_url TEXT;
BEGIN
  -- Fetch entry
  SELECT * INTO v_entry FROM entries WHERE id = p_entry_id;
  IF v_entry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entry not found');
  END IF;

  -- Only allow sending for entries created in the last 24 hours (anti-abuse)
  IF v_entry.created_at < NOW() - INTERVAL '24 hours' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Confirmation can only be sent for recent entries');
  END IF;

  -- Require a contact email
  IF v_entry.contact_email IS NULL OR v_entry.contact_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No contact email on entry');
  END IF;

  -- Load tenant branding (fall back to defaults if not configured)
  SELECT * INTO v_brand FROM tenant_branding WHERE tenant_id = 'default' LIMIT 1;

  v_brand_name      := COALESCE(NULLIF(v_brand.company_name, ''), 'British Trade Awards');
  v_primary_color   := COALESCE(v_brand.primary_color, '#000000');
  v_secondary_color := COALESCE(v_brand.secondary_color, '#1a1a1a');
  v_accent_color    := COALESCE(v_brand.accent_color, '#D4AF37');
  v_contact_email   := COALESCE(NULLIF(v_brand.email_from, ''), NULLIF(v_brand.email_reply_to, ''));
  v_logo_url        := COALESCE(v_brand.logo_url, '');
  v_reply_to        := COALESCE(NULLIF(v_brand.email_reply_to, ''), v_contact_email);
  v_website_url     := COALESCE(NULLIF(v_brand.custom_domain, ''), '');

  -- Build from address using branding
  IF v_contact_email IS NOT NULL AND v_contact_email != '' THEN
    v_from_address := v_brand_name || ' <' || v_contact_email || '>';
  ELSE
    v_from_address := NULL; -- let send_single_email use its default
  END IF;

  -- Use direct columns from entry first (migration 030+)
  v_award_name := COALESCE(v_entry.award_category, '');
  v_sector := COALESCE(v_entry.sector, '');
  v_region := COALESCE(v_entry.region, '');

  -- Fetch organisation for company name
  IF v_entry.organisation_id IS NOT NULL THEN
    SELECT company_name INTO v_company_name
      FROM organisations WHERE id = v_entry.organisation_id;
  END IF;

  -- If direct columns are empty, try award record
  IF (v_award_name = '' OR v_sector = '' OR v_region = '') AND v_entry.award_id IS NOT NULL THEN
    SELECT
      COALESCE(NULLIF(v_award_name, ''), award_name),
      COALESCE(NULLIF(v_sector, ''), sector),
      COALESCE(NULLIF(v_region, ''), county)
    INTO v_award_name, v_sector, v_region
    FROM award_years WHERE id = v_entry.award_id;
  END IF;

  -- Last resort: extract award name from entry title
  IF v_award_name = '' THEN
    IF v_entry.entry_title LIKE '%-%' THEN
      v_award_name := TRIM(SUBSTRING(v_entry.entry_title FROM POSITION(' - ' IN v_entry.entry_title) + 3));
    ELSE
      v_award_name := COALESCE(v_entry.entry_title, '');
    END IF;
  END IF;

  -- Build subject using brand name
  v_subject := 'Entry Received - ' || COALESCE(v_entry.entry_number, '') || ' | ' || v_brand_name;

  -- -------------------------------------------------------
  -- Build header: exact replica of submit-entry.html header
  -- Padding 35px 40px, logo 100px, heading 28px weight 900,
  -- text-shadow, subtitle 14px weight 300 opacity 0.95
  -- -------------------------------------------------------
  IF v_logo_url != '' THEN
    v_header_html := '<div style="background:linear-gradient(135deg,' || v_primary_color || ' 0%,' || v_secondary_color || ' 100%);padding:35px 40px;text-align:center;border-bottom:3px solid ' || v_accent_color || ';">'
      || '<table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>'
      || '<td style="vertical-align:middle;padding-right:25px;">'
      || '<img src="' || v_logo_url || '" alt="' || v_brand_name || '" style="height:100px;width:auto;display:block;">'
      || '</td>'
      || '<td style="vertical-align:middle;">'
      || '<h1 style="color:' || v_accent_color || ';margin:0;font-size:28px;font-family:Georgia,''Times New Roman'',serif;font-weight:900;letter-spacing:3px;text-transform:uppercase;line-height:1.3;text-shadow:0 2px 8px rgba(0,0,0,0.5);">' || v_brand_name || '</h1>'
      || '<p style="color:' || v_accent_color || ';margin:5px 0 0;font-size:14px;font-family:Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;opacity:0.95;font-weight:300;">Self-Nomination Entry Confirmation</p>'
      || '</td>'
      || '</tr></table>'
      || '</div>';
  ELSE
    v_header_html := '<div style="background:linear-gradient(135deg,' || v_primary_color || ' 0%,' || v_secondary_color || ' 100%);padding:35px 40px;text-align:center;border-bottom:3px solid ' || v_accent_color || ';">'
      || '<h1 style="color:' || v_accent_color || ';margin:0;font-size:28px;font-family:Georgia,''Times New Roman'',serif;font-weight:900;letter-spacing:3px;text-transform:uppercase;text-shadow:0 2px 8px rgba(0,0,0,0.5);">' || v_brand_name || '</h1>'
      || '<p style="color:' || v_accent_color || ';margin:5px 0 0;font-size:14px;font-family:Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;opacity:0.95;font-weight:300;">Self-Nomination Entry Confirmation</p>'
      || '</div>';
  END IF;

  -- Build HTML email using branding colours and name
  -- Outer card: border-radius 16px, 2px gold border, gold box-shadow (matches website)
  v_html := '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>'
    || '<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;">'
    || '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f7;"><tr><td align="center" style="padding:30px 20px;">'
    || '<table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;border:2px solid ' || v_accent_color || ';box-shadow:0 20px 60px rgba(212,175,55,0.3);">'
    -- Header (branded, matching website)
    || '<tr><td>' || v_header_html || '</td></tr>'
    -- Body
    || '<tr><td style="padding:32px;color:#333;line-height:1.6;font-size:15px;font-family:Arial,Helvetica,sans-serif;">'
    || '<h2 style="color:#1a1a1a;margin-top:0;font-family:Georgia,''Times New Roman'',serif;">Entry Confirmation</h2>'
    || '<p>Dear ' || COALESCE(v_entry.contact_name, 'Applicant') || ',</p>'
    || '<p>Thank you for entering the ' || v_brand_name || '. We are pleased to confirm that your entry has been received and is now being processed.</p>'
    -- Entry details box (accent colour)
    || '<div style="background:#fffdf5;border-left:4px solid ' || v_accent_color || ';padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0;">'
    || '<h3 style="margin:0 0 12px;color:#1a1a1a;font-size:16px;font-family:Georgia,''Times New Roman'',serif;">Your Entry Details</h3>'
    || '<table style="width:100%;font-size:14px;border-collapse:collapse;">'
    || '<tr><td style="padding:4px 8px;color:#6c757d;width:120px;">Reference:</td><td style="padding:4px 8px;font-weight:600;">' || COALESCE(v_entry.entry_number, 'N/A') || '</td></tr>'
    || '<tr><td style="padding:4px 8px;color:#6c757d;">Company:</td><td style="padding:4px 8px;">' || COALESCE(v_company_name, '') || '</td></tr>'
    || '<tr><td style="padding:4px 8px;color:#6c757d;">Category:</td><td style="padding:4px 8px;">' || v_award_name || '</td></tr>';

  IF v_sector != '' THEN
    v_html := v_html || '<tr><td style="padding:4px 8px;color:#6c757d;">Sector:</td><td style="padding:4px 8px;">' || v_sector || '</td></tr>';
  END IF;
  IF v_region != '' THEN
    v_html := v_html || '<tr><td style="padding:4px 8px;color:#6c757d;">Region:</td><td style="padding:4px 8px;">' || v_region || '</td></tr>';
  END IF;

  v_html := v_html
    || '</table></div>'
    -- What happens next
    || '<h3 style="color:#1a1a1a;font-size:16px;font-family:Georgia,''Times New Roman'',serif;">What Happens Next</h3>'
    || '<ol style="padding-left:20px;">'
    || '<li style="margin-bottom:8px;">Our team will review your entry to ensure all details are complete.</li>'
    || '<li style="margin-bottom:8px;">You may upload supporting documents (case studies, images, testimonials) using the link below.</li>'
    || '<li style="margin-bottom:8px;">Shortlisted entries will be assessed by our independent judging panel.</li>'
    || '<li style="margin-bottom:8px;">Winners will be announced at the awards ceremony.</li>'
    || '</ol>'
    || '<p>Please keep your entry reference number <strong>' || COALESCE(v_entry.entry_number, '') || '</strong> safe for future correspondence.</p>';

  -- Contact line: use branded email if available
  IF v_contact_email IS NOT NULL AND v_contact_email != '' THEN
    v_html := v_html || '<p>If you have any questions, please contact us at <a href="mailto:' || v_contact_email || '" style="color:' || v_accent_color || ';">' || v_contact_email || '</a></p>';
  END IF;

  v_html := v_html
    || '<p style="margin-top:24px;">Kind regards,<br><strong>The ' || v_brand_name || ' Team</strong></p>'
    || '</td></tr>'
    -- Footer (dark, matching header)
    || '<tr><td style="background:' || v_secondary_color || ';padding:24px 32px;text-align:center;font-size:12px;color:#999;">';

  -- Footer content: website link if configured, otherwise just brand name
  IF v_website_url != '' THEN
    v_html := v_html || '<p style="margin:0;">' || v_brand_name || ' | <a href="https://' || v_website_url || '" style="color:' || v_accent_color || ';text-decoration:none;">' || v_website_url || '</a></p>';
  ELSE
    v_html := v_html || '<p style="margin:0;">' || v_brand_name || '</p>';
  END IF;

  v_html := v_html || '</td></tr></table></td></tr></table></body></html>';

  -- Send via existing send_single_email function, passing branded from/reply-to
  v_result := send_single_email(v_entry.contact_email, v_subject, v_html, v_from_address, v_reply_to);

  -- Log the email
  BEGIN
    INSERT INTO email_log (recipient_email, subject, status, created_at)
    VALUES (v_entry.contact_email, v_subject, 'sent', NOW());
  EXCEPTION WHEN OTHERS THEN
    -- Logging failure should not block the response
    NULL;
  END;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants (same as original)
GRANT EXECUTE ON FUNCTION send_entry_confirmation_email(UUID) TO anon;
GRANT EXECUTE ON FUNCTION send_entry_confirmation_email(UUID) TO authenticated;

-- Update the editable email header template to match the website
UPDATE email_templates
SET body = '<div style="background:linear-gradient(135deg,{PRIMARY_COLOR} 0%,{SECONDARY_COLOR} 100%);padding:35px 40px;text-align:center;border-bottom:3px solid {ACCENT_COLOR};">
  <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
    <td style="vertical-align:middle;padding-right:25px;">
      <img src="{LOGO_URL}" alt="{BRAND_NAME}" style="height:100px;width:auto;display:block;">
    </td>
    <td style="vertical-align:middle;">
      <h1 style="color:{ACCENT_COLOR};margin:0;font-size:28px;font-family:Georgia,''Times New Roman'',serif;font-weight:900;letter-spacing:3px;text-transform:uppercase;line-height:1.3;text-shadow:0 2px 8px rgba(0,0,0,0.5);">{BRAND_NAME}</h1>
      <p style="color:{ACCENT_COLOR};margin:5px 0 0;font-size:14px;font-family:Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;opacity:0.95;font-weight:300;">{HEADER_SUBTITLE}</p>
    </td>
  </tr></table>
</div>',
    updated_at = NOW()
WHERE template_name = 'Auto Email Header'
  AND template_type = 'email_header';
