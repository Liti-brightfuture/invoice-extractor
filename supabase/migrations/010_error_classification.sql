-- Migration 010: structured error classification columns
-- Backward-compatible: both columns are NULL by default.
-- Existing rows keep NULL; new error rows get populated by the app layer.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS error_code    text,
  ADD COLUMN IF NOT EXISTS error_message text;

-- Partial index covers the failed-invoices list query with zero overhead on healthy rows.
CREATE INDEX IF NOT EXISTS invoices_error_idx
  ON invoices (user_id, created_at DESC)
  WHERE status = 'error';
