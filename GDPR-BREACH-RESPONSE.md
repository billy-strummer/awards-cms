# Data Breach Incident Response — GDPR Article 33

## Overview

UK GDPR Article 33 requires notification to the ICO within **72 hours** of becoming aware of a personal data breach, unless it is unlikely to result in a risk to individuals' rights and freedoms.

---

## Breach Response Steps

### Step 1 — Contain (Within 1 hour)
- [ ] Identify and isolate the affected systems (disable API keys, rotate credentials)
- [ ] Preserve evidence (logs, access records) — do NOT delete anything yet
- [ ] Notify internal stakeholders: Technical Lead, Company Director

### Step 2 — Assess (Within 24 hours)
Document in the breach log (see table below):
- What data was exposed? (names, emails, payment details, entries, etc.)
- How many individuals are affected?
- When did the breach occur (likely range if exact time unknown)?
- What was the cause? (misconfiguration, credential leak, injection, etc.)
- What is the risk of harm? (identity theft, financial loss, discrimination, distress)

**ICO risk threshold:** Notify the ICO if there is a risk to individuals. Always notify if data included: financial details, health data, special category data, or data belonging to vulnerable people.

### Step 3 — Notify ICO (Within 72 hours of discovery)
- **Online report:** https://ico.org.uk/for-organisations/report-a-breach/
- **ICO breach line:** 0303 123 1113
- **Required information:** Nature of breach, categories and approximate number of individuals, approximate number of records, DPO contact details, likely consequences, measures taken or proposed.

### Step 4 — Notify Individuals (If high risk)
If the breach is likely to result in high risk to individuals, notify them **without undue delay** in plain English:
- What happened
- What data was involved
- What they can do to protect themselves
- How to contact us with questions
- How to complain to the ICO

### Step 5 — Document
- Complete the breach log below
- Document all decisions made (especially if ICO notification was NOT sent, explain why)
- Review and improve controls that failed

---

## Key Contacts

| Role | Contact |
|------|---------|
| Technical Lead / DPO | [Fill in] |
| Company Director | [Fill in] |
| ICO (UK regulator) | 0303 123 1113 / report-breach@ico.org.uk |
| Legal Counsel | [Fill in] |

---

## Third-Party Processor Contacts

If the breach originated with a processor, they must notify us "without undue delay" (Article 33(2)):

| Processor | Contact | DPA Reference |
|-----------|---------|---------------|
| Supabase (database) | support@supabase.io | [DPA link] |
| Resend (email) | support@resend.com | [DPA link] |
| Stripe (payments) | https://support.stripe.com | [DPA link] |
| Vercel (hosting) | https://vercel.com/support | [DPA link] |
| Anthropic (AI vetting) | support@anthropic.com | [DPA link] |

---

## Breach Log Schema

Run this migration to create the breach log table in Supabase:

```sql
CREATE TABLE IF NOT EXISTS gdpr_breach_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discovery_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  breach_date_from    TIMESTAMPTZ,
  breach_date_to      TIMESTAMPTZ,
  data_types          TEXT[],       -- e.g. ['email', 'name', 'payment_details']
  affected_count      INTEGER,
  risk_level          TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  cause               TEXT,
  containment_steps   TEXT,
  notified_ico        BOOLEAN DEFAULT FALSE,
  ico_notification_at TIMESTAMPTZ,
  ico_reference       TEXT,
  notified_subjects   BOOLEAN DEFAULT FALSE,
  notes               TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Breach log should be append-only
ALTER TABLE gdpr_breach_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "breach_log_no_delete" ON gdpr_breach_log FOR DELETE USING (false);
CREATE POLICY "breach_log_no_update" ON gdpr_breach_log FOR UPDATE USING (false);
CREATE POLICY "breach_log_service_all" ON gdpr_breach_log FOR ALL
  USING (auth.role() = 'service_role');
```

---

## Data Categories Held by This System

| Data | Tables | Lawful Basis | Retention |
|------|--------|--------------|-----------|
| Contact names & emails | organisations, entries, event_guests, contacts | Legitimate interest | 3 years post-award |
| Entry submissions | entries | Legitimate interest | 3 years post-award |
| Payment details | invoices, payments | Contract | 7 years (legal) |
| Event registrations | event_guests | Contract | 2 years post-event |
| Voting records | public_votes | Legitimate interest | 1 year |
| Judging scores | judge_scores | Legitimate interest | 3 years |
| Email history | email_logs, notification_queue | Legitimate interest | 1 year |
| Audit trail | cms_audit_logs | Legal obligation | 2 years |
