-- 1. Tabel suppliers (un furnizor unic per user+CUI)
CREATE TABLE suppliers (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  cui              text        NOT NULL,
  name             text,
  address          text,
  anaf_vat_payer   boolean,
  anaf_active      boolean,
  anaf_last_check  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cui)
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_select" ON suppliers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE USING (auth.uid() = user_id);

-- 2. FK nullable în invoices
ALTER TABLE invoices
  ADD COLUMN supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;

-- 3. Funcție + trigger: la INSERT/UPDATE vendor_cui face UPSERT în suppliers
--    și populează supplier_id pe rândul curent
CREATE OR REPLACE FUNCTION sync_invoice_supplier()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NEW.vendor_cui IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO suppliers (user_id, cui, name, address)
  VALUES (NEW.user_id, NEW.vendor_cui, NEW.vendor_name, NEW.vendor_address)
  ON CONFLICT (user_id, cui) DO UPDATE
    SET name    = COALESCE(EXCLUDED.name,    suppliers.name),
        address = COALESCE(EXCLUDED.address, suppliers.address)
  RETURNING id INTO v_id;

  NEW.supplier_id := v_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER invoices_sync_supplier
  BEFORE INSERT OR UPDATE OF vendor_cui ON invoices
  FOR EACH ROW EXECUTE FUNCTION sync_invoice_supplier();

-- 4. Backfill: populează suppliers + supplier_id pentru facturile existente
DO $$
DECLARE
  inv RECORD;
  v_id uuid;
BEGIN
  FOR inv IN
    SELECT id, user_id, vendor_cui, vendor_name, vendor_address
    FROM invoices
    WHERE vendor_cui IS NOT NULL
      AND supplier_id IS NULL
  LOOP
    INSERT INTO suppliers (user_id, cui, name, address)
    VALUES (inv.user_id, inv.vendor_cui, inv.vendor_name, inv.vendor_address)
    ON CONFLICT (user_id, cui) DO UPDATE
      SET name    = COALESCE(EXCLUDED.name,    suppliers.name),
          address = COALESCE(EXCLUDED.address, suppliers.address)
    RETURNING id INTO v_id;

    UPDATE invoices SET supplier_id = v_id WHERE id = inv.id;
  END LOOP;
END;
$$;
