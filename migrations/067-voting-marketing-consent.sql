-- Migration 067: Record marketing opt-in consent on public votes
-- The public voting form now has an optional "keep me updated" checkbox.
-- Follows the same consent-recording pattern as migration 055.
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS

ALTER TABLE public_votes
  ADD COLUMN IF NOT EXISTS marketing_opt_in           BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS marketing_opt_in_timestamp TIMESTAMPTZ;
