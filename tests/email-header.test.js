/**
 * Tests for the email-header module
 * Run with: npx jest tests/email-header.test.js
 */

const { escHtml, resolveBranding, buildEmailHeader, buildEmailFooter, wrapEmail } = require('../api/email-header');

// ==========================================
// TESTS
// ==========================================

describe('Email Header Module', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env vars
    process.env = { ...originalEnv };
  });

  // --- escHtml ---

  describe('escHtml', () => {
    test('escapes ampersands', () => {
      expect(escHtml('A & B')).toBe('A &amp; B');
    });

    test('escapes less-than signs', () => {
      expect(escHtml('<script>')).toBe('&lt;script&gt;');
    });

    test('escapes greater-than signs', () => {
      expect(escHtml('a > b')).toBe('a &gt; b');
    });

    test('escapes double quotes', () => {
      expect(escHtml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    test('handles null input', () => {
      expect(escHtml(null)).toBe('');
    });

    test('handles undefined input', () => {
      expect(escHtml(undefined)).toBe('');
    });

    test('handles empty string', () => {
      expect(escHtml('')).toBe('');
    });

    test('handles numeric input', () => {
      expect(escHtml(42)).toBe('42');
    });

    test('escapes all special characters in combined string', () => {
      expect(escHtml('<div class="test"> & more</div>')).toBe(
        '&lt;div class=&quot;test&quot;&gt; &amp; more&lt;/div&gt;'
      );
    });

    test('leaves plain text unchanged', () => {
      expect(escHtml('Hello World')).toBe('Hello World');
    });
  });

  // --- resolveBranding ---

  describe('resolveBranding', () => {
    test('returns defaults when no branding provided', () => {
      delete process.env.FROM_NAME;
      delete process.env.BTA_LOGO_URL;
      delete process.env.FROM_EMAIL;

      const result = resolveBranding();

      expect(result.brandName).toBe('British Trade Awards');
      expect(result.primaryColor).toBe('#000000');
      expect(result.secondaryColor).toBe('#1a1a1a');
      expect(result.accentColor).toBe('#D4AF37');
      expect(result.logoUrl).toBe('');
      expect(result.contactEmail).toBe('');
      expect(result.websiteUrl).toBe('');
    });

    test('returns defaults when empty object provided', () => {
      const result = resolveBranding({});

      expect(result.brandName).toBe(process.env.FROM_NAME || 'British Trade Awards');
      expect(result.primaryColor).toBe('#000000');
    });

    test('uses branding values when provided', () => {
      const branding = {
        company_name: 'Custom Awards',
        primary_color: '#FF0000',
        secondary_color: '#00FF00',
        accent_color: '#0000FF',
        logo_url: 'https://example.com/logo.png',
        email_from: 'from@custom.com',
        custom_domain: 'awards.custom.com',
      };

      const result = resolveBranding(branding);

      expect(result.brandName).toBe('Custom Awards');
      expect(result.primaryColor).toBe('#FF0000');
      expect(result.secondaryColor).toBe('#00FF00');
      expect(result.accentColor).toBe('#0000FF');
      expect(result.logoUrl).toBe('https://example.com/logo.png');
      expect(result.contactEmail).toBe('from@custom.com');
      expect(result.websiteUrl).toBe('awards.custom.com');
    });

    test('falls back to FROM_NAME env var', () => {
      process.env.FROM_NAME = 'Env Awards';

      const result = resolveBranding({});

      expect(result.brandName).toBe('Env Awards');
    });

    test('falls back to BTA_LOGO_URL env var', () => {
      process.env.BTA_LOGO_URL = 'https://env.com/logo.png';

      const result = resolveBranding({});

      expect(result.logoUrl).toBe('https://env.com/logo.png');
    });

    test('falls back to FROM_EMAIL env var', () => {
      process.env.FROM_EMAIL = 'env@test.com';

      const result = resolveBranding({});

      expect(result.contactEmail).toBe('env@test.com');
    });

    test('prefers email_from over email_reply_to', () => {
      const branding = {
        email_from: 'from@test.com',
        email_reply_to: 'reply@test.com',
      };

      const result = resolveBranding(branding);

      expect(result.contactEmail).toBe('from@test.com');
    });

    test('falls back to email_reply_to when email_from is empty', () => {
      const branding = {
        email_reply_to: 'reply@test.com',
      };

      const result = resolveBranding(branding);

      expect(result.contactEmail).toBe('reply@test.com');
    });
  });

  // --- buildEmailHeader ---

  describe('buildEmailHeader', () => {
    test('builds header with default subtitle', () => {
      const header = buildEmailHeader();

      expect(header).toContain('Self-Nomination Entry Confirmation');
      expect(header).toContain('background:linear-gradient');
      expect(header).toContain('border-bottom:3px solid');
    });

    test('builds header with custom subtitle', () => {
      const header = buildEmailHeader({}, { subtitle: 'Winner Announcement' });

      expect(header).toContain('Winner Announcement');
      expect(header).not.toContain('Self-Nomination Entry Confirmation');
    });

    test('builds header with logo when logo URL is provided', () => {
      const branding = {
        logo_url: 'https://example.com/logo.png',
        company_name: 'Test Awards',
      };

      const header = buildEmailHeader(branding);

      expect(header).toContain('<img src=');
      expect(header).toContain('https://example.com/logo.png');
      expect(header).toContain('Test Awards');
      expect(header).toContain('<table');
    });

    test('builds centered header without logo', () => {
      const branding = {
        company_name: 'No Logo Awards',
      };

      const header = buildEmailHeader(branding);

      expect(header).toContain('No Logo Awards');
      expect(header).not.toContain('<img');
      expect(header).toContain('<h1');
    });

    test('applies branding colors', () => {
      const branding = {
        primary_color: '#112233',
        secondary_color: '#445566',
        accent_color: '#AABBCC',
      };

      const header = buildEmailHeader(branding);

      expect(header).toContain('#112233');
      expect(header).toContain('#445566');
      expect(header).toContain('#AABBCC');
    });

    test('escapes HTML in brand name', () => {
      const branding = {
        company_name: '<script>alert("xss")</script>',
      };

      const header = buildEmailHeader(branding);

      expect(header).not.toContain('<script>');
      expect(header).toContain('&lt;script&gt;');
    });

    test('escapes HTML in subtitle', () => {
      const header = buildEmailHeader({}, { subtitle: '<b>Bold</b>' });

      expect(header).not.toContain('<b>Bold</b>');
      expect(header).toContain('&lt;b&gt;Bold&lt;/b&gt;');
    });
  });

  // --- buildEmailFooter ---

  describe('buildEmailFooter', () => {
    test('builds footer with default domain', () => {
      const footer = buildEmailFooter();

      expect(footer).toContain('britishtradeawards.com');
      expect(footer).toContain('&copy;');
    });

    test('builds footer with custom domain', () => {
      const branding = {
        custom_domain: 'awards.example.com',
      };

      const footer = buildEmailFooter(branding);

      expect(footer).toContain('awards.example.com');
    });

    test('applies branding secondary color', () => {
      const branding = {
        secondary_color: '#FF0000',
      };

      const footer = buildEmailFooter(branding);

      expect(footer).toContain('#FF0000');
    });

    test('applies branding accent color', () => {
      const branding = {
        accent_color: '#00FF00',
      };

      const footer = buildEmailFooter(branding);

      expect(footer).toContain('#00FF00');
    });

    test('escapes HTML in brand name in footer', () => {
      const branding = {
        company_name: 'Test & Co',
      };

      const footer = buildEmailFooter(branding);

      expect(footer).toContain('Test &amp; Co');
    });
  });

  // --- wrapEmail ---

  describe('wrapEmail', () => {
    test('wraps body content in full HTML email', () => {
      const html = wrapEmail('<p>Hello World</p>');

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<head>');
      expect(html).toContain('<body');
      expect(html).toContain('<p>Hello World</p>');
      expect(html).toContain('</html>');
    });

    test('includes branded header and footer', () => {
      const html = wrapEmail('<p>Content</p>');

      // Should contain header
      expect(html).toContain('background:linear-gradient');
      // Should contain footer
      expect(html).toContain('&copy;');
    });

    test('adds subject as title tag', () => {
      const html = wrapEmail('<p>Content</p>', {}, { subject: 'Welcome Email' });

      expect(html).toContain('<title>Welcome Email</title>');
    });

    test('skips title tag when no subject', () => {
      const html = wrapEmail('<p>Content</p>', {}, { subject: '' });

      expect(html).not.toContain('<title>');
    });

    test('adds preheader text when provided', () => {
      const html = wrapEmail('<p>Content</p>', {}, { preheader: 'Preview text here' });

      expect(html).toContain('display:none');
      expect(html).toContain('Preview text here');
    });

    test('skips preheader div when no preheader', () => {
      const html = wrapEmail('<p>Content</p>', {}, { preheader: '' });

      expect(html).not.toContain('display:none;max-height:0;overflow:hidden;');
    });

    test('passes subtitle to header', () => {
      const html = wrapEmail('<p>Content</p>', {}, { subtitle: 'Custom Subtitle' });

      expect(html).toContain('Custom Subtitle');
    });

    test('uses default subtitle when none provided', () => {
      const html = wrapEmail('<p>Content</p>');

      expect(html).toContain('Self-Nomination Entry Confirmation');
    });

    test('applies branding colors', () => {
      const branding = {
        primary_color: '#111111',
        accent_color: '#GOLD01',
      };

      const html = wrapEmail('<p>Content</p>', branding);

      expect(html).toContain('#GOLD01');
      expect(html).toContain('#111111');
    });

    test('escapes subject in title tag', () => {
      const html = wrapEmail('<p>Content</p>', {}, { subject: '<script>alert("xss")</script>' });

      expect(html).not.toContain('<script>alert');
      expect(html).toContain('&lt;script&gt;');
    });

    test('produces valid email structure with all options', () => {
      const branding = {
        company_name: 'Full Test Awards',
        primary_color: '#AA0000',
        secondary_color: '#BB0000',
        accent_color: '#CC0000',
        logo_url: 'https://example.com/full-logo.png',
        email_from: 'full@test.com',
        custom_domain: 'full.example.com',
      };

      const html = wrapEmail('<p>Full options test</p>', branding, {
        subject: 'Full Subject',
        preheader: 'Full Preheader',
        subtitle: 'Full Subtitle',
      });

      expect(html).toContain('Full Test Awards');
      expect(html).toContain('Full Subject');
      expect(html).toContain('Full Preheader');
      expect(html).toContain('Full Subtitle');
      expect(html).toContain('full.example.com');
      expect(html).toContain('https://example.com/full-logo.png');
      expect(html).toContain('<p>Full options test</p>');
    });

    test('wraps content in 600px table layout', () => {
      const html = wrapEmail('<p>Layout test</p>');

      expect(html).toContain('width="600"');
      expect(html).toContain('border-radius:16px');
    });
  });
});
