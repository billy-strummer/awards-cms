# Email Templates Audit — 2026-05-30

## Summary

Audit of `api/_lib/email-templates.js` (17 templates, ~565 lines) and the DB template substitution path in `api/email-automation.js`. Covers XSS vectors, GDPR compliance, HTML email best practices, and template completeness.

**Severity counts:** 1 Critical · 2 High · 2 Medium · 2 Low

---

## CRITICAL

### [x] EA-C1 — Unescaped user data in database-template substitution path

- **File:** `api/email-automation.js` — DB template variable substitution (~line 155–159)
- **Description:** When an email template is loaded from the `email_templates` database table (as opposed to the hardcoded `EMAIL_TEMPLATES` object), variable substitution is performed with a plain `.replace(regex, value)` call. The `value` comes from user-supplied fields such as `company_name`, `contact_name`, `entry_description`, and `nomination_reason` without any HTML escaping. The hardcoded templates correctly call `escapeHtml()` before interpolation (line ~194), but the DB template path does not. An attacker who can control one of these fields could inject arbitrary HTML/JavaScript into emails sent to recipients, potentially phishing judges or admins.
- **Suggested fix:** Apply `escapeHtml()` to every `value` before substitution in the DB template path:
  ```js
  const safeValue = escapeHtml(String(value ?? ''));
  subject = subject.replace(regex, safeValue);
  body = body.replace(regex, safeValue);
  ```

---

## HIGH

### [x] EA-H1 — Marketing-style emails missing unsubscribe mechanism (GDPR / CAN-SPAM)

- **Files:** `api/_lib/email-templates.js` — `ENTRY_DEADLINE_REMINDER`, `PAYMENT_REMINDER`, `DEADLINE_REMINDER` templates
- **Description:** These templates encourage recipients to take action (submit an entry, pay an invoice) which qualifies them as promotional under CAN-SPAM and GDPR Article 7. None include an unsubscribe link or opt-out mechanism. Under GDPR, recipients must be able to withdraw consent for commercial communications; under CAN-SPAM, opt-out must be honoured within 10 business days. Absence of an unsubscribe link could expose the organisation to regulatory penalties.
- **Suggested fix:** Add an `{{unsubscribe_link}}` placeholder to the footer of each affected template. Pass the unsubscribe URL when calling `sendTemplate` (can be a pre-generated one-click unsubscribe endpoint or a preferences page URL). In `email-automation.js`, populate the placeholder from `process.env.APP_URL + '/unsubscribe?token=' + token`.

### [x] EA-H2 — "Contact us" text in templates links to nothing

- **Files:** `api/_lib/email-templates.js` — multiple templates, lines ~167, 295, 389
- **Description:** Several templates include the phrase "If you have any questions, please contact us" or similar without a linked email address, phone number, or URL. Recipients who need help have no way to reach the team from the email itself. This is particularly problematic for payment and entry confirmation emails where recipients may have urgent questions.
- **Suggested fix:** Replace generic "contact us" text with a linked email address:
  ```html
  <a href="mailto:{{support_email}}">contact us</a>
  ```
  Pass `support_email: process.env.FROM_EMAIL` when building each template.

---

## MEDIUM

### [x] EA-M1 — CSS gradients in winner/shortlist emails render poorly in Outlook and Gmail

- **Files:** `api/_lib/email-templates.js` — `SHORTLIST_NOTIFICATION` (~line 181), `WINNER_ANNOUNCEMENT` (~lines 214, 249)
- **Description:** `background: linear-gradient(135deg, ...)` is used for header/hero sections. Gmail strips CSS gradients entirely (showing a transparent/white background), and Outlook does not support them at all. The emails will look broken in two of the most widely used email clients.
- **Suggested fix:** Replace gradient backgrounds with solid `background-color` fallbacks:
  ```html
  <!-- Replace gradient with solid colour that matches your brand -->
  background-color: #1a3a5c;
  ```
  Alternatively, use a prerendered gradient image as a background (more complex but fully compatible).

### [x] EA-M2 — Preheader text never set, leaving email previews blank

- **File:** `api/email-automation.js` — `buildEmailWrapper()` call; `api/_lib/email-header.js` — `preheader` parameter
- **Description:** The email wrapper in `email-header.js` supports a `preheader` parameter (the 40–100 character preview text shown in email clients before the message is opened). However, none of the template calls pass a preheader value, leaving the preview blank or defaulting to the first visible text of the email body. A good preheader significantly increases open rates and gives recipients context.
- **Suggested fix:** Add a `preheader` field to each template object in `EMAIL_TEMPLATES` and pass it when calling the email wrapper:
  ```js
  // In EMAIL_TEMPLATES:
  ENTRY_CONFIRMATION: {
    preheader: 'Your entry has been received — here are the details.',
    subject: '...',
    body: '...',
  }
  ```

---

## LOW

### [x] EA-L1 — No plain-text fallback in any outgoing email

- **Files:** `api/email-automation.js`, `api/_lib/email-header.js`
- **Description:** All emails are sent as HTML-only via Resend. Best practice (and a minor spam-score factor) is to include a plain-text `text` part alongside the HTML `html` part. Some recipients use text-only email clients (screen readers, command-line mail). Resend supports `{ html: '...', text: '...' }` payloads.
- **Suggested fix:** Add a `stripHtmlToText(html)` utility and pass `text: stripHtmlToText(body)` alongside `html: body` in the Resend send call. A simple implementation strips tags and decodes entities.

### [x] EA-L2 — All 17 templates use `DB_TEMPLATE_TYPE_MAP` correctly — no orphaned templates

- **Status:** No action needed — this is a clean finding.
- **Description:** All 17 entries in `EMAIL_TEMPLATES` have corresponding `DB_TEMPLATE_TYPE_MAP` entries. No dead or unmapped templates exist.

---

## How to work through this list

1. Work through items EA-C1 → EA-H1 → EA-H2 → EA-M1 → EA-M2 → EA-L1 in order
2. Run `npm test` after each change — the email-automation tests mock the Resend API so they will catch regressions
3. Mark each item `[x]` in the same commit as the fix
4. Push to `claude/continue-cms-build-gknZa`
