create type public.app_role as enum ('admin','user');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

-- first user becomes admin
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role='admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.funnels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  description text,
  status text not null default 'active',
  base_url text,
  tiktok_pixel_id text,
  tracking_params jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.funnel_steps (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.funnels(id) on delete cascade,
  name text not null,
  url_pattern text not null,
  step_order int not null,
  created_at timestamptz not null default now()
);
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  session_key text not null unique,
  visitor_id text not null,
  funnel_id uuid not null references public.funnels(id) on delete cascade,
  is_returning boolean not null default false,
  current_step_id uuid references public.funnel_steps(id) on delete set null,
  max_step_order int not null default 0,
  current_url text,
  previous_url text,
  page_views int not null default 0,
  country text, region text, city text,
  device text, browser text, os text, language text, screen text,
  referrer text, landing_url text,
  utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  ttclid text, tt_campaign text, tt_adset text, tt_ad text,
  converted boolean not null default false,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index on public.sessions(funnel_id, last_seen_at desc);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  session_id uuid not null references public.sessions(id) on delete cascade,
  funnel_id uuid not null references public.funnels(id) on delete cascade,
  step_id uuid references public.funnel_steps(id) on delete set null,
  type text not null,
  url text,
  created_at timestamptz not null default now()
);
create index on public.events(session_id, created_at);
create index on public.events(funnel_id, created_at desc);

grant select, insert, update, delete on public.funnels, public.funnel_steps, public.sessions, public.events to authenticated;
grant all on public.funnels, public.funnel_steps, public.sessions, public.events to service_role;
alter table public.funnels enable row level security;
alter table public.funnel_steps enable row level security;
alter table public.sessions enable row level security;
alter table public.events enable row level security;
create policy "admin all" on public.funnels for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin all" on public.funnel_steps for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin all" on public.sessions for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin all" on public.events for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.events;

with f as (
  insert into public.funnels(name, domain, description, base_url)
  values ('Funil Principal','dominio.com','Primeiro funil Digistore24','https://dominio.com') returning id)
insert into public.funnel_steps(funnel_id, name, url_pattern, step_order)
select f.id, s.name, s.p, s.o from f, (values
 ('Início','/inicio',1),('Resgatar','/resgatar',2),('Confirmar','/confirmar',3),
 ('Checkout Digistore24','checkout.digistore24.com',4),('Compra aprovada','/obrigado',5)) as s(name,p,o);