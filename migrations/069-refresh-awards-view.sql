-- ============================================================
-- Migration 069: Refresh the 'awards' view and its INSTEAD OF triggers
-- ============================================================
-- 'awards' (SELECT * FROM award_years, created in
-- migrations/000-complete-database-setup.sql) freezes its column list
-- at CREATE VIEW time — it does NOT automatically pick up columns
-- added to award_years later. Since award_years has gained ~15 columns
-- since (criteria, prize_details, country, area_id, scoring_criteria,
-- etc. via database-schema.sql and migrations 067/068), the view was
-- badly out of date, and its INSTEAD OF INSERT trigger used a
-- positional "INSERT INTO award_years VALUES (NEW.*)" that only ever
-- matched the view's original (stale) column count — meaning award
-- creation through the CMS has been broken since those columns were
-- added. Its UPDATE trigger was similarly missing all newer columns,
-- so editing an award silently dropped whichever new fields were set.
--
-- This migration rebuilds the view against award_years' current
-- columns and rewrites both triggers with an explicit, complete
-- column list so INSERT/UPDATE actually persist every field the
-- Award form saves.
-- ============================================================

CREATE OR REPLACE VIEW awards AS SELECT * FROM award_years;

CREATE OR REPLACE FUNCTION awards_insert_fn()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO award_years (
    year, award_name, award_category, sector, county, status, description, is_active,
    entry_open_date, entry_close_date, nominees_announcement_date, judging_open_date,
    judging_close_date, voting_open_date, voting_close_date, winners_announcement_date,
    prev_year_winner, prev_year_2nd, prev_year_3rd, criteria, prize_details, thumbnail_url,
    sponsor_logo_url, sponsor_name, parent_category_id, display_order, show_on_website,
    judging_deadline, announcement_date, tenant_id, event_id, winner_confirmed,
    country, area_id, scoring_criteria
  ) VALUES (
    NEW.year, NEW.award_name, NEW.award_category, NEW.sector, NEW.county,
    COALESCE(NEW.status, 'Draft'), NEW.description, COALESCE(NEW.is_active, true),
    NEW.entry_open_date, NEW.entry_close_date, NEW.nominees_announcement_date, NEW.judging_open_date,
    NEW.judging_close_date, NEW.voting_open_date, NEW.voting_close_date, NEW.winners_announcement_date,
    NEW.prev_year_winner, NEW.prev_year_2nd, NEW.prev_year_3rd, NEW.criteria, NEW.prize_details, NEW.thumbnail_url,
    NEW.sponsor_logo_url, NEW.sponsor_name, NEW.parent_category_id, COALESCE(NEW.display_order, 0),
    COALESCE(NEW.show_on_website, true), NEW.judging_deadline, NEW.announcement_date, NEW.tenant_id,
    NEW.event_id, NEW.winner_confirmed, NEW.country, NEW.area_id, NEW.scoring_criteria
  )
  RETURNING id, created_at, updated_at INTO NEW.id, NEW.created_at, NEW.updated_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION awards_update_fn()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE award_years SET
    year = NEW.year,
    award_name = NEW.award_name,
    award_category = NEW.award_category,
    sector = NEW.sector,
    county = NEW.county,
    status = NEW.status,
    description = NEW.description,
    is_active = NEW.is_active,
    entry_open_date = NEW.entry_open_date,
    entry_close_date = NEW.entry_close_date,
    nominees_announcement_date = NEW.nominees_announcement_date,
    judging_open_date = NEW.judging_open_date,
    judging_close_date = NEW.judging_close_date,
    voting_open_date = NEW.voting_open_date,
    voting_close_date = NEW.voting_close_date,
    winners_announcement_date = NEW.winners_announcement_date,
    prev_year_winner = NEW.prev_year_winner,
    prev_year_2nd = NEW.prev_year_2nd,
    prev_year_3rd = NEW.prev_year_3rd,
    criteria = NEW.criteria,
    prize_details = NEW.prize_details,
    thumbnail_url = NEW.thumbnail_url,
    sponsor_logo_url = NEW.sponsor_logo_url,
    sponsor_name = NEW.sponsor_name,
    parent_category_id = NEW.parent_category_id,
    display_order = NEW.display_order,
    show_on_website = NEW.show_on_website,
    judging_deadline = NEW.judging_deadline,
    announcement_date = NEW.announcement_date,
    tenant_id = NEW.tenant_id,
    event_id = NEW.event_id,
    winner_confirmed = NEW.winner_confirmed,
    country = NEW.country,
    area_id = NEW.area_id,
    scoring_criteria = NEW.scoring_criteria,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- awards_delete_fn (DELETE FROM award_years WHERE id = OLD.id) is unaffected
-- by the column changes and needs no update.

NOTIFY pgrst, 'reload schema';
