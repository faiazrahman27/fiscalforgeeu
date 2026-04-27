create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.invoice_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  invoice_number text not null default '',
  buyer_name text not null default '',
  buyer_country text not null default '',
  currency text not null default '',
  payable_amount text not null default '',
  payload jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.validation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  invoice_number text not null default '',
  buyer_name text not null default '',
  seller_name text not null default '',
  technical_status text not null default '',
  standard_status text not null default '',
  country_simulation_status text not null default '',
  vida_readiness_status text not null default '',
  confidence text not null default '',
  currency text not null default '',
  totals jsonb not null default '{}'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  disclaimer text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.xml_readiness_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  file_name text not null default '',
  file_size text not null default '',
  detected_document text not null default '',
  root_element text not null default '',
  invoice_id text not null default '',
  issue_date text not null default '',
  currency text not null default '',
  api_status text not null default '',
  technical_status text not null default '',
  readiness_status text not null default '',
  document_status text not null default '',
  calculation_status text not null default '',
  profile_status text not null default '',
  extracted_data jsonb not null default '{}'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  disclaimer text not null default '',
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (char_length(trim(event_type)) between 1 and 120),
  entity_type text not null default '',
  entity_id text not null default '',
  ip_address inet,
  user_agent text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles(email);

create index if not exists organizations_created_by_idx
  on public.organizations(created_by);

create index if not exists organization_memberships_user_id_idx
  on public.organization_memberships(user_id);

create index if not exists organization_memberships_organization_id_idx
  on public.organization_memberships(organization_id);

create index if not exists invoice_drafts_organization_updated_idx
  on public.invoice_drafts(organization_id, updated_at desc);

create index if not exists validation_runs_organization_created_idx
  on public.validation_runs(organization_id, created_at desc);

create index if not exists xml_readiness_reports_organization_uploaded_idx
  on public.xml_readiness_reports(organization_id, uploaded_at desc);

create index if not exists audit_events_organization_created_idx
  on public.audit_events(organization_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at();

drop trigger if exists set_organization_memberships_updated_at on public.organization_memberships;
create trigger set_organization_memberships_updated_at
before update on public.organization_memberships
for each row
execute function public.set_updated_at();

drop trigger if exists set_invoice_drafts_updated_at on public.invoice_drafts;
create trigger set_invoice_drafts_updated_at
before update on public.invoice_drafts
for each row
execute function public.set_updated_at();

drop trigger if exists set_validation_runs_updated_at on public.validation_runs;
create trigger set_validation_runs_updated_at
before update on public.validation_runs
for each row
execute function public.set_updated_at();

drop trigger if exists set_xml_readiness_reports_updated_at on public.xml_readiness_reports;
create trigger set_xml_readiness_reports_updated_at
before update on public.xml_readiness_reports
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin_or_owner(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_org_owner(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
      and membership.role = 'owner'
  );
$$;

create or replace function public.organization_has_no_members(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
  );
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.invoice_drafts enable row level security;
alter table public.validation_runs enable row level security;
alter table public.xml_readiness_reports enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "organizations_select_members" on public.organizations;
create policy "organizations_select_members"
on public.organizations
for select
to authenticated
using (public.is_org_member(id));

drop policy if exists "organizations_insert_authenticated" on public.organizations;
create policy "organizations_insert_authenticated"
on public.organizations
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "organizations_update_admins" on public.organizations;
create policy "organizations_update_admins"
on public.organizations
for update
to authenticated
using (public.is_org_admin_or_owner(id))
with check (public.is_org_admin_or_owner(id));

drop policy if exists "organizations_delete_owners" on public.organizations;
create policy "organizations_delete_owners"
on public.organizations
for delete
to authenticated
using (public.is_org_owner(id));

drop policy if exists "memberships_select_members" on public.organization_memberships;
create policy "memberships_select_members"
on public.organization_memberships
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "memberships_insert_owner_or_bootstrap" on public.organization_memberships;
create policy "memberships_insert_owner_or_bootstrap"
on public.organization_memberships
for insert
to authenticated
with check (
  public.is_org_owner(organization_id)
  or (
    public.organization_has_no_members(organization_id)
    and user_id = auth.uid()
    and role = 'owner'
  )
);

drop policy if exists "memberships_update_owners" on public.organization_memberships;
create policy "memberships_update_owners"
on public.organization_memberships
for update
to authenticated
using (public.is_org_owner(organization_id))
with check (public.is_org_owner(organization_id));

drop policy if exists "memberships_delete_owners" on public.organization_memberships;
create policy "memberships_delete_owners"
on public.organization_memberships
for delete
to authenticated
using (public.is_org_owner(organization_id));

drop policy if exists "invoice_drafts_select_members" on public.invoice_drafts;
create policy "invoice_drafts_select_members"
on public.invoice_drafts
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "invoice_drafts_insert_members" on public.invoice_drafts;
create policy "invoice_drafts_insert_members"
on public.invoice_drafts
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and created_by = auth.uid()
);

drop policy if exists "invoice_drafts_update_members" on public.invoice_drafts;
create policy "invoice_drafts_update_members"
on public.invoice_drafts
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "invoice_drafts_delete_admins" on public.invoice_drafts;
create policy "invoice_drafts_delete_admins"
on public.invoice_drafts
for delete
to authenticated
using (public.is_org_admin_or_owner(organization_id));

drop policy if exists "validation_runs_select_members" on public.validation_runs;
create policy "validation_runs_select_members"
on public.validation_runs
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "validation_runs_insert_members" on public.validation_runs;
create policy "validation_runs_insert_members"
on public.validation_runs
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and created_by = auth.uid()
);

drop policy if exists "validation_runs_update_admins" on public.validation_runs;
create policy "validation_runs_update_admins"
on public.validation_runs
for update
to authenticated
using (public.is_org_admin_or_owner(organization_id))
with check (public.is_org_admin_or_owner(organization_id));

drop policy if exists "validation_runs_delete_admins" on public.validation_runs;
create policy "validation_runs_delete_admins"
on public.validation_runs
for delete
to authenticated
using (public.is_org_admin_or_owner(organization_id));

drop policy if exists "xml_reports_select_members" on public.xml_readiness_reports;
create policy "xml_reports_select_members"
on public.xml_readiness_reports
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "xml_reports_insert_members" on public.xml_readiness_reports;
create policy "xml_reports_insert_members"
on public.xml_readiness_reports
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and created_by = auth.uid()
);

drop policy if exists "xml_reports_update_admins" on public.xml_readiness_reports;
create policy "xml_reports_update_admins"
on public.xml_readiness_reports
for update
to authenticated
using (public.is_org_admin_or_owner(organization_id))
with check (public.is_org_admin_or_owner(organization_id));

drop policy if exists "xml_reports_delete_admins" on public.xml_readiness_reports;
create policy "xml_reports_delete_admins"
on public.xml_readiness_reports
for delete
to authenticated
using (public.is_org_admin_or_owner(organization_id));

drop policy if exists "audit_events_select_members" on public.audit_events;
create policy "audit_events_select_members"
on public.audit_events
for select
to authenticated
using (
  organization_id is null
  or public.is_org_member(organization_id)
);

drop policy if exists "audit_events_insert_members" on public.audit_events;
create policy "audit_events_insert_members"
on public.audit_events
for insert
to authenticated
with check (
  actor_user_id = auth.uid()
  and (
    organization_id is null
    or public.is_org_member(organization_id)
  )
);
