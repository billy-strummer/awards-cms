-- Migration 064: Seed the 11 email templates never created by migration 044
-- (migration 044 was not run, so these templates don't exist in the DB).
-- Bodies use the BTA brand palette matching migration 063.
-- Uses ON CONFLICT DO UPDATE so re-running is safe.

-- ─── 1. Changes Requested ────────────────────────────────────────────────────
INSERT INTO email_templates (template_name, template_type, name, subject, body, description, available_placeholders, is_active, is_default)
VALUES (
  'Changes Requested',
  'revision_request',
  'Changes Requested',
  'Action Required: Changes Requested - {ENTRY_TITLE}',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">Your entry <strong>{ENTRY_TITLE}</strong> ({ENTRY_NUMBER}) requires some changes before it can proceed to the judging stage.</p>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 10px;">Feedback from our team</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.7;">{FEEDBACK}</td></tr>
</table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 22px;">Please review the feedback above and log in to update your entry at your earliest convenience.</p>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td style="background:#C9A227;border-radius:6px;"><a href="{ACTION_LINK}" style="color:#000000;padding:12px 28px;text-decoration:none;display:inline-block;font-family:Arial,sans-serif;font-weight:700;font-size:14px;">Review &amp; Update Entry</a></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>',
  'Sent when an admin requests changes to a submitted entry',
  ARRAY['CONTACT_NAME', 'ENTRY_TITLE', 'ENTRY_NUMBER', 'FEEDBACK', 'ACTION_LINK'],
  true, true
)
ON CONFLICT (template_name) DO UPDATE SET
  body = EXCLUDED.body, subject = EXCLUDED.subject,
  template_type = EXCLUDED.template_type,
  available_placeholders = EXCLUDED.available_placeholders,
  updated_at = NOW();

-- ─── 2. Payment Confirmation ─────────────────────────────────────────────────
INSERT INTO email_templates (template_name, template_type, name, subject, body, description, available_placeholders, is_active, is_default)
VALUES (
  'Payment Confirmation',
  'payment_confirmation',
  'Payment Confirmation',
  'Entry Confirmed: {ENTRY_NUMBER} - British Trade Awards',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 6px;">Your payment has been received and your entry is now confirmed.</p>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:16px 0 10px;">Entry Details</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Reference</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{ENTRY_NUMBER}</strong></td></tr>
<tr><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Entry Title</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{ENTRY_TITLE}</span></td></tr>
<tr style="background:#fffdf5;"><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Company</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{COMPANY_NAME}</span></td></tr>
</table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 22px;">You can now upload supporting documents to strengthen your entry.</p>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td style="background:#C9A227;border-radius:6px;"><a href="{UPLOAD_LINK}" style="color:#000000;padding:12px 28px;text-decoration:none;display:inline-block;font-family:Arial,sans-serif;font-weight:700;font-size:14px;">Upload Supporting Documents</a></td></tr></table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555;line-height:1.7;margin:0 0 22px;">We will be in touch with next steps as the judging process progresses. Good luck!</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>',
  'Sent automatically after successful payment via Stripe',
  ARRAY['ENTRY_NUMBER', 'CONTACT_NAME', 'COMPANY_NAME', 'ENTRY_TITLE', 'UPLOAD_LINK'],
  true, true
)
ON CONFLICT (template_name) DO UPDATE SET
  body = EXCLUDED.body, subject = EXCLUDED.subject,
  template_type = EXCLUDED.template_type,
  available_placeholders = EXCLUDED.available_placeholders,
  updated_at = NOW();

-- ─── 3. Payment Failed ───────────────────────────────────────────────────────
INSERT INTO email_templates (template_name, template_type, name, subject, body, description, available_placeholders, is_active, is_default)
VALUES (
  'Payment Failed',
  'payment_failed',
  'Payment Failed',
  'Payment Issue: {ENTRY_NUMBER} - British Trade Awards',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">We were unable to process your payment for entry <strong>{ENTRY_NUMBER}</strong>. Please see the details below.</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Reference</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{ENTRY_NUMBER}</strong></td></tr>
<tr><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Reason</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{ERROR_MESSAGE}</span></td></tr>
</table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 22px;">Please try again using the link in your original entry confirmation, or contact us at <a href="mailto:{CONTACT_EMAIL}" style="color:#C9A227;text-decoration:none;">{CONTACT_EMAIL}</a></p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>',
  'Sent automatically when a Stripe payment fails',
  ARRAY['ENTRY_NUMBER', 'CONTACT_NAME', 'COMPANY_NAME', 'ERROR_MESSAGE', 'CONTACT_EMAIL'],
  true, true
)
ON CONFLICT (template_name) DO UPDATE SET
  body = EXCLUDED.body, subject = EXCLUDED.subject,
  template_type = EXCLUDED.template_type,
  available_placeholders = EXCLUDED.available_placeholders,
  updated_at = NOW();

-- ─── 4. Refund Confirmation ──────────────────────────────────────────────────
INSERT INTO email_templates (template_name, template_type, name, subject, body, description, available_placeholders, is_active, is_default)
VALUES (
  'Refund Confirmation',
  'refund_confirmation',
  'Refund Confirmation',
  'Refund Processed: {ENTRY_NUMBER} - British Trade Awards',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">We can confirm that a refund has been processed for entry <strong>{ENTRY_NUMBER}</strong>.</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Reference</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{ENTRY_NUMBER}</strong></td></tr>
<tr><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Company</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{COMPANY_NAME}</span></td></tr>
</table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 22px;">The refund should appear on your statement within <strong>5&ndash;10 business days</strong>. Questions? <a href="mailto:{CONTACT_EMAIL}" style="color:#C9A227;text-decoration:none;">{CONTACT_EMAIL}</a></p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>',
  'Sent automatically when a Stripe refund is processed',
  ARRAY['ENTRY_NUMBER', 'CONTACT_NAME', 'COMPANY_NAME', 'CONTACT_EMAIL'],
  true, true
)
ON CONFLICT (template_name) DO UPDATE SET
  body = EXCLUDED.body, subject = EXCLUDED.subject,
  template_type = EXCLUDED.template_type,
  available_placeholders = EXCLUDED.available_placeholders,
  updated_at = NOW();

-- ─── 5. Payment Reminder ─────────────────────────────────────────────────────
INSERT INTO email_templates (template_name, template_type, name, subject, body, description, available_placeholders, is_active, is_default)
VALUES (
  'Payment Reminder',
  'payment_reminder',
  'Payment Reminder',
  'Payment Pending - Entry {ENTRY_NUMBER}',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">Your entry <strong>{ENTRY_NUMBER}</strong> is currently pending payment. Please complete your payment to confirm your place.</p>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 10px;">Payment Details</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Reference</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{ENTRY_NUMBER}</strong></td></tr>
<tr><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Entry</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{ENTRY_TITLE}</span></td></tr>
<tr style="background:#fffdf5;"><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Amount Due</span><br><strong style="font-family:Georgia,''Times New Roman'',serif;font-size:18px;color:#C9A227;">&pound;{ENTRY_FEE}</strong></td></tr>
</table>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td style="background:#C9A227;border-radius:6px;"><a href="{PAYMENT_LINK}" style="color:#000000;padding:12px 28px;text-decoration:none;display:inline-block;font-family:Arial,sans-serif;font-weight:700;font-size:14px;">Complete Payment</a></td></tr></table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#888;line-height:1.7;margin:0 0 22px;">Questions? <a href="mailto:{CONTACT_EMAIL}" style="color:#C9A227;text-decoration:none;">{CONTACT_EMAIL}</a></p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>',
  'Sent as a reminder when an entry fee is outstanding',
  ARRAY['ENTRY_NUMBER', 'CONTACT_NAME', 'COMPANY_NAME', 'ENTRY_TITLE', 'ENTRY_FEE', 'PAYMENT_LINK', 'CONTACT_EMAIL'],
  true, true
)
ON CONFLICT (template_name) DO UPDATE SET
  body = EXCLUDED.body, subject = EXCLUDED.subject,
  template_type = EXCLUDED.template_type,
  available_placeholders = EXCLUDED.available_placeholders,
  updated_at = NOW();

-- ─── 6. Winner Announcement ──────────────────────────────────────────────────
INSERT INTO email_templates (template_name, template_type, name, subject, body, description, available_placeholders, is_active, is_default)
VALUES (
  'Winner Announcement',
  'winner_announcement',
  'Winner Announcement',
  'WINNER - {AWARD_NAME}!',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="background:linear-gradient(135deg,#1a1200 0%,#2a1f00 100%);padding:36px 40px;text-align:center;">
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#C9A227;margin:0 0 12px;opacity:0.8;">British Trade Awards</p>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:36px;font-weight:700;color:#C9A227;margin:0 0 4px;line-height:1.1;">WINNER</p>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:18px;color:rgba(201,162,39,0.7);margin:0;">{AWARD_NAME}</p>
</td></tr>
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">We are thrilled to announce that <strong>{COMPANY_NAME}</strong> is the winner of the <strong>{AWARD_NAME}</strong> at the British Trade Awards!</p>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 10px;">Your Winner&apos;s Package Includes</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:10px 16px;border-bottom:1px solid rgba(201,162,39,0.15);font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;">&#10003; Digital winner&apos;s certificate</td></tr>
<tr><td style="padding:10px 16px;border-bottom:1px solid rgba(201,162,39,0.15);font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;">&#10003; Winner&apos;s logo and badge for your marketing</td></tr>
<tr style="background:#fffdf5;"><td style="padding:10px 16px;border-bottom:1px solid rgba(201,162,39,0.15);font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;">&#10003; Press release and media coverage</td></tr>
<tr><td style="padding:10px 16px;border-bottom:1px solid rgba(201,162,39,0.15);font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;">&#10003; Feature on our website and social media</td></tr>
<tr style="background:#fffdf5;"><td style="padding:10px 16px;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;">&#10003; Winner&apos;s trophy (presented at ceremony)</td></tr>
</table>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 10px;">Awards Ceremony</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Date</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{CEREMONY_DATE}</strong></td></tr>
<tr><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Venue</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{CEREMONY_VENUE}</span></td></tr>
</table>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td style="background:#C9A227;border-radius:6px;"><a href="{WINNERS_PORTAL_LINK}" style="color:#000000;padding:12px 28px;text-decoration:none;display:inline-block;font-family:Arial,sans-serif;font-weight:700;font-size:14px;">Access Winner&apos;s Portal</a></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>',
  'Sent to winners when results are announced',
  ARRAY['CONTACT_NAME', 'COMPANY_NAME', 'AWARD_NAME', 'CEREMONY_DATE', 'CEREMONY_VENUE', 'WINNERS_PORTAL_LINK'],
  true, true
)
ON CONFLICT (template_name) DO UPDATE SET
  body = EXCLUDED.body, subject = EXCLUDED.subject,
  template_type = EXCLUDED.template_type,
  available_placeholders = EXCLUDED.available_placeholders,
  updated_at = NOW();

-- ─── 7. Judge Assignment ─────────────────────────────────────────────────────
INSERT INTO email_templates (template_name, template_type, name, subject, body, description, available_placeholders, is_active, is_default)
VALUES (
  'Judge Assignment',
  'judge_assignment',
  'Judge Assignment',
  'New Judging Assignment - British Trade Awards',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {JUDGE_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">You have been assigned <strong>{ENTRY_COUNT}</strong> new entries to judge for the British Trade Awards.</p>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 10px;">Assignment Details</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Entries to Score</span><br><strong style="font-family:Georgia,''Times New Roman'',serif;font-size:18px;color:#C9A227;">{ENTRY_COUNT}</strong></td></tr>
<tr><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Judging Deadline</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{DEADLINE}</strong></td></tr>
</table>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td style="background:#C9A227;border-radius:6px;"><a href="{JUDGE_PORTAL_LINK}" style="color:#000000;padding:12px 28px;text-decoration:none;display:inline-block;font-family:Arial,sans-serif;font-weight:700;font-size:14px;">Start Judging</a></td></tr></table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#888;line-height:1.7;margin:0 0 22px;">Please complete your scoring by the deadline. If you have any questions or conflicts of interest, reply to this email immediately. Thank you for your contribution to the awards!</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>',
  'Sent when entries are assigned to a judge for scoring',
  ARRAY['JUDGE_NAME', 'ENTRY_COUNT', 'DEADLINE', 'JUDGE_PORTAL_LINK'],
  true, true
)
ON CONFLICT (template_name) DO UPDATE SET
  body = EXCLUDED.body, subject = EXCLUDED.subject,
  template_type = EXCLUDED.template_type,
  available_placeholders = EXCLUDED.available_placeholders,
  updated_at = NOW();

-- ─── 8. Judge Reminder ───────────────────────────────────────────────────────
INSERT INTO email_templates (template_name, template_type, name, subject, body, description, available_placeholders, is_active, is_default)
VALUES (
  'Judge Reminder',
  'judge_reminder',
  'Judge Reminder',
  'Judging Deadline Reminder - {DAYS_LEFT} Days Left',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {JUDGE_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">This is a reminder that the judging deadline is approaching in <strong>{DAYS_LEFT} days</strong>.</p>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 10px;">Your Progress</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Deadline</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{DEADLINE}</strong></td></tr>
<tr><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Completed</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{SCORED_COUNT} of {TOTAL_COUNT}</strong></td></tr>
<tr style="background:#fffdf5;"><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Remaining</span><br><strong style="font-family:Georgia,''Times New Roman'',serif;font-size:18px;color:#C9A227;">{PENDING_COUNT}</strong></td></tr>
</table>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td style="background:#C9A227;border-radius:6px;"><a href="{JUDGE_PORTAL_LINK}" style="color:#000000;padding:12px 28px;text-decoration:none;display:inline-block;font-family:Arial,sans-serif;font-weight:700;font-size:14px;">Continue Judging</a></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>',
  'Reminder sent to judges when the scoring deadline approaches',
  ARRAY['JUDGE_NAME', 'DAYS_LEFT', 'DEADLINE', 'SCORED_COUNT', 'TOTAL_COUNT', 'PENDING_COUNT', 'JUDGE_PORTAL_LINK'],
  true, true
)
ON CONFLICT (template_name) DO UPDATE SET
  body = EXCLUDED.body, subject = EXCLUDED.subject,
  template_type = EXCLUDED.template_type,
  available_placeholders = EXCLUDED.available_placeholders,
  updated_at = NOW();

-- ─── 9. Deadline Reminder ────────────────────────────────────────────────────
INSERT INTO email_templates (template_name, template_type, name, subject, body, description, available_placeholders, is_active, is_default)
VALUES (
  'Deadline Reminder',
  'deadline_reminder',
  'Deadline Reminder',
  'Reminder: {DEADLINE_TYPE} Deadline in {DAYS_LEFT} Days',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {RECIPIENT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">This is a reminder that the <strong>{DEADLINE_TYPE}</strong> deadline is approaching.</p>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 10px;">Deadline Details</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Days Remaining</span><br><strong style="font-family:Georgia,''Times New Roman'',serif;font-size:24px;color:#C9A227;">{DAYS_LEFT}</strong></td></tr>
<tr><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Deadline Type</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{DEADLINE_TYPE}</strong></td></tr>
<tr style="background:#fffdf5;"><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Deadline Date</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{DEADLINE_DATE}</strong></td></tr>
</table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 22px;">{ACTION_REQUIRED}</p>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td style="background:#C9A227;border-radius:6px;"><a href="{ACTION_LINK}" style="color:#000000;padding:12px 28px;text-decoration:none;display:inline-block;font-family:Arial,sans-serif;font-weight:700;font-size:14px;">Take Action Now</a></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>',
  'General deadline reminder (entry submissions, uploads, etc.)',
  ARRAY['RECIPIENT_NAME', 'DEADLINE_TYPE', 'DAYS_LEFT', 'DEADLINE_DATE', 'ACTION_REQUIRED', 'ACTION_LINK'],
  true, true
)
ON CONFLICT (template_name) DO UPDATE SET
  body = EXCLUDED.body, subject = EXCLUDED.subject,
  template_type = EXCLUDED.template_type,
  available_placeholders = EXCLUDED.available_placeholders,
  updated_at = NOW();

-- ─── 10. Event Invitation ────────────────────────────────────────────────────
INSERT INTO email_templates (template_name, template_type, name, subject, body, description, available_placeholders, is_active, is_default)
VALUES (
  'Event Invitation',
  'event_invitation',
  'Event Invitation',
  'You''re Invited: {EVENT_NAME}',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">You are cordially invited to attend the <strong>{EVENT_NAME}</strong>. We would be honoured by your presence at this special occasion.</p>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 10px;">Event Details</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Event</span><br><strong style="font-family:Georgia,''Times New Roman'',serif;font-size:16px;color:#1a1a1a;">{EVENT_NAME}</strong></td></tr>
<tr><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Date</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{EVENT_DATE}</strong></td></tr>
<tr style="background:#fffdf5;"><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Venue</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{VENUE}</span></td></tr>
</table>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td style="background:#C9A227;border-radius:6px;"><a href="{RSVP_URL}" style="color:#000000;padding:12px 28px;text-decoration:none;display:inline-block;font-family:Arial,sans-serif;font-weight:700;font-size:14px;">RSVP Now</a></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>',
  'Invitation sent for awards ceremonies and other events',
  ARRAY['CONTACT_NAME', 'EVENT_NAME', 'EVENT_DATE', 'VENUE', 'RSVP_URL'],
  true, true
)
ON CONFLICT (template_name) DO UPDATE SET
  body = EXCLUDED.body, subject = EXCLUDED.subject,
  template_type = EXCLUDED.template_type,
  available_placeholders = EXCLUDED.available_placeholders,
  updated_at = NOW();

-- ─── 11. Ticket Issued ───────────────────────────────────────────────────────
INSERT INTO email_templates (template_name, template_type, name, subject, body, description, available_placeholders, is_active, is_default)
VALUES (
  'Ticket Issued',
  'ticket_issued',
  'Ticket Issued',
  'Your Ticket: {EVENT_NAME}',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">Your ticket for <strong>{EVENT_NAME}</strong> has been issued. Please present this at check-in on the day.</p>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 10px;">Ticket Details</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Ticket Number</span><br><strong style="font-family:Georgia,''Times New Roman'',serif;font-size:18px;color:#C9A227;">{TICKET_NUMBER}</strong></td></tr>
<tr><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Event</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{EVENT_NAME}</strong></td></tr>
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Date</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{EVENT_DATE}</span></td></tr>
<tr><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Venue</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{VENUE}</span></td></tr>
</table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#888;line-height:1.7;margin:0 0 22px;">You may also receive a QR code closer to the event date for express check-in. Please keep this email for your records.</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>',
  'Sent when an event ticket is issued to an attendee',
  ARRAY['CONTACT_NAME', 'EVENT_NAME', 'TICKET_NUMBER', 'EVENT_DATE', 'VENUE'],
  true, true
)
ON CONFLICT (template_name) DO UPDATE SET
  body = EXCLUDED.body, subject = EXCLUDED.subject,
  template_type = EXCLUDED.template_type,
  available_placeholders = EXCLUDED.available_placeholders,
  updated_at = NOW();
