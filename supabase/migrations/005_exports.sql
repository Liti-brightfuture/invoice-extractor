-- Tabel pentru istoricul exporturilor batch
create table exports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  format        text not null,           -- smartbill | saga | winmentor | csv | efactura
  period_from   date not null,
  period_to     date not null,
  invoice_count int  not null default 0,
  file_path     text,                    -- path relativ în bucket "exports", ex: "{user_id}/1234-smartbill.zip"
  created_at    timestamptz default now()
);

alter table exports enable row level security;

create policy "users_own_exports"
  on exports for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index pentru listare rapidă per utilizator
create index exports_user_created_idx on exports (user_id, created_at desc);

-- -------------------------------------------------------
-- Bucket Supabase Storage pentru arhivele ZIP exportate
-- -------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exports',
  'exports',
  false,
  52428800,                          -- 50 MB per fișier
  array['application/zip', 'application/octet-stream']
)
on conflict (id) do nothing;

create policy "users_upload_exports"
  on storage.objects for insert
  with check (
    bucket_id = 'exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users_read_exports"
  on storage.objects for select
  using (
    bucket_id = 'exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users_delete_exports"
  on storage.objects for delete
  using (
    bucket_id = 'exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
