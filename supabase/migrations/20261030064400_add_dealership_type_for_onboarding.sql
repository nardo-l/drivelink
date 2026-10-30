alter table public.dealerships
  add column if not exists dealership_type text not null default 'dealership';

alter table public.dealerships
  drop constraint if exists dealerships_dealership_type_check;

alter table public.dealerships
  add constraint dealerships_dealership_type_check
  check (dealership_type = any (array['dealership', 'importer', 'independent', 'broker']::text[]));
