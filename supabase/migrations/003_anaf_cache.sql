-- Cache pentru rezultatele ANAF (evită apeluri repetate pentru același CUI)
CREATE TABLE anaf_cache (
  cui        text        PRIMARY KEY,
  response   jsonb       NOT NULL,
  cached_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE anaf_cache ENABLE ROW LEVEL SECURITY;

-- Orice utilizator autentificat poate citi/scrie (cache partajat, date publice ANAF)
CREATE POLICY "authenticated_read_anaf_cache"
  ON anaf_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_upsert_anaf_cache"
  ON anaf_cache FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated_update_anaf_cache"
  ON anaf_cache FOR UPDATE
  TO authenticated
  USING (true);
