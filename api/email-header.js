/* ==================================================== */
/* SHARED EMAIL HEADER & WRAPPER                        */
/* Single source of truth for the branded email layout. */
/* All email-sending paths import from this module.     */
/*                                                      */
/* Header/footer are built from tenant_branding values. */
/* The subtitle text changes per email type (e.g.       */
/* "Self-Nomination Entry Confirmation").                */
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
 * Exact replica of the website header in submit-entry.html.
 * Logo present  → side-by-side (logo left, brand name + subtitle right)
 * No logo       → centred brand name + subtitle
 *
 * Matches: padding 35px 40px, logo 100px, heading ~2rem (28px email-safe),
 * Cinzel-like Georgia serif, Montserrat-like subtitle at 14px weight 300,
 * text-shadow on heading, gold drop-shadow on logo.
 */
function buildEmailHeader(branding = {}, { subtitle = 'Self-Nomination Entry Confirmation' } = {}) {
  const b = resolveBranding(branding);
  const safeSubtitle = escHtml(subtitle);

  const headerContent = b.logoUrl
    ? `<table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>`
      + `<td style="vertical-align:middle;padding-right:25px;">`
      + `<img src="${escHtml(b.logoUrl)}" alt="${escHtml(b.brandName)}" style="height:100px;width:auto;display:block;">`
      + `</td>`
      + `<td style="vertical-align:middle;">`
      + `<h1 style="color:${b.accentColor};margin:0;font-size:28px;font-family:Georgia,'Times New Roman',serif;font-weight:900;letter-spacing:3px;text-transform:uppercase;line-height:1.3;text-shadow:0 2px 8px rgba(0,0,0,0.5);">${escHtml(b.brandName)}</h1>`
      + `<p style="color:${b.accentColor};margin:5px 0 0;font-size:14px;font-family:Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;opacity:0.95;font-weight:300;">${safeSubtitle}</p>`
      + `</td>`
      + `</tr></table>`
    : `<h1 style="color:${b.accentColor};margin:0;font-size:28px;font-family:Georgia,'Times New Roman',serif;font-weight:900;letter-spacing:3px;text-transform:uppercase;text-shadow:0 2px 8px rgba(0,0,0,0.5);">${escHtml(b.brandName)}</h1>`
      + `<p style="color:${b.accentColor};margin:5px 0 0;font-size:14px;font-family:Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;opacity:0.95;font-weight:300;">${safeSubtitle}</p>`;

  return `<div style="background:linear-gradient(135deg,${b.primaryColor} 0%,${b.secondaryColor} 100%);padding:35px 40px;text-align:center;border-bottom:3px solid ${b.accentColor};">
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
 *
 * Options:
 *   subject   – email subject (used in <title>)
 *   preheader – hidden preheader text
 *   subtitle  – text shown below the brand name in the header
 */
function wrapEmail(bodyContent, branding = {}, { subject = '', preheader = '', subtitle = '' } = {}) {
  const b = resolveBranding(branding);
  const resolvedHeader = buildEmailHeader(branding, { subtitle: subtitle || 'Self-Nomination Entry Confirmation' });
  const resolvedFooter = buildEmailFooter(branding);

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
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;border:2px solid ${b.accentColor};box-shadow:0 20px 60px rgba(212,175,55,0.3);">
          <tr><td>${resolvedHeader}</td></tr>
          <tr><td style="padding:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#333333;">${bodyContent}</td></tr>
          <tr><td>${resolvedFooter}</td></tr>
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
