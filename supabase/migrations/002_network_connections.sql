-- Personal LinkedIn network storage and CSV-import support.
create table if not exists public.network_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_key text not null,
  first_name text,
  last_name text,
  full_name text not null,
  linkedin_url text,
  email text,
  company text,
  position text,
  connected_on date,
  source text not null default 'linkedin_csv',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, external_key)
);

create index if not exists network_connections_user_name_idx
  on public.network_connections (user_id, full_name);
create index if not exists network_connections_user_company_idx
  on public.network_connections (user_id, company);

create or replace trigger network_connections_updated
before update on public.network_connections
for each row execute function public.set_updated_at();

alter table public.network_connections enable row level security;
revoke all on public.network_connections from anon;
grant select, insert, update, delete on public.network_connections to authenticated;

drop policy if exists network_connections_owner_all on public.network_connections;
create policy network_connections_owner_all
on public.network_connections
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
