ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS linked_invoice_id uuid REFERENCES invoices(id),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_reason text,
  ADD CONSTRAINT invoices_archived_reason_check
    CHECK (archived_reason IS NULL OR archived_reason IN ('duplicate_pdf_kept_xml'));

CREATE TABLE IF NOT EXISTS dismissed_duplicates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  invoice_a_id uuid REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  invoice_b_id uuid REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  dismissed_at timestamptz DEFAULT now(),
  CHECK (invoice_a_id <> invoice_b_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS dismissed_duplicates_unique_pair_idx
  ON dismissed_duplicates (
    user_id,
    LEAST(invoice_a_id, invoice_b_id),
    GREATEST(invoice_a_id, invoice_b_id)
  );

CREATE INDEX IF NOT EXISTS invoices_user_id_invoice_date_idx
  ON invoices (user_id, invoice_date DESC);

CREATE INDEX IF NOT EXISTS invoices_linked_invoice_id_idx
  ON invoices (linked_invoice_id);

CREATE INDEX IF NOT EXISTS invoices_archived_at_idx
  ON invoices (archived_at);

CREATE INDEX IF NOT EXISTS dismissed_duplicates_lookup_idx
  ON dismissed_duplicates (user_id, invoice_a_id, invoice_b_id);

ALTER TABLE dismissed_duplicates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own dismissed duplicates"
  ON dismissed_duplicates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own dismissed duplicates"
  ON dismissed_duplicates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own dismissed duplicates"
  ON dismissed_duplicates FOR DELETE
  USING (auth.uid() = user_id);
