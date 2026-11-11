-- ============================================================
-- Migration 075: Atomic entries.public_votes increment
-- ============================================================
-- api/voting-proxy.js's submitVote() records each vote in public_votes but
-- never updated the denormalized entries.public_votes counter — the exact
-- field public-voting.js displays to visitors and sums for "total votes".
-- Every nominee showed 0 votes regardless of real votes cast. A plain
-- read-then-write increment from the API would race under concurrent votes
-- (lost updates), so this does the increment atomically in the database.
-- ============================================================

CREATE OR REPLACE FUNCTION increment_entry_public_votes(p_entry_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE entries SET public_votes = COALESCE(public_votes, 0) + 1 WHERE id = p_entry_id;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
