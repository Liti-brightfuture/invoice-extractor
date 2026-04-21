-- ============================================================
-- Storage: bucket "invoices" + RLS policies
-- ============================================================

-- Bucket privat (public = false înseamnă că URL-urile nu sunt accesibile fără token)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invoices',
  'invoices',
  false,
  10485760,  -- 10MB
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do nothing;

-- RLS pe storage.objects (trebuie activat manual sau e deja activat de Supabase)
-- Fiecare fișier stă la path: {user_id}/{uuid}-{filename}
-- storage.foldername(name) returnează array cu segmentele de folder

create policy "Users upload own invoices"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'invoices'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users read own invoices"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'invoices'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users delete own invoices"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'invoices'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
