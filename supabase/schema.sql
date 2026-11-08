-- Halo initial production data model
-- Apply in Supabase SQL Editor as a privileged project administrator.
-- All browser-facing tables use RLS; no public inserts of device incidents.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('admin','manager','viewer')),
  primary key (organization_id, user_id)
);

create index if not exists org_members_user_idx
  on public.organization_members (user_id, organization_id);

create table if not exists public.sensor_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  worker_id text not null,
  machine_id text not null,
  event_type text not null,
  rssi integer,
  timestamp timestamptz not null default now(),
  source text not null default 'device',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists sensor_events_org_time_idx
  on public.sensor_events (organization_id, timestamp desc);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.sensor_events enable row level security;

-- Grants control which operations can reach RLS at all.
revoke all on table public.organizations,
  public.organization_members,
  public.sensor_events from anon, authenticated;
grant select on table public.organizations,
  public.organization_members,
  public.sensor_events to authenticated;

-- A signed-in user can only see their own organization membership rows.
create policy "Members can read their memberships"
on public.organization_members
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Members can read their organization"
on public.organizations
for select to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = organizations.id
      and m.user_id = (select auth.uid())
  )
);

create policy "Members can read their organization's events"
on public.sensor_events
for select to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = sensor_events.organization_id
      and m.user_id = (select auth.uid())
  )
);

-- Do not grant browser insert/update/delete on events. Ingestion from ESP32
-- should go through a server/Edge Function that validates device credentials.
-- Use the server-side service role only in a protected environment.
