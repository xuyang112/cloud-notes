begin;

create schema if not exists note_private;
revoke all on schema note_private from public, anon, authenticated;

create table if not exists note_private.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table note_private.admins enable row level security;
revoke all on note_private.admins from public, anon, authenticated;

-- Only the SQL editor / database owner can grant administrator membership.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from note_private.admins
    where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  slug text not null unique check (char_length(slug) between 1 and 120 and slug !~ '[[:space:]/?#]'),
  sort_order integer not null default 0 check (sort_order between 0 and 999),
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 160),
  slug text not null unique check (char_length(slug) between 1 and 180 and slug !~ '[[:space:]/?#]'),
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb
    check (jsonb_typeof(content) = 'object' and content->>'type' = 'doc'),
  content_html text not null default '',
  category_id uuid references public.categories(id) on delete restrict,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_category_idx on public.notes(category_id);
create index if not exists notes_public_updated_idx on public.notes(updated_at desc) where published = true;

create or replace function public.note_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;
revoke all on function public.note_set_updated_at() from public, anon, authenticated;
drop trigger if exists note_updated_at on public.notes;
create trigger note_updated_at before update on public.notes
for each row execute function public.note_set_updated_at();

alter table public.categories enable row level security;
alter table public.notes enable row level security;
revoke all on public.categories, public.notes from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.categories, public.notes to anon, authenticated;
grant insert, update, delete on public.categories, public.notes to authenticated;

drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories for select to anon, authenticated using (true);
drop policy if exists categories_admin_insert on public.categories;
create policy categories_admin_insert on public.categories for insert to authenticated with check ((select public.is_admin()));
drop policy if exists categories_admin_update on public.categories;
create policy categories_admin_update on public.categories for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists categories_admin_delete on public.categories;
create policy categories_admin_delete on public.categories for delete to authenticated using ((select public.is_admin()));

drop policy if exists notes_public_or_admin_read on public.notes;
create policy notes_public_or_admin_read on public.notes for select to anon, authenticated
using (published = true or (select public.is_admin()));
drop policy if exists notes_admin_insert on public.notes;
create policy notes_admin_insert on public.notes for insert to authenticated with check ((select public.is_admin()));
drop policy if exists notes_admin_update on public.notes;
create policy notes_admin_update on public.notes for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists notes_admin_delete on public.notes;
create policy notes_admin_delete on public.notes for delete to authenticated using ((select public.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('note-images', 'note-images', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('note-files', 'note-files', true, 20971520, null)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists note_images_admin_select on storage.objects;
create policy note_images_admin_select on storage.objects for select to authenticated
using (bucket_id = 'note-images' and (select public.is_admin()));
drop policy if exists note_images_admin_insert on storage.objects;
create policy note_images_admin_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'note-images' and (select public.is_admin())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists note_images_admin_update on storage.objects;
create policy note_images_admin_update on storage.objects for update to authenticated
using (bucket_id = 'note-images' and (select public.is_admin()) and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'note-images' and (select public.is_admin()) and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists note_images_admin_delete on storage.objects;
create policy note_images_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'note-images' and (select public.is_admin()) and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists note_files_admin_select on storage.objects;
create policy note_files_admin_select on storage.objects for select to authenticated
using (bucket_id = 'note-files' and (select public.is_admin()));
drop policy if exists note_files_admin_insert on storage.objects;
create policy note_files_admin_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'note-files' and (select public.is_admin())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists note_files_admin_update on storage.objects;
create policy note_files_admin_update on storage.objects for update to authenticated
using (bucket_id = 'note-files' and (select public.is_admin()) and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'note-files' and (select public.is_admin()) and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists note_files_admin_delete on storage.objects;
create policy note_files_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'note-files' and (select public.is_admin()) and (storage.foldername(name))[1] = (select auth.uid())::text);

insert into public.categories (id, name, slug, sort_order)
values
  ('10000000-0000-4000-8000-000000000001', 'JAVA', 'java', 0),
  ('10000000-0000-4000-8000-000000000002', '数据库', 'database', 1),
  ('10000000-0000-4000-8000-000000000003', '嵌入式', 'embedded', 2),
  ('10000000-0000-4000-8000-000000000004', '设计模式', 'design-pattern', 3)
on conflict do nothing;

commit;
