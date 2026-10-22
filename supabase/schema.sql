-- Spusťte celé v Supabase → SQL Editor.
create table if not exists public.listings (
  id            uuid primary key,
  slug          text unique not null,
  status        text not null default 'draft' check (status in ('draft','published','archived')),
  title         text not null,
  type          text not null,                -- Byt, Rodinný dům, ...
  disposition   text,                         -- 2+kk, 3+1, ...
  city          text not null,
  district      text,                         -- městská část / čtvrť
  street        text,                         -- veřejně se NEZOBRAZUJE přesně, jen pro interní potřebu
  area_m2       integer,
  floor         text,
  rent_czk      integer not null,
  fees_czk      integer,                      -- zálohy na služby/energie
  deposit_czk   integer,
  available_from date,
  furnished     text check (furnished in ('ano','castecne','ne')),
  energy_class  text,
  description   text,
  features      text[] not null default '{}',
  photos        jsonb  not null default '[]', -- [{"path":"<id>/x.jpg","alt":"..."}]
  contact       text not null default 'sona', -- sona | vit
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists listings_touch on public.listings;
create trigger listings_touch before update on public.listings
  for each row execute function public.touch_updated_at();

alter table public.listings enable row level security;

-- Veřejnost (web při buildu) vidí jen zveřejněné nabídky.
drop policy if exists "public read published" on public.listings;
create policy "public read published" on public.listings
  for select to anon using (status = 'published');

-- Přihlášení správci (účty vytváříte ručně, registrace je vypnutá) mohou vše.
drop policy if exists "admins all" on public.listings;
create policy "admins all" on public.listings
  for all to authenticated using (true) with check (true);

-- Úložiště fotek: veřejné čtení, zápis jen přihlášení.
insert into storage.buckets (id, name, public) values ('listings','listings', true)
  on conflict (id) do nothing;

drop policy if exists "photos public read" on storage.objects;
create policy "photos public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'listings');
drop policy if exists "photos admin write" on storage.objects;
create policy "photos admin write" on storage.objects
  for all to authenticated using (bucket_id = 'listings') with check (bucket_id = 'listings');
