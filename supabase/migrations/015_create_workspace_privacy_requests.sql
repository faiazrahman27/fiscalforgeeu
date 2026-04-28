create table if not exists public.workspace_privacy_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null
    check (request_type in ('data_export', 'deletion', 'retention_review')),
  status text not null default 'submitted'
    check (status in ('submitted', 'in_review', 'completed', 'rejected')),
  subject text not null
    check (char_length(trim(subject)) >= 3 and char_length(subject) <= 120),
  details text not null default ''
    check (char_length(details) <= 1000),
  requester_email text not null default '',
  reviewer_user_id uuid references auth.users(id) on delete set null,
  review_note text not null default ''
    check (char_length(review_note) <= 1000),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_privacy_requests_org_created_idx
on public.workspace_privacy_requests (organization_id, created_at desc);

create index if not exists workspace_privacy_requests_requester_idx
on public.workspace_privacy_requests (requester_user_id, created_at desc);

create or replace function public.set_workspace_privacy_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_workspace_privacy_requests_updated_at
on public.workspace_privacy_requests;

create trigger set_workspace_privacy_requests_updated_at
before update on public.workspace_privacy_requests
for each row
execute function public.set_workspace_privacy_requests_updated_at();

alter table public.workspace_privacy_requests enable row level security;

drop policy if exists "Workspace members can read privacy requests"
on public.workspace_privacy_requests;

create policy "Workspace members can read privacy requests"
on public.workspace_privacy_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = workspace_privacy_requests.organization_id
      and membership.user_id = auth.uid()
  )
);

drop policy if exists "Workspace members can create privacy requests"
on public.workspace_privacy_requests;

create policy "Workspace members can create privacy requests"
on public.workspace_privacy_requests
for insert
to authenticated
with check (
  requester_user_id = auth.uid()
  and exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = workspace_privacy_requests.organization_id
      and membership.user_id = auth.uid()
  )
);

grant select, insert on public.workspace_privacy_requests to authenticated;
