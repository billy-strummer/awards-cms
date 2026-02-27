/**
 * Shared Email Wrapper for Supabase Edge Functions
 * -------------------------------------------------
 * Deno-compatible port of api/email-header.js.
 * Every email-sending edge function MUST use wrapEmail() so that all
 * outbound messages include the branded header and footer.
 *
 * Usage:
 *   import { wrapEmail, fetchBranding } from '../_shared/email-wrapper.ts'
 *
 *   const branding = await fetchBranding(supabaseClient);
 *   const html = wrapEmail(bodyHtml, branding, { subject, subtitle });
 */

// ── Helpers ──────────────────────────────────────────────────────────

export function escHtml(s: string | null | undefined): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface Branding {
  company_name?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  logo_url?: string;
  email_from?: string;
  email_reply_to?: string;
  custom_domain?: string;
}

interface ResolvedBranding {
  brandName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;
  contactEmail: string;
  websiteUrl: string;
}

/**
 * Resolve branding fields with sensible defaults.
 */
export function resolveBranding(branding: Branding = {}): ResolvedBranding {
  return {
    brandName:      branding.company_name    || Deno.env.get('FROM_NAME') || 'British Trade Awards',
    primaryColor:   branding.primary_color   || '#000000',
    secondaryColor: branding.secondary_color || '#1a1a1a',
    accentColor:    branding.accent_color    || '#D4AF37',
    logoUrl:        branding.logo_url        || Deno.env.get('BTA_LOGO_URL') || '',
    contactEmail:   branding.email_from      || branding.email_reply_to || Deno.env.get('FROM_EMAIL') || '',
    websiteUrl:     branding.custom_domain   || '',
  };
}

// ── Header ───────────────────────────────────────────────────────────

/**
 * Build the branded email header HTML block.
 * Logo present  → side-by-side (logo left, brand name + subtitle right)
 * No logo       → centred brand name + subtitle
 */
export function buildEmailHeader(
  branding: Branding = {},
  { subtitle = 'Self-Nomination Entry Confirmation' } = {},
): string {
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

// ── Footer ───────────────────────────────────────────────────────────

/**
 * Build the branded email footer HTML block.
 */
export function buildEmailFooter(branding: Branding = {}): string {
  const b = resolveBranding(branding);
  const domain = b.websiteUrl || 'britishtradeawards.com';

  return `<div style="background:${b.secondaryColor};padding:24px 32px;text-align:center;font-size:12px;color:${b.accentColor};">
    <p style="margin:0;">&copy; ${escHtml(b.brandName)} | <a href="https://${escHtml(domain)}" style="color:${b.accentColor};text-decoration:none;">${escHtml(domain)}</a></p>
  </div>`;
}

// ── Full email wrapper ───────────────────────────────────────────────

interface WrapOptions {
  subject?: string;
  preheader?: string;
  subtitle?: string;
}

/**
 * Wrap arbitrary body HTML in a complete branded email document.
 * ALL edge functions that send email MUST call this function so that
 * every outbound message has the branded header and footer.
 */
export function wrapEmail(
  bodyContent: string,
  branding: Branding = {},
  { subject = '', preheader = '', subtitle = '' }: WrapOptions = {},
): string {
  const b = resolveBranding(branding);
  const resolvedHeader = buildEmailHeader(branding, {
    subtitle: subtitle || 'Self-Nomination Entry Confirmation',
  });
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

// ── Branding loader ──────────────────────────────────────────────────

/**
 * Fetch tenant branding from the database.
 * Returns an empty object on failure so callers always get defaults.
 */
export async function fetchBranding(
  supabaseClient: { from: (table: string) => any },
): Promise<Branding> {
  try {
    const { data } = await supabaseClient
      .from('tenant_branding')
      .select('*')
      .eq('tenant_id', 'default')
      .maybeSingle();
    return data || {};
  } catch {
    return {};
  }
}

/**
 * Convert plain-text email body to simple HTML.
 * Preserves line breaks and wraps in a styled container.
 */
export function textToHtml(text: string): string {
  const escaped = escHtml(text);
  // Convert double newlines to paragraph breaks, single newlines to <br>
  const html = escaped
    .replace(/\n\n/g, '</p><p style="margin:0 0 16px 0;">')
    .replace(/\n/g, '<br>');
  return `<div style="padding:30px 40px;"><p style="margin:0 0 16px 0;">${html}</p></div>`;
}
