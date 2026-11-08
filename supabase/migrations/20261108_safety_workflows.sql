-- Halo Safety Intelligence: incremental migration for organization-owned workflows.
-- Apply AFTER supabase/schema.sql using a privileged Supabase SQL editor session.
-- Does not modify or seed sensor_events; safe to rerun.
-- Device ingestion remains a separate, server-authenticated feature.

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asset_tag text not null check (length(trim(asset_tag)) between 1 and 80),
  name text not null check (length(trim(name)) between 1 and 160),
  vehicle_type text not null default 'Other',
  ownership_kind text not null default 'owned'
    check (ownership_kind in ('owned', 'leased', 'rented', 'contractor')),
  owner_name text not null default '',
  site text not null default '',
  operator_ref text not null default '',
  sensor_source text not null default '',
  device_status text not null default 'unknown'
    check (device_status in ('online', 'offline', 'unreliable', 'unknown')),
  operating_hours numeric(12,2) not null default 0 check (operating_hours >= 0),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, asset_tag)
);

create table if not exists public.safety_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid,
  title text not null check (length(trim(title)) between 1 and 200),
  occurred_at timestamptz not null default now(),
  zone text not null default '',
  shift_name text not null default '',
  worker_ref text not null default '',
  operator_at_event text not null default '',
  source_label text not null default 'Manual report',
  observation_count integer not null default 1 check (observation_count >= 1),
  classification text not null default 'candidate'
    check (classification in ('candidate', 'reviewed_near_miss', 'false_alarm', 'device_fault')),
  status text not null default 'needs_review'
    check (status in ('needs_review', 'investigating', 'action_assigned', 'monitoring', 'closed', 'dismissed')),
  potential_severity text not null default 'medium'
    check (potential_severity in ('critical', 'high', 'medium', 'low')),
  summary text not null default '',
  evidence_notes text not null default '',
  pattern_notes text not null default '',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint safety_cases_vehicle_same_org
    foreign key (organization_id, vehicle_id)
    references public.vehicles(organization_id, id)
    on delete set null (vehicle_id)
);

create table if not exists public.corrective_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 240),
  owner_ref text not null default '',
  due_date date,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'completed')),
  verification_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint corrective_actions_case_same_org
    foreign key (organization_id, case_id)
    references public.safety_cases(organization_id, id)
    on delete cascade
);

create index if not exists vehicles_by_org on public.vehicles(organization_id, asset_tag);
create index if not exists cases_by_org_time on public.safety_cases(organization_id, occurred_at desc);
create index if not exists cases_by_org_vehicle on public.safety_cases(organization_id, vehicle_id);
create index if not exists actions_by_org_case on public.corrective_actions(organization_id, case_id);
create index if not exists actions_by_org_due on public.corrective_actions(organization_id, due_date)
  where status <> 'completed';

create or replace function public.touch_halo_workflow_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists vehicles_updated_at on public.vehicles;
create trigger vehicles_updated_at
before update on public.vehicles for each row execute function public.touch_halo_workflow_updated_at();

drop trigger if exists safety_cases_updated_at on public.safety_cases;
create trigger safety_cases_updated_at
before update on public.safety_cases for each row execute function public.touch_halo_workflow_updated_at();

drop trigger if exists corrective_actions_updated_at on public.corrective_actions;
create trigger corrective_actions_updated_at
before update on public.corrective_actions for each row execute function public.touch_halo_workflow_updated_at();

alter table public.vehicles enable row level security;
alter table public.safety_cases enable row level security;
alter table public.corrective_actions enable row level security;

revoke all on table public.vehicles, public.safety_cases, public.corrective_actions
from anon, authenticated;
grant select, insert, update on table public.vehicles, public.safety_cases, public.corrective_actions
to authenticated;

-- Uses the existing organization_members policy, which permits the caller to
-- read only their own rows. No privileged function is needed for membership.
drop policy if exists "Org members can read vehicles" on public.vehicles;
create policy "Org members can read vehicles" on public.vehicles
for select to authenticated using (
  exists (select 1 from public.organization_members m
          where m.organization_id = vehicles.organization_id
            and m.user_id = (select auth.uid()))
);

drop policy if exists "Org editors can insert vehicles" on public.vehicles;
create policy "Org editors can insert vehicles" on public.vehicles
for insert to authenticated with check (
  exists (select 1 from public.organization_members m
          where m.organization_id = vehicles.organization_id
            and m.user_id = (select auth.uid()) and m.role in ('admin','manager'))
);

drop policy if exists "Org editors can update vehicles" on public.vehicles;
create policy "Org editors can update vehicles" on public.vehicles
for update to authenticated
using (exists (select 1 from public.organization_members m
               where m.organization_id = vehicles.organization_id
                 and m.user_id = (select auth.uid()) and m.role in ('admin','manager')))
with check (exists (select 1 from public.organization_members m
                   where m.organization_id = vehicles.organization_id
                     and m.user_id = (select auth.uid()) and m.role in ('admin','manager')));

drop policy if exists "Org members can read cases" on public.safety_cases;
create policy "Org members can read cases" on public.safety_cases
for select to authenticated using (
  exists (select 1 from public.organization_members m
          where m.organization_id = safety_cases.organization_id
            and m.user_id = (select auth.uid()))
);

drop policy if exists "Org editors can insert cases" on public.safety_cases;
create policy "Org editors can insert cases" on public.safety_cases
for insert to authenticated with check (
  exists (select 1 from public.organization_members m
          where m.organization_id = safety_cases.organization_id
            and m.user_id = (select auth.uid()) and m.role in ('admin','manager'))
);

drop policy if exists "Org editors can update cases" on public.safety_cases;
create policy "Org editors can update cases" on public.safety_cases
for update to authenticated
using (exists (select 1 from public.organization_members m
               where m.organization_id = safety_cases.organization_id
                 and m.user_id = (select auth.uid()) and m.role in ('admin','manager')))
with check (exists (select 1 from public.organization_members m
                   where m.organization_id = safety_cases.organization_id
                     and m.user_id = (select auth.uid()) and m.role in ('admin','manager')));

drop policy if exists "Org members can read actions" on public.corrective_actions;
create policy "Org members can read actions" on public.corrective_actions
for select to authenticated using (
  exists (select 1 from public.organization_members m
          where m.organization_id = corrective_actions.organization_id
            and m.user_id = (select auth.uid()))
);

drop policy if exists "Org editors can insert actions" on public.corrective_actions;
create policy "Org editors can insert actions" on public.corrective_actions
for insert to authenticated with check (
  exists (select 1 from public.organization_members m
          where m.organization_id = corrective_actions.organization_id
            and m.user_id = (select auth.uid()) and m.role in ('admin','manager'))
);

drop policy if exists "Org editors can update actions" on public.corrective_actions;
create policy "Org editors can update actions" on public.corrective_actions
for update to authenticated
using (exists (select 1 from public.organization_members m
               where m.organization_id = corrective_actions.organization_id
                 and m.user_id = (select auth.uid()) and m.role in ('admin','manager')))
with check (exists (select 1 from public.organization_members m
                   where m.organization_id = corrective_actions.organization_id
                     and m.user_id = (select auth.uid()) and m.role in ('admin','manager')));

-- Intentionally no authenticated DELETE policies.
-- The existing sensor_events table remains read-only to browser users.
