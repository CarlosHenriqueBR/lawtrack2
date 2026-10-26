create table public.tiktok_business_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create table public.tiktok_ad_accounts (
  advertiser_id text primary key,
  bc_id uuid not null references public.tiktok_business_centers(id) on delete cascade,
  name text,
  currency text not null default 'USD',
  timezone text,
  enabled boolean not null default true,
  domains text[] not null default '{}',
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create table public.tiktok_campaign_stats (
  advertiser_id text not null references public.tiktok_ad_accounts(advertiser_id) on delete cascade,
  campaign_id text not null,
  stat_date date not null,
  campaign_name text,
  spend numeric not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  conversions numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (advertiser_id, campaign_id, stat_date)
);
create index on public.tiktok_campaign_stats (stat_date);
create table public.fx_rates (
  currency text primary key,
  rate_to_brl numeric not null,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.tiktok_business_centers, public.tiktok_ad_accounts to authenticated;
grant select on public.tiktok_campaign_stats, public.fx_rates to authenticated;
grant all on public.tiktok_business_centers, public.tiktok_ad_accounts, public.tiktok_campaign_stats, public.fx_rates to service_role;
alter table public.tiktok_business_centers enable row level security;
alter table public.tiktok_ad_accounts enable row level security;
alter table public.tiktok_campaign_stats enable row level security;
alter table public.fx_rates enable row level security;
create policy "view" on public.tiktok_business_centers for select to authenticated using (public.can_view(auth.uid()));
create policy "manage" on public.tiktok_business_centers for all to authenticated using (public.can_manage(auth.uid())) with check (public.can_manage(auth.uid()));
create policy "view" on public.tiktok_ad_accounts for select to authenticated using (public.can_view(auth.uid()));
create policy "manage" on public.tiktok_ad_accounts for all to authenticated using (public.can_manage(auth.uid())) with check (public.can_manage(auth.uid()));
create policy "view" on public.tiktok_campaign_stats for select to authenticated using (public.can_view(auth.uid()));
create policy "view" on public.fx_rates for select to authenticated using (public.can_view(auth.uid()));
insert into public.fx_rates (currency, rate_to_brl) values ('BRL', 1);