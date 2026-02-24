-- ============================================
-- CONFIGURE RESEND API KEY IN cms_config
-- ============================================
-- The send_single_email function reads the API key from cms_config.
-- Replace 're_YOUR_KEY_HERE' with your actual Resend API key.
--
-- Run this in the Supabase SQL Editor:

INSERT INTO cms_config (key, value)
VALUES ('resend_api_key', 're_YOUR_KEY_HERE')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

INSERT INTO cms_config (key, value)
VALUES ('from_email', 'British Trade Awards <awards@britishtrade.org>')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
