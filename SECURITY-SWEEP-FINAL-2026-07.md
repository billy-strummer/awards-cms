# Final Database Security Sweep — Claude TEST CMS

**Date:** 2026-07-22. Scope: Claude TEST CMS only. `british-trade-awards-cms` was not touched at any point.

**Headline, stated plainly up front: the answer to the sweep question is YES — there are more remaining non-conforming items, and two of them are more severe than anything fixed so far in this engagement.** TEST CMS is **not yet** the fully-secured reference implementation. Details and a complete list below.

---

## 1–4. `award_assignments` / `event_guests` investigation, fix, and verification

**Investigated fully, as requested, before writing anything:**

- **`award_assignments`**: already correctly configured. No leftover permissive policy. Its `award_assignments_select` policy (authenticated, `SELECT` only, unscoped) is a deliberate, already-correct design — confirmed empirically (anon `SELECT`/`INSERT` blocked at the grant level; authenticated `SELECT` works, `INSERT` blocked by RLS). **My previous report was wrong to include this table as vulnerable — corrected here.** No change made.
- **`event_guests`**: genuinely vulnerable, confirmed empirically before any fix (anon could both `SELECT` and `INSERT` a real row). Migration 078 removed the obsolete leftover policy from migration 000.

**Migration 078 broke a real feature** — `check-in-app.js` (Event Check-in, used by staff scanning QR codes) makes direct `authenticated`-role Supabase calls to `event_guests`, bypassing `data-proxy.js` entirely. Stopped and asked before proceeding, per your instruction.

**Migration 079 restored it with least privilege**, per your explicit direction:
- Analysed `check-in-app.js` precisely: `SELECT` (load guest list, look up scanned QR code) and `UPDATE` (`checked_in`, `check_in_time`) only. No `INSERT`, no `DELETE` anywhere in that file.
- Security boundary chosen: blanket `authenticated` (matching `entries_select`/`award_assignments_select`'s existing shape) — the only two patterns that exist anywhere in this schema are blanket-authenticated and row-ownership via `user_email()`; ownership doesn't apply here (staff aren't the "owner" of a guest row), and there's no tenant_id column on this table or any staff-to-event assignment table to scope by more tightly. Not inventing a new pattern — reusing the existing one that actually fits.
- Granted exactly `SELECT` + `UPDATE`, nothing more.

**Verified with real tests, not inspection:**
| Check | Result |
|---|---|
| service_role full access | ✅ confirmed via the real `data-proxy.js` code path |
| anon `SELECT`/`UPDATE`/`INSERT` | ✅ all blocked — `UPDATE` specifically verified by re-reading the row afterward, since PostgREST returns `200`/empty-array for an RLS-filtered update rather than an explicit error |
| authenticated `SELECT`+`UPDATE` (what the feature needs) | ✅ both work — a real guest's `checked_in`/`check_in_time` were genuinely updated and confirmed via service-role re-read |
| authenticated `INSERT`/`DELETE` (not needed, should stay blocked) | ✅ both blocked — the `DELETE`'s `204` response was verified to be a zero-row no-op, not an actual deletion |
| Full QR check-in flow end-to-end | ✅ simulated exactly: insert a guest via service-role → authenticated `SELECT` finds it → authenticated `UPDATE` marks it checked in → confirmed via service-role |
| No other application behaviour affected | ✅ full data snapshot before/after this entire session is byte-identical |

**Also checked, per your explicit "stop and explain" instruction:**
- `events`: already correctly configured (authenticated-select-only, no leftover policy). No issue, no action needed.
- `table_assignments`: has the exact same un-migrated "Allow all access" pattern as the other 80 tables below. `check-in-app.js`'s read of it currently works only because the table is wide open, not because it has a correct policy. Not touched — out of scope for this event_guests-focused fix, already part of the broader finding below.

---

## 5. Complete security sweep — answering the one question

**Are there remaining tables, views, functions, buckets, triggers, grants, or RLS policies that do not conform to the intended architecture? Yes.** Every item below is unfixed and awaiting your decision — nothing here has been changed.

### Tables (80) — same class as the original 3-table finding, not yet remediated

All 80 still carry the original migration-000 `"Allow all access" USING (true)` policy with no service-role-only hardening ever applied, and all have the standard broad `anon`/`authenticated` grants (confirmed via the same grants query used to find the original 3):

`ai_vetting_results, ai_vetting_runs, announcements, api_request_logs, areas, award_seasons, banners, calendar_feeds, certificate_templates, cms_audit_logs, contact_segments, counties, deliberation_notes, document_versions, documents, email_campaign_recipients, email_import_batches, email_list_subscribers, email_log, email_unsubscribes, entry_files, entry_revisions, event_attendees, event_budget_items, event_budgets, event_milestones, event_post_data, event_room_fixtures, event_special_requirements, event_tables, event_templates, event_ticket_types, event_tickets, event_vendors, event_waitlist, gallery_sections, gdpr_requests, invoice_line_items, ip_blocklist, judge_scores, media_gallery, media_items, meeting_notes, notification_preferences, notification_queue, notifications, org_activity_notes, org_audit_log, organisation_comms_log, organisation_custom_fields, organisation_documents, organisation_images, organisation_notes, organisation_relationships, organisation_segments, payment_reminders, public_votes, rate_limit_alerts, rate_limit_config, regions, running_order, running_order_settings, running_order_versions, scheduled_reports, seating_sections, shortlists, social_campaigns, social_media_posts, sponsor_assignments, sponsor_contracts, sponsor_impressions, sponsors, sponsorship_opportunities, table_assignments, tenant_branding, user_roles, webhook_logs, webhooks, winner_documents, winner_media`

Notable ones given what they are: `user_roles` (role assignments), `ip_blocklist`/`rate_limit_config` (the security controls themselves), `webhooks`/`webhook_logs`, `cms_audit_logs`/`org_audit_log` (audit trails — tamperable/deletable), `gdpr_requests`, `sponsor_contracts`.

### Views (15) — new finding this pass, more severe than it first appears

**Every view in the schema bypasses the RLS of its underlying tables on `SELECT`**, including views built on tables that were *already correctly hardened* by migration 052 months ago. Postgres views run with the **view owner's** privileges by default, not the querying role's, unless `security_invoker` is explicitly set — none of these 15 have it set, and all 15 have `anon`+`authenticated` grants:

`activity_log, awards, awards_with_stats, communication_activity, deal_pipeline_summary, email_list_members, email_lists_with_stats, invoices_with_details, media_gallery_with_details, organisations_with_crm_summary, organisations_with_stats, payment_summary_by_organisation, running_order_full, table_plan_summary, upcoming_follow_ups`

**Proved this empirically, not theoretically**: direct `SELECT` against `organisations` (anon key) correctly returns `[]` — but `SELECT` against `organisations_with_stats` (the view over the same table) returned **real company names and IDs**. `invoices_with_details` returned `[]` too, but only because `invoices` currently has zero rows on this project — confirmed the table is empty, not that access is blocked, so the same leak would occur the moment real invoice data exists.

**This means the original migration-052 hardening of `organisations`/`award_years`/`entries`/`invoices`/`payments` has effectively been bypassable via their corresponding views this whole time**, for as long as those views have existed with public grants and no `security_invoker`.

### Functions (6) — the single most severe finding of this entire review

Six `SECURITY DEFINER` functions (execute with the function owner's privileges, unconditionally bypassing RLS) are all granted `EXECUTE` to `anon`: `check_email_config`, `process_scheduled_campaigns`, `send_campaign_emails`, `send_entry_confirmation_email`, `send_single_email`, `send_test_email`.

**`send_single_email(p_to, p_subject, p_html, p_from, p_reply_to)` and `send_test_email(...)` read the platform's real Resend API key from `cms_config` and issue an HTTP POST directly to `api.resend.com`, with the recipient, subject, HTML body, and from-address entirely controlled by the caller.** Confirmed `resend_api_key` is actually configured (non-empty) on this project. Any anonymous internet user can call `POST /rest/v1/rpc/send_single_email` and send an arbitrary email — any content, any "from" name — through this platform's paid Resend account and sending-domain reputation. This is a fully open, unauthenticated email relay.

`send_campaign_emails` extends this to the platform's *real subscriber lists* (mass-send to everyone on a given list with attacker-chosen HTML). `process_scheduled_campaigns` lets anyone force every currently-scheduled campaign to send immediately, regardless of its intended schedule. `send_entry_confirmation_email` is narrower (recipient is tied to a real entry's contact_email, and entries older than 24h are rejected) but still lets an anonymous caller trigger repeat sends to real business contacts by guessing/enumerating entry IDs.

**I deliberately did not execute any of these six functions to confirm this**, even with harmless-looking test content — doing so would itself trigger a real, uncontrolled outbound email via the real Resend account, which is not an acceptable side effect of a security test. The conclusion rests on the function definitions and grants alone, which is conclusive on its own given `SECURITY DEFINER` semantics.

### Storage (1 of 2 buckets) — confirmed exploitable, not just theoretical

`certificate-assets` bucket: `public: true`, no file-size limit, no MIME-type restriction. Its `storage.objects` policies are named `"Auth upload/update/delete certificate-assets"` — clearly intended to mean `authenticated`-only, matching the naming convention correctly used for the sibling `brand-assets` bucket — but the actual `roles` on all three (`INSERT`/`UPDATE`/`DELETE`) are `{public}`, not `{authenticated}`. This looks like a real bug in migration 049 (the `TO authenticated` clause was likely omitted).

**Confirmed exploitable, not theoretical**: uploaded a real file to this bucket using only the anon key (`HTTP 200`, real object created), then confirmed it was immediately, publicly readable at a public URL. Combined with no size/type limits, this is an open, anonymous, unauthenticated file-upload vector into public storage — usable for storage-cost abuse, hosting arbitrary content (including malicious content) on the platform's own domain, or overwriting/deleting real certificate assets. Cleaned up immediately after confirming (deleted via service-role, confirmed gone).

### Triggers — no new issues, one informational (non-security) finding

40 triggers checked, all business-logic maintenance (timestamps, derived totals, count caches) — nothing security-relevant. One informational item while checking the `awards` view's write grants: `authenticated` has `INSERT`/`UPDATE`/`DELETE` grants on the view (not just `SELECT`), but the `INSTEAD OF` triggers (`awards_insert_fn`/`update_fn`/`delete_fn`) are `SECURITY INVOKER`, so an attempted write correctly hits `award_years`' own RLS and is filtered to zero rows — **confirmed empirically**: attempted an authenticated `UPDATE` through the view on a real row, got back a response that *looked* successful (the "new" value echoed in the JSON), but re-checking via service-role showed the row was completely unchanged. This is not a vulnerability (RLS worked correctly) but is a genuinely misleading interface — a write through this view silently no-ops while appearing to succeed. Not urgent: the real application (`awards.js`) always writes via `data-proxy.js`'s service-role key, never through this view directly, so nothing in the live app is affected.

### Grants — covered above; no additional standalone findings beyond what's listed

---

## What I did NOT do

I did not fix any of the items in section 5. They are new findings from this sweep, well beyond what you authorized for this pass (`award_assignments`/`event_guests`), and given their severity — especially the two critical ones — they deserve their own explicit decision rather than being bundled into a "while I was in there" fix.

## Honest answer to the reference-implementation question

**Claude TEST CMS is not yet the reference implementation production should be brought into alignment with.** The `event_guests` work this pass is genuinely complete and correctly verified. But the sweep you asked me to run surfaced two issues more severe than anything closed so far:

1. An unauthenticated, fully open email-sending relay through six database functions (worst: `send_single_email`/`send_test_email`, no restriction on recipient, content, or sender identity).
2. A real, confirmed, anonymous file-upload vulnerability in the `certificate-assets` storage bucket.

Plus 80 tables and 15 views still on the pre-hardening pattern, the latter undermining the RLS work already done on `organisations`/`award_years`/`entries`/`invoices`/`payments` for read access.

I'd recommend treating the two critical items (email relay, storage bucket) as the next thing to fix, given their severity and how directly exploitable they already are — but that's your call, and I'm not proceeding on any of it without your explicit direction.
