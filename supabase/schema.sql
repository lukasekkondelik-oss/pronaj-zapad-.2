-- Spusťte celé v Supabase → SQL Editor (jednorázově).
-- Podklady od majitelů: tabulka je NEVEŘEJNÁ. Zapisuje do ní jen serverová funkce (service klíč),
-- čtou a upravují ji jen přihlášení správci (makléřka).

create table if not exists public.submissions (
  id              uuid primary key,
  status          text not null default 'rozpracovano'
                  check (status in ('rozpracovano','nova','v_reseni','prevzato','zamitnuto')),
  created_at      timestamptz not null default now(),
  status_changed_at timestamptz not null default now(),
  name            text not null,
  phone           text not null,
  email           text not null,
  property_type   text not null,
  disposition     text,
  city            text not null,
  area_m2         integer,
  rent_czk        integer,
  available_from  date,
  description     text,
  help            text,
  source          text,
  photo_paths     text[] not null default '{}',
  note            text,                         -- poznámka makléřky
  consent_at      timestamptz,                  -- kdy majitel udělil souhlas
  ip_hash         text,                         -- hash IP jen pro omezení spamu, maže se spolu s podklady
  finalize_hash   text,                         -- hash jednorázového tokenu pro nahrávání
  notified        boolean not null default false  -- podařilo se upozornit Make (e-mail makléřce)
);
create index if not exists submissions_status_idx on public.submissions (status, status_changed_at);
create index if not exists submissions_ip_idx on public.submissions (ip_hash, created_at);

alter table public.submissions enable row level security;

-- Žádná politika pro anon: veřejnost k tabulce nemá přístup vůbec.
drop policy if exists "admins read" on public.submissions;
create policy "admins read" on public.submissions for select to authenticated using (status <> 'rozpracovano');
drop policy if exists "admins update" on public.submissions;
create policy "admins update" on public.submissions for update to authenticated using (status <> 'rozpracovano') with check (status <> 'rozpracovano');
drop policy if exists "admins delete" on public.submissions;
create policy "admins delete" on public.submissions for delete to authenticated using (true);

-- Neveřejné úložiště fotek: jen JPEG do 2 MB. Nahrává serverová funkce, čtou přihlášení správci.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('submissions', 'submissions', false, 2097152, array['image/jpeg'])
  on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'];

drop policy if exists "admins read photos" on storage.objects;
create policy "admins read photos" on storage.objects for select to authenticated using (bucket_id = 'submissions');
drop policy if exists "admins delete photos" on storage.objects;
create policy "admins delete photos" on storage.objects for delete to authenticated using (bucket_id = 'submissions');

-- Záznamy o odeslání formuláře „Mám zájem“: jen pro omezení počtu odeslání z jedné IP (maže se po 1 dni).
-- Žádné politiky: přístup má jen serverová funkce (service klíč).
create table if not exists public.inquiry_events (
  id         uuid primary key default gen_random_uuid(),
  ip_hash    text not null,
  created_at timestamptz not null default now()
);
create index if not exists inquiry_events_ip_idx on public.inquiry_events (ip_hash, created_at);
alter table public.inquiry_events enable row level security;
