-- Migration 063: Brand-styled HTML bodies for all auto-generated email templates
--
-- Replaces the plain-text bodies seeded in migrations 026 and 044 with full
-- HTML using the British Trade Awards brand palette:
--   #C9A227  gold accents, borders, CTA buttons, numbered steps
--   Georgia serif  greetings and sign-offs
--   #1a1a1a / #444444  dark body text on white card background
--
-- These bodies are treated as raw HTML by email-automation.js (companion fix
-- in this release). Only {KEY} placeholder values are HTML-escaped at
-- substitution time to prevent XSS injection.

-- ─── 1. Entry Confirmation ────────────────────────────────────────────────────
UPDATE email_templates SET body = $BODY$
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">Thank you for entering the British Trade Awards. We are pleased to confirm that your entry has been received and is now being processed.</p>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 10px;">Your Entry Details</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Reference</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{ENTRY_NUMBER}</strong></td></tr>
<tr><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Company</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{COMPANY_NAME}</span></td></tr>
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Category</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{AWARD_NAME}</span></td></tr>
<tr><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Sector &amp; Region</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{SECTOR} &mdash; {REGION}</span></td></tr>
</table>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 14px;">What Happens Next</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;"><tr><td width="32" valign="top"><table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:22px;height:22px;border-radius:50%;background:#C9A227;text-align:center;font-family:Georgia,serif;font-size:11px;font-weight:700;color:#000;line-height:22px;">1</td></tr></table></td><td valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555;line-height:1.6;padding-top:2px;padding-left:8px;">Our team will review your entry to ensure all details are complete.</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;"><tr><td width="32" valign="top"><table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:22px;height:22px;border-radius:50%;background:#C9A227;text-align:center;font-family:Georgia,serif;font-size:11px;font-weight:700;color:#000;line-height:22px;">2</td></tr></table></td><td valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555;line-height:1.6;padding-top:2px;padding-left:8px;">Upload any supporting documents (case studies, images, testimonials) using the link below.</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;"><tr><td width="32" valign="top"><table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:22px;height:22px;border-radius:50%;background:#C9A227;text-align:center;font-family:Georgia,serif;font-size:11px;font-weight:700;color:#000;line-height:22px;">3</td></tr></table></td><td valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555;line-height:1.6;padding-top:2px;padding-left:8px;">Shortlisted entries will be assessed by our independent judging panel.</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px;"><tr><td width="32" valign="top"><table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:22px;height:22px;border-radius:50%;background:#C9A227;text-align:center;font-family:Georgia,serif;font-size:11px;font-weight:700;color:#000;line-height:22px;">4</td></tr></table></td><td valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555;line-height:1.6;padding-top:2px;padding-left:8px;">Winners will be announced at the awards ceremony.</td></tr></table>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td style="background:#C9A227;border-radius:6px;"><a href="{UPLOAD_LINK}" style="color:#000000;padding:12px 28px;text-decoration:none;display:inline-block;font-family:Arial,sans-serif;font-weight:700;font-size:14px;">Upload Supporting Documents</a></td></tr></table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#888;line-height:1.7;margin:0 0 22px;">Ref: <strong style="color:#1a1a1a;">{ENTRY_NUMBER}</strong> &bull; Deadline: {DEADLINE_DATE} &bull; Winners Announced: {ANNOUNCEMENT_DATE}<br>Questions? <a href="mailto:{CONTACT_EMAIL}" style="color:#C9A227;text-decoration:none;">{CONTACT_EMAIL}</a></p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>
$BODY$, updated_at = NOW()
WHERE template_name = 'Entry Confirmation';

-- ─── 2. Nomination Confirmation ───────────────────────────────────────────────
UPDATE email_templates SET body = $BODY$
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">Thank you for submitting your nomination for the British Trade Awards. We are pleased to confirm that your nomination has been received and is now being processed.</p>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 10px;">Nomination Details</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Reference</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{ENTRY_NUMBER}</strong></td></tr>
<tr><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Nominee</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{NOMINEE_NAME}</span></td></tr>
<tr style="background:#fffdf5;"><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Category</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{AWARD_NAME}</span></td></tr>
</table>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 14px;">What Happens Next</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;"><tr><td width="32" valign="top"><table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:22px;height:22px;border-radius:50%;background:#C9A227;text-align:center;font-family:Georgia,serif;font-size:11px;font-weight:700;color:#000;line-height:22px;">1</td></tr></table></td><td valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555;line-height:1.6;padding-top:2px;padding-left:8px;">Our team will review your nomination to ensure all details are complete.</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;"><tr><td width="32" valign="top"><table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:22px;height:22px;border-radius:50%;background:#C9A227;text-align:center;font-family:Georgia,serif;font-size:11px;font-weight:700;color:#000;line-height:22px;">2</td></tr></table></td><td valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555;line-height:1.6;padding-top:2px;padding-left:8px;">Shortlisted nominations will be assessed by our independent judging panel.</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px;"><tr><td width="32" valign="top"><table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:22px;height:22px;border-radius:50%;background:#C9A227;text-align:center;font-family:Georgia,serif;font-size:11px;font-weight:700;color:#000;line-height:22px;">3</td></tr></table></td><td valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555;line-height:1.6;padding-top:2px;padding-left:8px;">Winners will be announced at the awards ceremony.</td></tr></table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#888;line-height:1.7;margin:0 0 22px;">Please keep your reference <strong style="color:#1a1a1a;">{ENTRY_NUMBER}</strong> safe for future correspondence. Questions? <a href="mailto:{CONTACT_EMAIL}" style="color:#C9A227;text-decoration:none;">{CONTACT_EMAIL}</a></p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>
$BODY$, updated_at = NOW()
WHERE template_name = 'Nomination Confirmation';

-- ─── 3. Document Upload Reminder ─────────────────────────────────────────────
UPDATE email_templates SET body = $BODY$
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">We wanted to let you know that we have not yet received any supporting documents for your British Trade Awards entry.</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:20px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Reference</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{ENTRY_NUMBER}</strong></td></tr>
<tr><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Company</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{COMPANY_NAME}</span></td></tr>
<tr style="background:#fffdf5;"><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Category</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{AWARD_NAME}</span></td></tr>
</table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">While supporting documents are not mandatory, they can significantly strengthen your entry. Case studies, project images, client testimonials and accreditation certificates all help our judges assess your work.</p>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td style="background:#C9A227;border-radius:6px;"><a href="{UPLOAD_LINK}" style="color:#000000;padding:12px 28px;text-decoration:none;display:inline-block;font-family:Arial,sans-serif;font-weight:700;font-size:14px;">Upload Supporting Documents</a></td></tr></table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#888;line-height:1.7;margin:0 0 22px;">Accepted formats: PDF, Word, Excel, JPG, PNG (max 10 MB per file). Deadline for all entries and documents: <strong style="color:#1a1a1a;">{DEADLINE_DATE}</strong>.<br>If you have already uploaded your documents, please disregard this message. Questions? <a href="mailto:{CONTACT_EMAIL}" style="color:#C9A227;text-decoration:none;">{CONTACT_EMAIL}</a></p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>
$BODY$, updated_at = NOW()
WHERE template_name = 'Document Upload Reminder';

-- ─── 4. Changes Requested ────────────────────────────────────────────────────
UPDATE email_templates SET body = $BODY$
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">Your entry <strong>{ENTRY_TITLE}</strong> ({ENTRY_NUMBER}) requires some changes before it can proceed to the judging stage.</p>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 10px;">Feedback from our team</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.7;">{FEEDBACK}</td></tr>
</table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 22px;">Please review the feedback above and log in to update your entry at your earliest convenience.</p>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td style="background:#C9A227;border-radius:6px;"><a href="{ACTION_LINK}" style="color:#000000;padding:12px 28px;text-decoration:none;display:inline-block;font-family:Arial,sans-serif;font-weight:700;font-size:14px;">Review &amp; Update Entry</a></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>
$BODY$, updated_at = NOW()
WHERE template_name = 'Changes Requested';

-- ─── 5. Payment Confirmation ─────────────────────────────────────────────────
UPDATE email_templates SET body = $BODY$
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 6px;">Your payment has been received and your entry is now confirmed.</p>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:16px 0 10px;">Entry Details</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Reference</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{ENTRY_NUMBER}</strong></td></tr>
<tr><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Entry Title</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{ENTRY_TITLE}</span></td></tr>
<tr style="background:#fffdf5;"><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Company</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{COMPANY_NAME}</span></td></tr>
</table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 22px;">You can now upload supporting documents to strengthen your entry — case studies, images, testimonials, and accreditation certificates are all welcome.</p>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td style="background:#C9A227;border-radius:6px;"><a href="{UPLOAD_LINK}" style="color:#000000;padding:12px 28px;text-decoration:none;display:inline-block;font-family:Arial,sans-serif;font-weight:700;font-size:14px;">Upload Supporting Documents</a></td></tr></table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555;line-height:1.7;margin:0 0 22px;">We will be in touch with next steps as the judging process progresses. Good luck!</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>
$BODY$, updated_at = NOW()
WHERE template_name = 'Payment Confirmation';

-- ─── 6. Payment Failed ───────────────────────────────────────────────────────
UPDATE email_templates SET body = $BODY$
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">We were unable to process your payment for entry <strong>{ENTRY_NUMBER}</strong>. Please see the details below.</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Reference</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{ENTRY_NUMBER}</strong></td></tr>
<tr><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Reason</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{ERROR_MESSAGE}</span></td></tr>
</table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 22px;">Please try again using the link in your original entry confirmation, or contact us for assistance at <a href="mailto:{CONTACT_EMAIL}" style="color:#C9A227;text-decoration:none;">{CONTACT_EMAIL}</a></p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>
$BODY$, updated_at = NOW()
WHERE template_name = 'Payment Failed';

-- ─── 7. Refund Confirmation ──────────────────────────────────────────────────
UPDATE email_templates SET body = $BODY$
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">We can confirm that a refund has been processed for entry <strong>{ENTRY_NUMBER}</strong>.</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Reference</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{ENTRY_NUMBER}</strong></td></tr>
<tr><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Company</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{COMPANY_NAME}</span></td></tr>
</table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 22px;">The refund should appear on your statement within <strong>5&ndash;10 business days</strong>. If you have any questions, please contact us at <a href="mailto:{CONTACT_EMAIL}" style="color:#C9A227;text-decoration:none;">{CONTACT_EMAIL}</a></p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>
$BODY$, updated_at = NOW()
WHERE template_name = 'Refund Confirmation';

-- ─── 8. Payment Reminder ─────────────────────────────────────────────────────
UPDATE email_templates SET body = $BODY$
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">Your entry <strong>{ENTRY_NUMBER}</strong> is currently pending payment. Please complete your payment to confirm your place.</p>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 10px;">Payment Details</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Reference</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{ENTRY_NUMBER}</strong></td></tr>
<tr><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Entry</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{ENTRY_TITLE}</span></td></tr>
<tr style="background:#fffdf5;"><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Amount Due</span><br><strong style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#C9A227;">&pound;{ENTRY_FEE}</strong></td></tr>
</table>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td style="background:#C9A227;border-radius:6px;"><a href="{PAYMENT_LINK}" style="color:#000000;padding:12px 28px;text-decoration:none;display:inline-block;font-family:Arial,sans-serif;font-weight:700;font-size:14px;">Complete Payment</a></td></tr></table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#888;line-height:1.7;margin:0 0 22px;">If you have any questions, please contact us at <a href="mailto:{CONTACT_EMAIL}" style="color:#C9A227;text-decoration:none;">{CONTACT_EMAIL}</a></p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>
$BODY$, updated_at = NOW()
WHERE template_name = 'Payment Reminder';

-- ─── 9. Entry Approved / Shortlisted ─────────────────────────────────────────
UPDATE email_templates SET body = $BODY$
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 8px;">Congratulations</p>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#1a1a1a;margin:0 0 16px;line-height:1.2;">You Have Been Shortlisted!</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">We are delighted to inform you that <strong>{COMPANY_NAME}</strong> has been shortlisted in the <strong>{AWARD_NAME}</strong> category at the British Trade Awards.</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Reference</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{ENTRY_NUMBER}</strong></td></tr>
<tr><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Company</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{COMPANY_NAME}</span></td></tr>
<tr style="background:#fffdf5;"><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Category</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{AWARD_NAME}</span></td></tr>
</table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 16px;">Your entry will now be assessed by our independent panel of judges. The judging process evaluates the quality of work, customer service, innovation and overall contribution to the trade industry.</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 22px;">Winners will be announced on <strong>{ANNOUNCEMENT_DATE}</strong>. We will be in touch with further details about the awards ceremony in due course.</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 22px;">This is a fantastic achievement and a testament to the quality of your work. Well done to you and your team.</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>
$BODY$, updated_at = NOW()
WHERE template_name = 'Entry Approved/Shortlisted';

-- ─── 10. Entry Not Shortlisted ───────────────────────────────────────────────
UPDATE email_templates SET body = $BODY$
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">Thank you for entering <strong>{COMPANY_NAME}</strong> into the <strong>{AWARD_NAME}</strong> category at the British Trade Awards.</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Reference</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{ENTRY_NUMBER}</strong></td></tr>
<tr><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Company</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{COMPANY_NAME}</span></td></tr>
<tr style="background:#fffdf5;"><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Category</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{AWARD_NAME}</span></td></tr>
</table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 16px;">After careful consideration by our judging panel, we regret to inform you that your entry has not been selected for the shortlist on this occasion.</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 16px;">We received an exceptionally high standard of entries this year, making the selection process extremely competitive. Not being shortlisted is in no way a reflection on the quality of your business or the work you do.</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 22px;">We would very much welcome an entry from you again next year and wish you continued success.</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>
$BODY$, updated_at = NOW()
WHERE template_name = 'Entry Not Shortlisted';

-- ─── 11. Winner Announcement ─────────────────────────────────────────────────
UPDATE email_templates SET body = $BODY$
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
  <td style="background:linear-gradient(135deg,#1a1200 0%,#2a1f00 100%);padding:36px 40px;text-align:center;">
    <p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#C9A227;margin:0 0 12px;opacity:0.8;">British Trade Awards</p>
    <p style="font-family:Georgia,'Times New Roman',serif;font-size:36px;font-weight:700;color:#C9A227;margin:0 0 4px;line-height:1.1;">WINNER</p>
    <p style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:rgba(201,162,39,0.7);margin:0;">{AWARD_NAME}</p>
  </td>
</tr>
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">We are thrilled to announce that <strong>{COMPANY_NAME}</strong> is the winner of the <strong>{AWARD_NAME}</strong> at the British Trade Awards!</p>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 10px;">Your Winner&rsquo;s Package Includes</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:10px 16px;border-bottom:1px solid rgba(201,162,39,0.15);font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;">&#10003;&nbsp; Digital winner&rsquo;s certificate</td></tr>
<tr><td style="padding:10px 16px;border-bottom:1px solid rgba(201,162,39,0.15);font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;">&#10003;&nbsp; Winner&rsquo;s logo and badge for your marketing</td></tr>
<tr style="background:#fffdf5;"><td style="padding:10px 16px;border-bottom:1px solid rgba(201,162,39,0.15);font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;">&#10003;&nbsp; Press release and media coverage</td></tr>
<tr><td style="padding:10px 16px;border-bottom:1px solid rgba(201,162,39,0.15);font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;">&#10003;&nbsp; Feature on our website and social media</td></tr>
<tr style="background:#fffdf5;"><td style="padding:10px 16px;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;">&#10003;&nbsp; Winner&rsquo;s trophy (presented at ceremony)</td></tr>
</table>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 10px;">Awards Ceremony</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Date</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{CEREMONY_DATE}</strong></td></tr>
<tr><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Venue</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{CEREMONY_VENUE}</span></td></tr>
</table>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td style="background:#C9A227;border-radius:6px;"><a href="{WINNERS_PORTAL_LINK}" style="color:#000000;padding:12px 28px;text-decoration:none;display:inline-block;font-family:Arial,sans-serif;font-weight:700;font-size:14px;">Access Winner&rsquo;s Portal</a></td></tr></table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555;line-height:1.7;margin:0 0 22px;">We look forward to celebrating with you!</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>
$BODY$, updated_at = NOW()
WHERE template_name = 'Winner Announcement';

-- ─── 12. Judge Assignment ────────────────────────────────────────────────────
UPDATE email_templates SET body = $BODY$
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {JUDGE_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">You have been assigned <strong>{ENTRY_COUNT}</strong> new entries to judge for the British Trade Awards.</p>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 10px;">Assignment Details</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Entries to Score</span><br><strong style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#C9A227;">{ENTRY_COUNT}</strong></td></tr>
<tr><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Judging Deadline</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{DEADLINE}</strong></td></tr>
</table>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td style="background:#C9A227;border-radius:6px;"><a href="{JUDGE_PORTAL_LINK}" style="color:#000000;padding:12px 28px;text-decoration:none;display:inline-block;font-family:Arial,sans-serif;font-weight:700;font-size:14px;">Start Judging</a></td></tr></table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#888;line-height:1.7;margin:0 0 22px;">Please complete your scoring by the deadline. If you have any questions or conflicts of interest, reply to this email immediately.</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555;line-height:1.7;margin:0 0 22px;">Thank you for your contribution to the awards!</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>
$BODY$, updated_at = NOW()
WHERE template_name = 'Judge Assignment';

-- ─── 13. Judge Reminder ──────────────────────────────────────────────────────
UPDATE email_templates SET body = $BODY$
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {JUDGE_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">This is a reminder that the judging deadline is approaching in <strong>{DAYS_LEFT} days</strong>.</p>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 10px;">Your Progress</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Deadline</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{DEADLINE}</strong></td></tr>
<tr><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Completed</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{SCORED_COUNT} of {TOTAL_COUNT}</strong></td></tr>
<tr style="background:#fffdf5;"><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Remaining</span><br><strong style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#C9A227;">{PENDING_COUNT}</strong></td></tr>
</table>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td style="background:#C9A227;border-radius:6px;"><a href="{JUDGE_PORTAL_LINK}" style="color:#000000;padding:12px 28px;text-decoration:none;display:inline-block;font-family:Arial,sans-serif;font-weight:700;font-size:14px;">Continue Judging</a></td></tr></table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555;line-height:1.7;margin:0 0 22px;">Thank you for your time and expertise!</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>
$BODY$, updated_at = NOW()
WHERE template_name = 'Judge Reminder';

-- ─── 14. Event Invitation ────────────────────────────────────────────────────
UPDATE email_templates SET body = $BODY$
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">You are cordially invited to attend the <strong>{EVENT_NAME}</strong>. We would be honoured by your presence at this special occasion.</p>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 10px;">Event Details</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Event</span><br><strong style="font-family:Georgia,'Times New Roman',serif;font-size:16px;color:#1a1a1a;">{EVENT_NAME}</strong></td></tr>
<tr><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Date</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{EVENT_DATE}</strong></td></tr>
<tr style="background:#fffdf5;"><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Venue</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{VENUE}</span></td></tr>
</table>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td style="background:#C9A227;border-radius:6px;"><a href="{RSVP_URL}" style="color:#000000;padding:12px 28px;text-decoration:none;display:inline-block;font-family:Arial,sans-serif;font-weight:700;font-size:14px;">RSVP Now</a></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>
$BODY$, updated_at = NOW()
WHERE template_name = 'Event Invitation';

-- ─── 15. Ticket Issued ───────────────────────────────────────────────────────
UPDATE email_templates SET body = $BODY$
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">Your ticket for <strong>{EVENT_NAME}</strong> has been issued. Please present this at check-in on the day.</p>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 10px;">Ticket Details</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Ticket Number</span><br><strong style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#C9A227;">{TICKET_NUMBER}</strong></td></tr>
<tr><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Event</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{EVENT_NAME}</strong></td></tr>
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Date</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{EVENT_DATE}</span></td></tr>
<tr><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Venue</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{VENUE}</span></td></tr>
</table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#888;line-height:1.7;margin:0 0 22px;">You may also receive a QR code closer to the event date for express check-in. Please keep this email for your records.</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>
$BODY$, updated_at = NOW()
WHERE template_name = 'Ticket Issued';

-- ─── 16. Deadline Reminder ───────────────────────────────────────────────────
UPDATE email_templates SET body = $BODY$
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {RECIPIENT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">This is a reminder that the <strong>{DEADLINE_TYPE}</strong> deadline is approaching.</p>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 10px;">Deadline Details</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Days Remaining</span><br><strong style="font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#C9A227;">{DAYS_LEFT}</strong></td></tr>
<tr><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Deadline Type</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{DEADLINE_TYPE}</strong></td></tr>
<tr style="background:#fffdf5;"><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Deadline Date</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{DEADLINE_DATE}</strong></td></tr>
</table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 22px;">{ACTION_REQUIRED}</p>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td style="background:#C9A227;border-radius:6px;"><a href="{ACTION_LINK}" style="color:#000000;padding:12px 28px;text-decoration:none;display:inline-block;font-family:Arial,sans-serif;font-weight:700;font-size:14px;">Take Action Now</a></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>
$BODY$, updated_at = NOW()
WHERE template_name = 'Deadline Reminder';
