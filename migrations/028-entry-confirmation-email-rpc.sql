-- ============================================
-- ENTRY CONFIRMATION EMAIL VIA RPC
-- ============================================
-- Replaces the Supabase Edge Function approach with a
-- database RPC function using the existing send_single_email
-- infrastructure (pg_net + Resend).
--
-- The public entry form calls:
--   supabase.rpc('send_entry_confirmation_email', { p_entry_id: '...' })

-- ============================================
-- 1. ENTRY CONFIRMATION EMAIL FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION send_entry_confirmation_email(p_entry_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_entry RECORD;
  v_subject TEXT;
  v_html TEXT;
  v_award_name TEXT;
  v_sector TEXT;
  v_region TEXT;
  v_result JSONB;
  v_company_name TEXT := '';
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

  -- Fetch organisation (use direct variable assignment to avoid unassigned record issues)
  IF v_entry.organisation_id IS NOT NULL THEN
    SELECT company_name, sector, region
      INTO v_company_name, v_sector, v_region
      FROM organisations WHERE id = v_entry.organisation_id;
  END IF;
  v_sector := COALESCE(v_sector, '');
  v_region := COALESCE(v_region, '');

  -- Fetch award if linked (override sector/region with award values if available)
  IF v_entry.award_id IS NOT NULL THEN
    SELECT award_name, sector, county
      INTO v_award_name, v_sector, v_region
      FROM awards WHERE id = v_entry.award_id;
  END IF;
  v_award_name := COALESCE(v_award_name, '');

  -- Fallback: extract award name from entry title if not set via award record
  IF v_award_name = '' THEN
    IF v_entry.entry_title LIKE '%-%' THEN
      v_award_name := TRIM(SUBSTRING(v_entry.entry_title FROM POSITION(' - ' IN v_entry.entry_title) + 3));
    ELSE
      v_award_name := COALESCE(v_entry.entry_title, '');
    END IF;
  END IF;

  -- Build subject
  v_subject := 'Entry Received - ' || COALESCE(v_entry.entry_number, '') || ' | British Trade Awards';

  -- Build HTML email
  v_html := '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>'
    || '<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;">'
    || '<div style="max-width:600px;margin:0 auto;background:#ffffff;">'
    -- Header
    || '<div style="background:linear-gradient(135deg,#1a237e 0%,#0d47a1 100%);padding:32px;text-align:center;">'
    || '<h1 style="color:#cc9900;margin:0;font-size:24px;">British Trade Awards</h1>'
    || '<p style="color:#ffffff;margin:8px 0 0;font-size:14px;">Celebrating Excellence in British Trade</p>'
    || '</div>'
    -- Body
    || '<div style="padding:32px;color:#333;line-height:1.6;font-size:15px;">'
    || '<h2 style="color:#1a237e;margin-top:0;">Entry Confirmation</h2>'
    || '<p>Dear ' || COALESCE(v_entry.contact_name, 'Applicant') || ',</p>'
    || '<p>Thank you for entering the British Trade Awards. We are pleased to confirm that your entry has been received and is now being processed.</p>'
    -- Entry details box
    || '<div style="background:#f8f9fa;border-left:4px solid #cc9900;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0;">'
    || '<h3 style="margin:0 0 12px;color:#1a237e;font-size:16px;">Your Entry Details</h3>'
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
    || '<h3 style="color:#1a237e;font-size:16px;">What Happens Next</h3>'
    || '<ol style="padding-left:20px;">'
    || '<li style="margin-bottom:8px;">Our team will review your entry to ensure all details are complete.</li>'
    || '<li style="margin-bottom:8px;">You may upload supporting documents (case studies, images, testimonials) using the link below.</li>'
    || '<li style="margin-bottom:8px;">Shortlisted entries will be assessed by our independent judging panel.</li>'
    || '<li style="margin-bottom:8px;">Winners will be announced at the awards ceremony.</li>'
    || '</ol>'
    || '<p>Please keep your entry reference number <strong>' || COALESCE(v_entry.entry_number, '') || '</strong> safe for future correspondence.</p>'
    || '<p>If you have any questions, please contact us at <a href="mailto:awards@britishtradeawards.com" style="color:#0d6efd;">awards@britishtradeawards.com</a></p>'
    || '<p style="margin-top:24px;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>'
    || '</div>'
    -- Footer
    || '<div style="background:#f8f9fa;padding:24px 32px;text-align:center;font-size:12px;color:#6c757d;">'
    || '<p>British Trade Awards | <a href="https://britishtrade.com" style="color:#0d6efd;text-decoration:none;">britishtrade.com</a></p>'
    || '</div></div></body></html>';

  -- Send via existing send_single_email function
  v_result := send_single_email(v_entry.contact_email, v_subject, v_html);

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

-- Grant to both anon (public form) and authenticated (admin)
GRANT EXECUTE ON FUNCTION send_entry_confirmation_email(UUID) TO anon;
GRANT EXECUTE ON FUNCTION send_entry_confirmation_email(UUID) TO authenticated;

COMMENT ON FUNCTION send_entry_confirmation_email IS 'Send confirmation email for a newly submitted entry. Called from the public entry form.';
