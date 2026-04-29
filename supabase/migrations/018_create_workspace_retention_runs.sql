create table if not exists public.workspace_retention_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  initiated_by uuid references auth.users(id) on delete set null,

  run_type text not null default 'manual_retention_review'
    check (run_type in ('manual_retention_review')),
  status text not null default 'prepared'
    check (status in ('prepared', 'executed', 'failed')),

  retention_mode text not null default 'manual'
    check (retention_mode in ('manual', 'scheduled')),

  invoice_draft_retention_days integer not null default 365
    check (invoice_draft_retention_days >= 0 and invoice_draft_retention_days <= 3650),
  validation_run_retention_days integer not null default 365
    check (validation_run_retention_days >= 0 and validation_run_retention_days <= 3650),
  xml_report_retention_days integer not null default 180
    check (xml_report_retention_days >= 0 and xml_report_retention_days <= 3650),
  activity_log_retention_days integer not null default 365
    check (activity_log_retention_days >= 0 and activity_log_retention_days <= 3650),

  invoice_draft_cutoff_date timestamptz not null,
  validation_run_cutoff_date timestamptz not null,
  xml_report_cutoff_date timestamptz not null,
  activity_log_cutoff_date timestamptz not null,

  invoice_draft_affected_count integer not null default 0
    check (invoice_draft_affected_count >= 0),
  validation_run_affected_count integer not null default 0
    check (validation_run_affected_count >= 0),
  xml_report_affected_count integer not null default 0
    check (xml_report_affected_count >= 0),
  activity_event_affected_count integer not null default 0
    check (activity_event_affected_count >= 0),

  invoice_draft_executed_count integer not null default 0
    check (invoice_draft_executed_count >= 0),
  validation_run_executed_count integer not null default 0
    check (validation_run_executed_count >= 0),
  xml_report_executed_count integer not null default 0
    check (xml_report_executed_count >= 0),
  activity_event_executed_count integer not null default 0
    check (activity_event_executed_count >= 0),

  error_message text not null default ''
    check (char_length(error_message) <= 1000),

  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_retention_runs_org_created_idx
on public.workspace_retention_runs (organization_id, created_at desc);

create or replace function public.set_workspace_retention_runs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_workspace_retention_runs_updated_at
on public.workspace_retention_runs;

create trigger set_workspace_retention_runs_updated_at
before update on public.workspace_retention_runs
for each row
execute function public.set_workspace_retention_runs_updated_at();

alter table public.workspace_retention_runs enable row level security;

drop policy if exists "Workspace members can read retention runs"
on public.workspace_retention_runs;

create policy "Workspace members can read retention runs"
on public.workspace_retention_runs
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = workspace_retention_runs.organization_id
      and membership.user_id = auth.uid()
  )
);

drop policy if exists "Workspace members can create retention runs"
on public.workspace_retention_runs;

create policy "Workspace members can create retention runs"
on public.workspace_retention_runs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = workspace_retention_runs.organization_id
      and membership.user_id = auth.uid()
  )
);

drop policy if exists "Workspace members can update retention runs"
on public.workspace_retention_runs;

create policy "Workspace members can update retention runs"
on public.workspace_retention_runs
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = workspace_retention_runs.organization_id
      and membership.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = workspace_retention_runs.organization_id
      and membership.user_id = auth.uid()
  )
);

grant select, insert, update on public.workspace_retention_runs to authenticated;
