-- Migration 065: Fix 5 existing template bodies that were corrupted by migration 063
-- Migration 063 used dollar-quoting ($BODY$\n<table) which stored a literal \n prefix,
-- making TRIM(body) LIKE '<%' fail. This migration overwrites them with clean HTML
-- using single-quoted strings (no leading whitespace).

UPDATE email_templates
SET body = '<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
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
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>'
WHERE template_name = 'Entry Confirmation';

UPDATE email_templates
SET body = '<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
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
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>'
WHERE template_name = 'Nomination Confirmation';

UPDATE email_templates
SET body = '<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">We wanted to let you know that we have not yet received any supporting documents for your British Trade Awards entry.</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:20px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Reference</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{ENTRY_NUMBER}</strong></td></tr>
<tr><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Company</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{COMPANY_NAME}</span></td></tr>
<tr style="background:#fffdf5;"><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Category</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{AWARD_NAME}</span></td></tr>
</table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">While supporting documents are not mandatory, they can significantly strengthen your entry. Case studies, project images, client testimonials and accreditation certificates all help our judges assess your work.</p>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td style="background:#C9A227;border-radius:6px;"><a href="{UPLOAD_LINK}" style="color:#000000;padding:12px 28px;text-decoration:none;display:inline-block;font-family:Arial,sans-serif;font-weight:700;font-size:14px;">Upload Supporting Documents</a></td></tr></table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#888;line-height:1.7;margin:0 0 22px;">Accepted formats: PDF, Word, Excel, JPG, PNG (max 10 MB per file). Deadline: <strong style="color:#1a1a1a;">{DEADLINE_DATE}</strong>. Questions? <a href="mailto:{CONTACT_EMAIL}" style="color:#C9A227;text-decoration:none;">{CONTACT_EMAIL}</a></p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>'
WHERE template_name = 'Document Upload Reminder';

UPDATE email_templates
SET body = '<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C9A227;margin:0 0 8px;">Congratulations</p>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:26px;color:#1a1a1a;margin:0 0 16px;line-height:1.2;">You Have Been Shortlisted!</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px;">We are delighted to inform you that <strong>{COMPANY_NAME}</strong> has been shortlisted in the <strong>{AWARD_NAME}</strong> category at the British Trade Awards.</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:8px;overflow:hidden;margin-bottom:24px;">
<tr style="background:#fffdf5;"><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Reference</span><br><strong style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{ENTRY_NUMBER}</strong></td></tr>
<tr><td style="padding:11px 16px;border-bottom:1px solid rgba(201,162,39,0.15);"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Company</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{COMPANY_NAME}</span></td></tr>
<tr style="background:#fffdf5;"><td style="padding:11px 16px;"><span style="font-family:Arial,sans-serif;font-size:11px;color:#888;">Category</span><br><span style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">{AWARD_NAME}</span></td></tr>
</table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 16px;">Your entry will now be assessed by our independent panel of judges. Winners will be announced on <strong>{ANNOUNCEMENT_DATE}</strong>. We will be in touch with further details about the awards ceremony.</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 22px;">This is a fantastic achievement and a testament to the quality of your work. Well done to you and your team.</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td style="height:1px;background:rgba(201,162,39,0.2);"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>'
WHERE template_name = 'Entry Approved/Shortlisted';

UPDATE email_templates
SET body = '<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:40px 40px 36px;">
<table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr></table>
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:22px;color:#1a1a1a;margin:0 0 16px;line-height:1.3;">Dear {CONTACT_NAME},</p>
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
<p style="font-family:Georgia,''Times New Roman'',serif;font-size:15px;color:#1a1a1a;margin:0;line-height:1.6;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>
</td></tr>
</table>'
WHERE template_name = 'Entry Not Shortlisted';
