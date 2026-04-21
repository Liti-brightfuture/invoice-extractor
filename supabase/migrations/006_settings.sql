-- ============================================================
-- 006_settings: profil extins, integrări criptate, preferințe
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Extinde profiles ────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS full_name        text,
  ADD COLUMN IF NOT EXISTS phone            text,
  ADD COLUMN IF NOT EXISTS company_address  text,
  ADD COLUMN IF NOT EXISTS deleted_at       timestamptz,
  ADD COLUMN IF NOT EXISTS preferences      jsonb DEFAULT '{}';

-- ─── Tabel integrations ──────────────────────────────────────
CREATE TABLE integrations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid REFERENCES auth.users NOT NULL,
  provider              text NOT NULL,          -- 'smartbill' | 'saga'
  credentials_encrypted text,                   -- pgp_sym_encrypt output (bytea stocat ca text)
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own integrations" ON integrations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RPC: upsert criptat ─────────────────────────────────────
-- Apelat din server action cu vault_key din env (nu ajunge la client)
CREATE OR REPLACE FUNCTION upsert_integration(
  p_provider    text,
  p_credentials text,
  p_vault_key   text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO integrations (user_id, provider, credentials_encrypted)
  VALUES (
    auth.uid(),
    p_provider,
    encode(pgp_sym_encrypt(p_credentials, p_vault_key), 'base64')
  )
  ON CONFLICT (user_id, provider) DO UPDATE
    SET credentials_encrypted = encode(pgp_sym_encrypt(p_credentials, p_vault_key), 'base64'),
        updated_at             = now();
END;
$$;

-- ─── RPC: decriptare ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_integration_credentials(
  p_provider  text,
  p_vault_key text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_enc text;
BEGIN
  SELECT credentials_encrypted INTO v_enc
  FROM integrations
  WHERE user_id = auth.uid() AND provider = p_provider;

  IF v_enc IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN pgp_sym_decrypt(decode(v_enc, 'base64'), p_vault_key);
END;
$$;
