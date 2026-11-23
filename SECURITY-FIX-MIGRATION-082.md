# Security Fix — Migration 082 (certificate-assets Storage Bucket)

**Date:** 2026-07-22. Scope: Claude TEST CMS only. `british-trade-awards-cms` was not touched.

This is finding 3 of the risk-assessed "Must fix before launch" list, investigated and closed as its own complete unit.

## 1. Proof the vulnerability existed

`certificate-assets` bucket (`public: true`, no file-size limit, no MIME-type restriction) had `storage.objects` policies named `"Auth upload/update/delete certificate-assets"` — clearly intended to mean authenticated-only, matching the naming convention correctly used for the sibling `brand-assets` bucket — but actually scoped to `roles = {public}`, not `{authenticated}`.

Real anon-key Storage API calls against Claude TEST CMS:
- **Upload**: `POST .../object/certificate-assets/sectest-proof.txt` with only the anon key → `HTTP 200`, real object created, immediately publicly readable at the public URL with the exact uploaded content.
- **Overwrite**: `PUT` on the same object with the anon key → `HTTP 200`, same object `Id` returned.
- **Delete**: `DELETE` on the same object with the anon key → `HTTP 200 "Successfully deleted"`, confirmed via an immediate `404` on re-fetch.

All three succeeded with nothing but the public anon key.

## 2. Why the app doesn't already prevent it

`api/certificates-qr.js` writes to this bucket server-side with the service-role key (unaffected by any `storage.objects` policy). `winners.js`'s `uploadCertBackground`/`uploadCertFont` call `_uploadToStorage()`, which POSTs multipart form data (`file`/`bucket`/`path`) to `/api/upload-proxy` — but that endpoint only handles JSON `{action: ...}` requests (`get_entry`/`get_existing_files`/`save_file_metadata`/`get_upload_token`) and has no generic bucket-upload handler, so `req.body.action` is `undefined` for a multipart POST and the request 400s before ever reaching Supabase. **This is a pre-existing, unrelated functional bug in that specific admin feature** — noted here for visibility, not fixed (out of scope for this security pass; flagging separately rather than batching an unrelated fix into this migration). Either way, no code path — working or broken — creates its own Supabase client to write to this bucket directly with the anon/authenticated key, so nothing in the real app relies on the public role-scoping this migration removes.

## 3. Browser-side dependency check

Confirmed via grep that the only frontend reference to `certificate-assets` (`winners.js`) goes through `/api/upload-proxy` (server-side), not a direct browser Supabase Storage client call. No feature depends on direct client-side write access to this bucket beyond what `TO authenticated` already allows.

## 4. Fix applied — `migrations/082-fix-certificate-assets-storage-policies.sql`

`ALTER POLICY ... TO authenticated` on all 3 write policies (`Auth upload/update/delete certificate-assets`), matching `brand-assets`' exact pattern. Deliberately scoped to only the role-fix — did not add a `file_size_limit`/`allowed_mime_types` (a separate hardening decision, not part of the confirmed finding, left for its own review rather than batched in). Applied to Claude TEST CMS; re-ran a second time with no errors (idempotent).

## 5. Verification

| Check | Result |
|---|---|
| Policy roles after fix | All 3 write policies now `{authenticated}`, matching `brand-assets` |
| anon upload attempt (re-run of the exact original exploit) | Blocked: `HTTP 400`, `403 Unauthorized — new row violates row-level security policy` |
| Public read (unauthenticated) of a real service-role-uploaded file | Still works, `HTTP 200` |
| Service-role upload (simulates `certificates-qr.js`) | Still works, `HTTP 200` |
| Authenticated (real logged-in test user, `editor` role) upload + delete | Both succeed, `HTTP 200` — confirms the intended feature would work correctly if `winners.js`'s separate endpoint bug (see §2) were fixed |
| Affected Jest suites (`certificates-qr`, `winners`, `upload-documents`) | 3 suites, 342 tests, all pass |
| Full test suite / lint / build | 68 suites, 6474 passed (3 pre-existing skips), lint clean, build clean |

## 6. Data restored — plus an incidental correction to the tracked baseline

All test objects (anon-uploaded, service-role-uploaded, authenticated-uploaded) deleted and confirmed gone via re-fetch (`404`).

While cleaning up this round's throwaway test user (`setup-test-user.js`), the `DELETE .../user_roles?email=eq.<email>` call returned `HTTP 204` but silently matched zero rows — the email contains a `+`, which was not URL-encoded in the query string and was misinterpreted as a space. Re-verifying via a service-role re-read (per this engagement's established "never trust a 2xx status alone" principle) caught this, and also surfaced a **second, older orphaned row from a previous session** (`xlsx-rehearsal-test-admin+1784668172917@example.com`) with the exact same leftover pattern in both `user_roles` and `auth.users` — meaning this session's starting "baseline" (`user_roles: 2`) already contained one stray test row that had escaped an earlier session's cleanup. Both stray `user_roles` rows and the orphaned `auth.users` entry were deleted properly this time (with the email percent-encoded). The corrected, verified-clean baseline is `user_roles: 1` (the single real `admin@britishtradeawards.test` row) — all subsequent snapshots in this investigation use this corrected baseline.

## Conclusion

**Confirmed, not a false positive.** Fix verified: anon blocked, authenticated/service-role/public-read all still work correctly, real app unaffected. Moving to the next finding (15 views bypassing RLS) as its own separate investigation.
