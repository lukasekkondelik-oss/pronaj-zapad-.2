-- Spusťte JEN pokud už jste dříve spustili původní schema.sql (bez stavu „pronajato“).
alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status in ('draft','published','rented','archived'));
alter table public.listings add column if not exists rented_at date;
drop policy if exists "public read published" on public.listings;
create policy "public read published" on public.listings
  for select to anon using (status in ('published','rented'));
