create table if not exists public.workspace_export_packages (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,

  source_privacy_request_id uuid references public.workspace_privacy_requests(id) on delete set null,

  package_type text not null default 'full_workspace'
    check (package_type in ('full_workspace')),

  status text not null default 'prepared'
    check (status in ('prepared', 'failed')),

  export_name text not null
    check (char_length(trim(export_name)) >= 3 and char_length(export_name) <= 180),

  export_format text not null default 'json'
    check (export_format in ('json')),

  record_counts jsonb not null default '{}'::jsonb,
  package_payload jsonb not null default '{}'::jsonb,

  package_size_bytes bigint not null default 0
    check (package_size_bytes >= 0),

  error_message text not null default ''
    check (char_length(error_message) <= 1000),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_export_packages_org_created_idx
on public.workspace_export_packages (organization_id, created_at desc);

create index if not exists workspace_export_packages_requested_by_idx
on public.workspace_export_packages (requested_by, created_at desc);

create index if not exists workspace_export_packages_privacy_request_idx
on public.workspace_export_packages (source_privacy_request_id)
where source_privacy_request_id is not null;

create or replace function public.set_workspace_export_packages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_workspace_export_packages_updated_at
on public.workspace_export_packages;

create trigger set_workspace_export_packages_updated_at
before update on public.workspace_export_packages
for each row
execute function public.set_workspace_export_packages_updated_at();

alter table public.workspace_export_packages enable row level security;

drop policy if exists "Workspace members can read export packages"
on public.workspace_export_packages;

create policy "Workspace members can read export packages"
on public.workspace_export_packages
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = workspace_export_packages.organization_id
      and membership.user_id = auth.uid()
  )
);

drop policy if exists "Workspace members can create export packages"
on public.workspace_export_packages;

create policy "Workspace members can create export packages"
on public.workspace_export_packages
for insert
to authenticated
with check (
  requested_by = auth.uid()
  and exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = workspace_export_packages.organization_id
      and membership.user_id = auth.uid()
  )
);

grant select, insert on public.workspace_export_packages to authenticated;
