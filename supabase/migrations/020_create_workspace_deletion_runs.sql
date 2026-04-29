create table if not exists public.workspace_deletion_runs (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id) on delete cascade,

  source_privacy_request_id uuid
    references public.workspace_privacy_requests(id) on delete set null,

  initiated_by uuid
    references auth.users(id) on delete set null,

  run_type text not null default 'privacy_request_deletion'
    check (run_type in ('privacy_request_deletion')),

  status text not null default 'prepared'
    check (status in ('prepared', 'executed', 'failed')),

  invoice_draft_affected_count integer not null default 0
    check (invoice_draft_affected_count >= 0),

  validation_run_affected_count integer not null default 0
    check (validation_run_affected_count >= 0),

  xml_report_affected_count integer not null default 0
    check (xml_report_affected_count >= 0),

  workspace_export_package_affected_count integer not null default 0
    check (workspace_export_package_affected_count >= 0),

  activity_event_affected_count integer not null default 0
    check (activity_event_affected_count >= 0),

  invoice_draft_executed_count integer not null default 0
    check (invoice_draft_executed_count >= 0),

  validation_run_executed_count integer not null default 0
    check (validation_run_executed_count >= 0),

  xml_report_executed_count integer not null default 0
    check (xml_report_executed_count >= 0),

  workspace_export_package_executed_count integer not null default 0
    check (workspace_export_package_executed_count >= 0),

  activity_event_executed_count integer not null default 0
    check (activity_event_executed_count >= 0),

  error_message text not null default ''
    check (char_length(error_message) <= 1000),

  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_deletion_runs_org_created_idx
on public.workspace_deletion_runs (organization_id, created_at desc);

create index if not exists workspace_deletion_runs_source_privacy_request_idx
on public.workspace_deletion_runs (source_privacy_request_id);

create or replace function public.set_workspace_deletion_runs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_workspace_deletion_runs_updated_at
on public.workspace_deletion_runs;

create trigger set_workspace_deletion_runs_updated_at
before update on public.workspace_deletion_runs
for each row
execute function public.set_workspace_deletion_runs_updated_at();

alter table public.workspace_deletion_runs enable row level security;

drop policy if exists "Workspace members can read deletion runs"
on public.workspace_deletion_runs;

create policy "Workspace members can read deletion runs"
on public.workspace_deletion_runs
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = workspace_deletion_runs.organization_id
      and membership.user_id = auth.uid()
  )
);

drop policy if exists "Workspace members can create deletion runs"
on public.workspace_deletion_runs;

create policy "Workspace members can create deletion runs"
on public.workspace_deletion_runs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = workspace_deletion_runs.organization_id
      and membership.user_id = auth.uid()
  )
);

drop policy if exists "Workspace members can update deletion runs"
on public.workspace_deletion_runs;

create policy "Workspace members can update deletion runs"
on public.workspace_deletion_runs
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = workspace_deletion_runs.organization_id
      and membership.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = workspace_deletion_runs.organization_id
      and membership.user_id = auth.uid()
  )
);

grant select, insert, update on public.workspace_deletion_runs to authenticated;
