-- Seed default sponsors_visible setting in cms_config.
-- The homepage reads this flag to show/hide the "Proudly Supported By" section.
-- Toggle it from the CMS: Settings → General → Public Site Settings.
INSERT INTO cms_config (key, value, updated_at)
VALUES ('sponsors_visible', 'false', NOW())
ON CONFLICT (key) DO NOTHING;
