create table if not exists public.workspace_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
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
  allow_data_export_requests boolean not null default true,
  allow_deletion_requests boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_workspace_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_workspace_settings_updated_at on public.workspace_settings;

create trigger set_workspace_settings_updated_at
before update on public.workspace_settings
for each row
execute function public.set_workspace_settings_updated_at();

alter table public.workspace_settings enable row level security;

drop policy if exists "Workspace members can read workspace settings"
on public.workspace_settings;

create policy "Workspace members can read workspace settings"
on public.workspace_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = workspace_settings.organization_id
      and membership.user_id = auth.uid()
  )
);

drop policy if exists "Workspace members can create workspace settings"
on public.workspace_settings;

create policy "Workspace members can create workspace settings"
on public.workspace_settings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = workspace_settings.organization_id
      and membership.user_id = auth.uid()
  )
);

drop policy if exists "Workspace members can update workspace settings"
on public.workspace_settings;

create policy "Workspace members can update workspace settings"
on public.workspace_settings
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = workspace_settings.organization_id
      and membership.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = workspace_settings.organization_id
      and membership.user_id = auth.uid()
  )
);

grant select, insert, update on public.workspace_settings to authenticated;
