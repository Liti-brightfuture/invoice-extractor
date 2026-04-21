-- ============================================================
-- 011_delete_user: stergere completa a unui utilizator
-- Folosire: SELECT delete_user_completely('uid-uuid-here');
-- ============================================================

CREATE OR REPLACE FUNCTION delete_user_completely(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bypass triggerul protect_delete din storage (doar pe durata acestei tranzactii)
  SET LOCAL session_replication_role = 'replica';

  DELETE FROM storage.objects
  WHERE bucket_id = 'invoices'
    AND (storage.foldername(name))[1] = p_user_id::text;

  DELETE FROM storage.objects
  WHERE bucket_id = 'exports'
    AND (storage.foldername(name))[1] = p_user_id::text;

  -- Reseteaza comportamentul normal
  SET LOCAL session_replication_role = 'origin';

  -- Tabele baza de date (in ordinea corecta a FK-urilor)
  DELETE FROM dismissed_duplicates WHERE user_id = p_user_id;
  DELETE FROM audit_logs            WHERE user_id = p_user_id;
  DELETE FROM usage_logs            WHERE user_id = p_user_id;
  DELETE FROM integrations          WHERE user_id = p_user_id;
  DELETE FROM invoices              WHERE user_id = p_user_id; -- cascade -> invoice_lines
  DELETE FROM exports               WHERE user_id = p_user_id;
  DELETE FROM suppliers             WHERE user_id = p_user_id;
  DELETE FROM profiles              WHERE id      = p_user_id;

  -- Cont autentificare
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- Doar service_role poate apela aceasta functie (nu utilizatorii obisnuiti)
REVOKE ALL ON FUNCTION delete_user_completely(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_user_completely(uuid) TO service_role;
