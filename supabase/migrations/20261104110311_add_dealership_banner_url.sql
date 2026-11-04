alter table public.dealerships add column if not exists banner_url text;

update public.dealerships
set banner_url = cover_url
where banner_url is null
  and cover_url is not null;
