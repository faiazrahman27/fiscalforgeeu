create table if not exists public.validation_run_totals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  validation_run_id uuid not null references public.validation_runs(id) on delete cascade,
  line_extension_amount numeric(18, 2) not null default 0,
  tax_exclusive_amount numeric(18, 2) not null default 0,
  tax_amount numeric(18, 2) not null default 0,
  tax_inclusive_amount numeric(18, 2) not null default 0,
  payable_amount numeric(18, 2) not null default 0,
  currency text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (validation_run_id)
);

create table if not exists public.validation_run_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  validation_run_id uuid not null references public.validation_runs(id) on delete cascade,
  finding_position integer not null check (finding_position >= 1),
  code text not null default '',
  severity text not null check (severity in ('info', 'warning', 'fatal')),
  field_path text not null default '',
  message text not null default '',
  legal_confidence text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (validation_run_id, finding_position)
);

create index if not exists validation_run_totals_org_idx
  on public.validation_run_totals(organization_id);

create index if not exists validation_run_totals_run_idx
  on public.validation_run_totals(validation_run_id);

create index if not exists validation_run_findings_org_idx
  on public.validation_run_findings(organization_id);

create index if not exists validation_run_findings_run_idx
  on public.validation_run_findings(validation_run_id);

create index if not exists validation_run_findings_severity_idx
  on public.validation_run_findings(organization_id, severity);

create index if not exists validation_run_findings_code_idx
  on public.validation_run_findings(organization_id, code);

alter table public.validation_run_totals enable row level security;
alter table public.validation_run_findings enable row level security;

drop policy if exists "Members can read validation run totals"
  on public.validation_run_totals;

create policy "Members can read validation run totals"
  on public.validation_run_totals
  for select
  using (public.is_org_member(organization_id));

drop policy if exists "Members can insert validation run totals"
  on public.validation_run_totals;

create policy "Members can insert validation run totals"
  on public.validation_run_totals
  for insert
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can update validation run totals"
  on public.validation_run_totals;

create policy "Members can update validation run totals"
  on public.validation_run_totals
  for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can delete validation run totals"
  on public.validation_run_totals;

create policy "Members can delete validation run totals"
  on public.validation_run_totals
  for delete
  using (public.is_org_member(organization_id));

drop policy if exists "Members can read validation run findings"
  on public.validation_run_findings;

create policy "Members can read validation run findings"
  on public.validation_run_findings
  for select
  using (public.is_org_member(organization_id));

drop policy if exists "Members can insert validation run findings"
  on public.validation_run_findings;

create policy "Members can insert validation run findings"
  on public.validation_run_findings
  for insert
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can update validation run findings"
  on public.validation_run_findings;

create policy "Members can update validation run findings"
  on public.validation_run_findings
  for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can delete validation run findings"
  on public.validation_run_findings;

create policy "Members can delete validation run findings"
  on public.validation_run_findings
  for delete
  using (public.is_org_member(organization_id));

grant select, insert, update, delete
on table public.validation_run_totals
to authenticated;

grant select, insert, update, delete
on table public.validation_run_findings
to authenticated;
