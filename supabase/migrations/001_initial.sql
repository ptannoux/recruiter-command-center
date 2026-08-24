-- Recruiter Command Center initial schema
create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create table if not exists public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  positioning text not null default '',
  target_roles text not null default '',
  target_companies text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recruiters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_key text not null,
  name text not null,
  firm text not null default '',
  title text,
  location text,
  email text,
  linkedin_url text,
  priority text not null default 'C' check (priority in ('A','B','C')),
  fit_score integer not null default 0 check (fit_score between 0 and 100),
  relationship text,
  research_status text,
  company_focus text,
  background text,
  why_fit text,
  status text not null default 'Research' check (status in ('Research','Ready to reach out','Contacted','Replied','Meeting','Closed')),
  approved boolean not null default false,
  last_contact date,
  next_step text,
  notes text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, external_key)
);
create index if not exists recruiters_user_fit_idx on public.recruiters(user_id, fit_score desc);
create index if not exists recruiters_user_status_idx on public.recruiters(user_id, status);
create index if not exists recruiters_tags_gin_idx on public.recruiters using gin(tags);

create table if not exists public.recruiter_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recruiter_id uuid not null references public.recruiters(id) on delete cascade,
  label text not null,
  url text not null,
  checked_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists recruiter_sources_recruiter_idx on public.recruiter_sources(recruiter_id);

create table if not exists public.outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recruiter_id uuid not null references public.recruiters(id) on delete cascade,
  channel text not null check (channel in ('linkedin','email')),
  subject text,
  body text not null,
  status text not null default 'draft' check (status in ('draft','approved','used','archived')),
  generated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists outreach_recruiter_created_idx on public.outreach_drafts(recruiter_id, created_at desc);

create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recruiter_id uuid references public.recruiters(id) on delete set null,
  channel text not null check (channel in ('email','linkedin','phone','meeting','other')),
  direction text check (direction in ('inbound','outbound','internal')),
  occurred_at timestamptz not null default now(),
  subject text,
  body text,
  external_message_id text,
  external_thread_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists interactions_recruiter_time_idx on public.interactions(recruiter_id, occurred_at desc);
create unique index if not exists interactions_external_message_unique on public.interactions(user_id, external_message_id) where external_message_id is not null;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  website text,
  linkedin_url text,
  sector text,
  priority text default 'Watch',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,name)
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  title text not null,
  stage text not null default 'Target',
  source_url text,
  description text,
  fit_score integer check (fit_score between 0 and 100),
  next_step text,
  next_step_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunity_recruiters (
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  recruiter_id uuid not null references public.recruiters(id) on delete cascade,
  relationship_note text,
  primary key(opportunity_id,recruiter_id)
);

-- updated_at triggers
create or replace trigger app_settings_updated before update on public.app_settings for each row execute function public.set_updated_at();
create or replace trigger recruiters_updated before update on public.recruiters for each row execute function public.set_updated_at();
create or replace trigger outreach_drafts_updated before update on public.outreach_drafts for each row execute function public.set_updated_at();
create or replace trigger companies_updated before update on public.companies for each row execute function public.set_updated_at();
create or replace trigger opportunities_updated before update on public.opportunities for each row execute function public.set_updated_at();

-- Defense in depth: exposed tables are only available to signed-in users, and only for their own rows.
do $$
declare t text;
begin
  foreach t in array array['app_settings','recruiters','recruiter_sources','outreach_drafts','interactions','companies','opportunities','opportunity_recruiters']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;
