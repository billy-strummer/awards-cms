/* ==================================================== */
/* SHARED EMAIL HEADER & WRAPPER                        */
/* Single source of truth for the branded email layout. */
/* All email-sending paths import from this module.     */
/* Branding values come from the tenant_branding table. */
/* ==================================================== */

const escHtml = (s) =>
  String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Resolve branding fields with sensible defaults.
 * Accepts a row from tenant_branding (or a partial object).
 */
function resolveBranding(branding = {}) {
  return {
    brandName:      branding.company_name    || process.env.FROM_NAME || 'British Trade Awards',
    primaryColor:   branding.primary_color   || '#000000',
    secondaryColor: branding.secondary_color || '#1a1a1a',
    accentColor:    branding.accent_color    || '#D4AF37',
    logoUrl:        branding.logo_url        || process.env.BTA_LOGO_URL || '',
    contactEmail:   branding.email_from      || branding.email_reply_to || process.env.FROM_EMAIL || '',
    websiteUrl:     branding.custom_domain   || '',
  };
}

/**
 * Build the email header HTML block.
 * Logo present  → side-by-side (logo left, brand name + subtitle right)
 * No logo       → centred brand name + subtitle
 */
function buildEmailHeader(branding = {}) {
  const b = resolveBranding(branding);

  const headerContent = b.logoUrl
    ? `<table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>`
      + `<td style="vertical-align:middle;padding-right:25px;">`
      + `<img src="${escHtml(b.logoUrl)}" alt="${escHtml(b.brandName)}" style="height:80px;width:auto;display:block;">`
      + `</td>`
      + `<td style="vertical-align:middle;">`
      + `<h1 style="color:${b.accentColor};margin:0;font-size:22px;font-family:Georgia,'Times New Roman',serif;letter-spacing:3px;text-transform:uppercase;line-height:1.3;">${escHtml(b.brandName)}</h1>`
      + `<p style="color:${b.accentColor};margin:5px 0 0;font-size:12px;font-family:Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;opacity:0.9;font-weight:300;">Self-Nomination Entry Confirmation</p>`
      + `</td>`
      + `</tr></table>`
    : `<h1 style="color:${b.accentColor};margin:0;font-size:24px;font-family:Georgia,'Times New Roman',serif;letter-spacing:3px;text-transform:uppercase;">${escHtml(b.brandName)}</h1>`
      + `<p style="color:${b.accentColor};margin:8px 0 0;font-size:13px;letter-spacing:2px;text-transform:uppercase;opacity:0.9;">Self-Nomination Entry Confirmation</p>`;

  return `<div style="background:linear-gradient(135deg,${b.primaryColor} 0%,${b.secondaryColor} 100%);padding:28px 32px;text-align:center;border-bottom:3px solid ${b.accentColor};">
    ${headerContent}
  </div>`;
}

/**
 * Build the email footer HTML block.
 */
function buildEmailFooter(branding = {}) {
  const b = resolveBranding(branding);

  const footerLinks = [
    b.websiteUrl   ? `<a href="https://${escHtml(b.websiteUrl)}" style="color:${b.accentColor};text-decoration:none;">${escHtml(b.websiteUrl)}</a>` : '',
    b.contactEmail ? `<a href="mailto:${escHtml(b.contactEmail)}" style="color:${b.accentColor};text-decoration:none;">${escHtml(b.contactEmail)}</a>` : ''
  ].filter(Boolean).join(' &nbsp;|&nbsp; ');

  return `<div style="background:${b.secondaryColor};padding:24px 32px;text-align:center;font-size:12px;color:#999;">
    <p style="margin:0;">${escHtml(b.brandName)}${footerLinks ? ' | ' + footerLinks : ''}</p>
  </div>`;
}

/**
 * Wrap arbitrary body HTML in a complete branded email document.
 * This is the single wrapper every sending path should use.
 */
function wrapEmail(bodyContent, branding = {}, { subject = '', preheader = '' } = {}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  ${subject ? `<title>${escHtml(subject)}</title>` : ''}
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f7;">
    <tr>
      <td align="center" style="padding:30px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr><td>${buildEmailHeader(branding)}</td></tr>
          <tr><td style="padding:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#333333;">${bodyContent}</td></tr>
          <tr><td>${buildEmailFooter(branding)}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = {
  escHtml,
  resolveBranding,
  buildEmailHeader,
  buildEmailFooter,
  wrapEmail,
};
