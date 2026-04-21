-- ============================================================
-- 012_indexes: indecsi pentru query-uri frecvente
-- ============================================================

-- Accelereaza fetch-ul liniilor unei facturi (JOIN frecvent invoice_lines.invoice_id = invoices.id)
CREATE INDEX IF NOT EXISTS invoice_lines_invoice_id_idx
  ON invoice_lines (invoice_id);

-- Accelereaza query-urile de dashboard (user_id + status, fara arhivate)
CREATE INDEX IF NOT EXISTS invoices_user_id_status_idx
  ON invoices (user_id, status)
  WHERE archived_at IS NULL;
