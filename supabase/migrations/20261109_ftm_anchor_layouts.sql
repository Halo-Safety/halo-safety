-- Per-vehicle FTM antenna layout, expressed in meters in a vehicle-local XY plane.
-- No fabricated defaults: the three anchors must be surveyed by an operator.
-- Viewer role can read, admin/manager can insert or edit. All other roles denied.
create table if not exists public.ftm_anchor_layouts (
  vehicle_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  front_x_m numeric(9,3) not null,
  front_y_m numeric(9,3) not null,
  rear_left_x_m numeric(9,3) not null,
  rear_left_y_m numeric(9,3) not null,
  rear_right_x_m numeric(9,3) not null,
  rear_right_y_m numeric(9,3) not null,
  front_bias_m numeric(7,3) not null default 0,
  rear_left_bias_m numeric(7,3) not null default 0,
  rear_right_bias_m numeric(7,3) not null default 0,
  assumed_range_error_m numeric(6,3) not null default 0.3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ftm_layout_same_organization
    foreign key (organization_id, vehicle_id)
    references public.vehicles(organization_id, id)
    on delete cascade,
  constraint ftm_layout_coordinates_in_range check (
    front_x_m between -100 and 100 and front_y_m between -100 and 100
    and rear_left_x_m between -100 and 100 and rear_left_y_m between -100 and 100
    and rear_right_x_m between -100 and 100 and rear_right_y_m between -100 and 100
  ),
  constraint ftm_layout_biases_in_range check (
    front_bias_m between -10 and 10 and rear_left_bias_m between -10 and 10
    and rear_right_bias_m between -10 and 10
  ),
  constraint ftm_layout_error_in_range check (assumed_range_error_m between 0.01 and 10),
  constraint ftm_layout_non_collinear check (
    abs(
      (rear_left_x_m-front_x_m) * (rear_right_y_m-front_y_m)
      - (rear_left_y_m-front_y_m) * (rear_right_x_m-front_x_m)
    ) >= 0.01
  )
);
create index if not exists ftm_anchor_layouts_org_idx
  on public.ftm_anchor_layouts(organization_id);

alter table public.ftm_anchor_layouts enable row level security;
revoke all on public.ftm_anchor_layouts from anon, authenticated;
grant select, insert, update on public.ftm_anchor_layouts to authenticated;

drop policy if exists "Organization members read FTM anchor layouts" on public.ftm_anchor_layouts;
create policy "Organization members read FTM anchor layouts" on public.ftm_anchor_layouts
for select to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = ftm_anchor_layouts.organization_id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists "Organization editors insert FTM anchor layouts" on public.ftm_anchor_layouts;
create policy "Organization editors insert FTM anchor layouts" on public.ftm_anchor_layouts
for insert to authenticated
with check (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = ftm_anchor_layouts.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('admin','manager')
  )
);

drop policy if exists "Organization editors update FTM anchor layouts" on public.ftm_anchor_layouts;
create policy "Organization editors update FTM anchor layouts" on public.ftm_anchor_layouts
for update to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = ftm_anchor_layouts.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('admin','manager')
  )
)
with check (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = ftm_anchor_layouts.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('admin','manager')
  )
);

drop trigger if exists ftm_anchor_layout_updated_at on public.ftm_anchor_layouts;
create trigger ftm_anchor_layout_updated_at
before update on public.ftm_anchor_layouts
for each row execute function public.touch_halo_workflow_updated_at();

-- FTM ranges continue to be stored as collected. The 2D estimate is derived
-- in the browser using this editable calibration; changing the layout never
-- rewrites historic raw measurements, sensor_events or safety_cases.
