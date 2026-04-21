-- Migration 007: audit_logs + reprocess_count + exported_at

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reprocess_count integer NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS exported_at timestamptz;

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  action text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own audit logs"
  ON audit_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE INDEX audit_logs_invoice_id_idx ON audit_logs (invoice_id);
CREATE INDEX audit_logs_user_id_created_at_idx ON audit_logs (user_id, created_at DESC);
