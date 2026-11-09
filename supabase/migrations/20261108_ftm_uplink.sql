-- Halo FTM uplink: authenticated gateway registry and raw experimental samples.
-- Does not create sensor_events, incidents or cases. Apply after safety_workflows.
create table if not exists public.ftm_gateways (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null,
  worker_ref text not null check (length(trim(worker_ref)) between 1 and 80),
  label text not null default 'FTM USB gateway',
  token_sha256 text not null unique check (token_sha256 ~ '^[0-9a-f]{64}$'),
  enabled boolean not null default true,
  is_demo boolean not null default false,
  last_received_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint ftm_gateway_vehicle_same_org foreign key (organization_id, vehicle_id)
    references public.vehicles(organization_id, id)
    on delete cascade
);
create index if not exists ftm_gateways_org_idx on public.ftm_gateways(organization_id);

create table if not exists public.ftm_measurements (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  gateway_id uuid not null,
  vehicle_id uuid not null,
  worker_ref text not null,
  sample_id uuid not null,
  measured_at timestamptz not null,
  received_at timestamptz not null default now(),
  front_m numeric(8,3),
  rear_left_m numeric(8,3),
  rear_right_m numeric(8,3),
  x_m numeric(9,3),
  y_m numeric(9,3),
  residual_m numeric(8,3),
  spread_m numeric(8,3),
  quality text not null check (quality in ('ranges_only','rough_estimate','self_consistent','partial')),
  is_demo boolean not null default false,
  constraint ftm_samples_gateway_same_org foreign key (gateway_id, organization_id)
    references public.ftm_gateways(id, organization_id)
    on delete cascade,
  constraint ftm_samples_vehicle_same_org foreign key (organization_id, vehicle_id)
    references public.vehicles(organization_id, id),
  constraint ftm_samples_front_valid check (front_m is null or front_m between 0 and 1000),
  constraint ftm_samples_left_valid check (rear_left_m is null or rear_left_m between 0 and 1000),
  constraint ftm_samples_right_valid check (rear_right_m is null or rear_right_m between 0 and 1000),
  constraint ftm_samples_coords_valid check ((x_m is null) = (y_m is null)),
  constraint ftm_samples_residual_valid check (residual_m is null or residual_m >= 0),
  constraint ftm_samples_spread_valid check (spread_m is null or spread_m >= 0),
  unique (gateway_id, sample_id)
);
create index if not exists ftm_org_time_idx
  on public.ftm_measurements(organization_id, received_at desc);
create index if not exists ftm_gateway_time_idx
  on public.ftm_measurements(gateway_id, received_at desc);

alter table public.ftm_gateways enable row level security;
alter table public.ftm_measurements enable row level security;

-- Gateway token hashes, organization mapping, and key rotation are server-only.
revoke all on table public.ftm_gateways from anon, authenticated;
revoke all on table public.ftm_measurements from anon, authenticated;
grant select on public.ftm_measurements to authenticated;

drop policy if exists "Members read their own FTM measurements" on public.ftm_measurements;
create policy "Members read their own FTM measurements" on public.ftm_measurements
for select to authenticated
using (
  exists (select 1 from public.organization_members m
          where m.organization_id = ftm_measurements.organization_id
            and m.user_id = (select auth.uid()))
);

-- Browser has no INSERT/UPDATE/DELETE on samples; only the deployed Edge
-- Function with its server-side secret key can insert authenticated readings.
-- Avoid storing gateway credentials in code, VITE_ vars or Flask responses.
