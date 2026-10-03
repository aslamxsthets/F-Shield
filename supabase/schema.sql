create table if not exists public.f_shield_state (
  id text primary key check (id = 'primary'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.f_shield_state enable row level security;

revoke all on table public.f_shield_state from anon, authenticated;
grant all on table public.f_shield_state to service_role;