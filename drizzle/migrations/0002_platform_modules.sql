alter type public.app_role add value if not exists 'super_admin';
alter type public.app_role add value if not exists 'analyst';
alter type public.app_role add value if not exists 'viewer';

-- role helpers (text comparison so new enum values are usable here)
create or replace function public.user_role_level(_uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(max(case role::text when 'super_admin' then 4 when 'admin' then 3 when 'analyst' then 2 when 'viewer' then 1 else 0 end),0)
  from public.user_roles where user_id = _uid $$;
create or replace function public.can_view(_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$ select public.user_role_level(_uid) >= 1 $$;
create or replace function public.can_manage(_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$ select public.user_role_level(_uid) >= 3 $$;

-- loosen read access to every role, writes to admins
drop policy if exists "admin all" on public.funnels;
drop policy if exists "admin all" on public.funnel_steps;
drop policy if exists "admin all" on public.sessions;
drop policy if exists "admin all" on public.events;
create policy "view" on public.funnels for select to authenticated using (public.can_view(auth.uid()));
create policy "manage" on public.funnels for all to authenticated using (public.can_manage(auth.uid())) with check (public.can_manage(auth.uid()));
create policy "view" on public.funnel_steps for select to authenticated using (public.can_view(auth.uid()));
create policy "manage" on public.funnel_steps for all to authenticated using (public.can_manage(auth.uid())) with check (public.can_manage(auth.uid()));
create policy "view" on public.sessions for select to authenticated using (public.can_view(auth.uid()));
create policy "manage" on public.sessions for delete to authenticated using (public.can_manage(auth.uid()));
create policy "view" on public.events for select to authenticated using (public.can_view(auth.uid()));
create policy "admins see roles" on public.user_roles for select to authenticated using (public.can_manage(auth.uid()));

-- sales
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'digistore24',
  order_id text not null,
  transaction_id text,
  product text,
  amount numeric(12,2),
  currency text,
  status text not null check (status in ('pending','approved','refunded','chargeback','cancelled')),
  funnel_id uuid references public.funnels(id) on delete set null,
  session_id uuid references public.sessions(id) on delete set null,
  visitor_id text,
  campaign text,
  ttclid text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, order_id)
);
create index on public.transactions(occurred_at desc);
create index on public.transactions(transaction_id);
create index on public.transactions(ttclid);

-- every raw webhook delivery; dedupe key makes replays no-ops
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  dedupe_key text not null unique,
  event_type text,
  payload jsonb not null,
  status text not null default 'received',
  error text,
  created_at timestamptz not null default now()
);

-- outgoing TikTok events
create table public.event_queue (
  id uuid primary key default gen_random_uuid(),
  destination text not null default 'tiktok',
  event_name text not null,
  event_id text not null,
  funnel_id uuid references public.funnels(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','success','failed','retry','dead_letter')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_status_code int,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (destination, event_name, event_id)
);
create index on public.event_queue(status, next_attempt_at);

-- per-funnel TikTok config (non-secret)
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null unique references public.funnels(id) on delete cascade,
  tiktok_enabled boolean not null default false,
  tiktok_advertiser_id text,
  tiktok_test_mode boolean not null default true,
  tiktok_test_event_code text,
  token_hint text,
  updated_at timestamptz not null default now()
);
-- secrets: only service role
create table public.integration_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table public.system_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  level text not null check (level in ('INFO','WARNING','ERROR','CRITICAL')),
  source text not null,
  message text not null,
  funnel_id uuid,
  session_id uuid,
  visitor_id text,
  event_name text,
  endpoint text,
  status_code int,
  duration_ms int,
  attempt int,
  details jsonb
);
create index on public.system_logs(created_at desc);
create index on public.system_logs(level, created_at desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid,
  actor_email text,
  action text not null,
  target text,
  details jsonb
);
create index on public.audit_logs(created_at desc);

create table public.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (bucket, window_start)
);

grant select on public.transactions, public.event_queue, public.integrations, public.system_logs, public.audit_logs, public.webhook_events to authenticated;
grant insert, update on public.integrations to authenticated;
grant insert on public.audit_logs to authenticated;
grant all on public.transactions, public.webhook_events, public.event_queue, public.integrations, public.integration_secrets, public.system_logs, public.audit_logs, public.rate_limits to service_role;

alter table public.transactions enable row level security;
alter table public.webhook_events enable row level security;
alter table public.event_queue enable row level security;
alter table public.integrations enable row level security;
alter table public.integration_secrets enable row level security;
alter table public.system_logs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limits enable row level security;

create policy "view" on public.transactions for select to authenticated using (public.can_view(auth.uid()));
create policy "manage" on public.webhook_events for select to authenticated using (public.can_manage(auth.uid()));
create policy "manage" on public.event_queue for select to authenticated using (public.can_manage(auth.uid()));
create policy "manage" on public.integrations for all to authenticated using (public.can_manage(auth.uid())) with check (public.can_manage(auth.uid()));
create policy "manage" on public.system_logs for select to authenticated using (public.can_manage(auth.uid()));
create policy "manage" on public.audit_logs for select to authenticated using (public.can_manage(auth.uid()));
create policy "self insert" on public.audit_logs for insert to authenticated
  with check (actor_id = auth.uid() and action in ('login','logout'));

-- fixed-window rate limiter used by public endpoints
create or replace function public.hit_rate_limit(_bucket text, _window_seconds int, _max int) returns boolean
language plpgsql security definer set search_path = public as $$
declare w timestamptz := to_timestamp(floor(extract(epoch from now()) / _window_seconds) * _window_seconds); n int;
begin
  insert into public.rate_limits(bucket, window_start, hits) values (_bucket, w, 1)
  on conflict (bucket, window_start) do update set hits = rate_limits.hits + 1 returning hits into n;
  if random() < 0.01 then delete from public.rate_limits where window_start < now() - interval '1 hour'; end if;
  return n <= _max;
end $$;
revoke execute on function public.hit_rate_limit(text,int,int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text,int,int) to service_role;

-- audit triggers
create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare a text; t text; d jsonb;
begin
  a := lower(tg_op); t := tg_table_name;
  if tg_op = 'DELETE' then d := to_jsonb(old); else d := to_jsonb(new); end if;
  if t = 'integrations' then d := d - 'token_hint'; end if;
  insert into public.audit_logs(actor_id, actor_email, action, target, details)
  values (auth.uid(), (select email from auth.users where id = auth.uid()),
    case t when 'funnels' then 'funil ' when 'funnel_steps' then 'etapa ' when 'user_roles' then 'permissão ' when 'integrations' then 'integração ' else t || ' ' end
    || case a when 'insert' then 'criada' when 'update' then 'alterada' else 'removida' end,
    t, d);
  return coalesce(new, old);
end $$;
create trigger audit_funnels after insert or update or delete on public.funnels for each row execute function public.audit_trigger();
create trigger audit_steps after insert or update or delete on public.funnel_steps for each row execute function public.audit_trigger();
create trigger audit_roles after insert or update or delete on public.user_roles for each row execute function public.audit_trigger();
create trigger audit_integrations after insert or update or delete on public.integrations for each row execute function public.audit_trigger();

alter publication supabase_realtime add table public.system_logs;
alter publication supabase_realtime add table public.transactions;