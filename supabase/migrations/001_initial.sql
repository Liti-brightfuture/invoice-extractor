-- ============================================================
-- InvoiceExtractor — schema inițială
-- ============================================================

-- profiles: extensia user cu date firmă
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  company_name text,
  company_cui text,
  created_at timestamptz default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  file_path text not null,
  file_name text not null,
  status text not null default 'processing', -- processing | validated | review | error

  -- date extrase
  vendor_name text,
  vendor_cui text,
  vendor_address text,
  invoice_number text,
  invoice_date date,
  due_date date,

  -- totaluri
  subtotal numeric(12,2),
  vat_amount numeric(12,2),
  total numeric(12,2),
  currency text default 'RON',

  -- validare ANAF
  anaf_validated boolean default false,
  anaf_vat_payer boolean,
  anaf_active boolean,
  anaf_validated_at timestamptz,

  -- AI metadata
  confidence_score integer, -- 0-100
  ai_raw_response jsonb,
  processing_time_ms integer,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices on delete cascade not null,
  line_number integer not null,
  description text,
  quantity numeric(12,4),
  unit_price numeric(12,4),
  vat_rate numeric(5,2), -- 19, 9, 5, 0
  line_total numeric(12,2)
);

create table usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  action text not null, -- 'extract' | 'export' | 'anaf_check'
  cost_ron numeric(8,4),
  created_at timestamptz default now()
);

-- ============================================================
-- Trigger updated_at pe invoices
-- ============================================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger invoices_updated_at
  before update on invoices
  for each row execute function update_updated_at();

-- ============================================================
-- RLS: fiecare user vede doar datele lui
-- ============================================================
alter table invoices enable row level security;
alter table invoice_lines enable row level security;
alter table profiles enable row level security;
alter table usage_logs enable row level security;

-- invoices
create policy "Users view own invoices"
  on invoices for select
  using (auth.uid() = user_id);

create policy "Users insert own invoices"
  on invoices for insert
  with check (auth.uid() = user_id);

create policy "Users update own invoices"
  on invoices for update
  using (auth.uid() = user_id);

create policy "Users delete own invoices"
  on invoices for delete
  using (auth.uid() = user_id);

-- invoice_lines (acces prin join pe invoice al userului)
create policy "Users view own invoice lines"
  on invoice_lines for select
  using (
    exists (
      select 1 from invoices
      where invoices.id = invoice_lines.invoice_id
        and invoices.user_id = auth.uid()
    )
  );

create policy "Users insert own invoice lines"
  on invoice_lines for insert
  with check (
    exists (
      select 1 from invoices
      where invoices.id = invoice_lines.invoice_id
        and invoices.user_id = auth.uid()
    )
  );

create policy "Users update own invoice lines"
  on invoice_lines for update
  using (
    exists (
      select 1 from invoices
      where invoices.id = invoice_lines.invoice_id
        and invoices.user_id = auth.uid()
    )
  );

create policy "Users delete own invoice lines"
  on invoice_lines for delete
  using (
    exists (
      select 1 from invoices
      where invoices.id = invoice_lines.invoice_id
        and invoices.user_id = auth.uid()
    )
  );

-- profiles (id = auth.uid())
create policy "Users view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users update own profile"
  on profiles for update
  using (auth.uid() = id);

-- usage_logs
create policy "Users view own usage logs"
  on usage_logs for select
  using (auth.uid() = user_id);

create policy "Users insert own usage logs"
  on usage_logs for insert
  with check (auth.uid() = user_id);
