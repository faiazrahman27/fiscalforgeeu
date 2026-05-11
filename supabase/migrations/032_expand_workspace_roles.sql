-- Invoice Lantern
-- Migration 032: expand workspace roles for production RBAC.
--
-- This migration replaces the early broad "member" role with explicit
-- production roles while preserving existing users by mapping:
--
--   member -> accountant
--
-- Role set after this migration:
--
--   owner
--   admin
--   accountant
--   developer
--   reviewer
--   viewer
--
-- Notes:
-- - Existing RLS helper functions are preserved.
-- - public.is_org_member(...) continues to mean "belongs to workspace".
-- - public.is_org_admin_or_owner(...) remains the privileged admin helper.
-- - New helper functions add safer role-specific permission checks.
-- - No tenant data is deleted.

begin;

update public.organization_memberships
set role = 'accountant',
    updated_at = now()
where role = 'member';

alter table public.organization_memberships
drop constraint if exists organization_memberships_role_check;

alter table public.organization_memberships
add constraint organization_memberships_role_check
check (
  role in (
    'owner',
    'admin',
    'accountant',
    'developer',
    'reviewer',
    'viewer'
  )
);

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

create or replace function public.get_org_role(target_organization_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select membership.role
  from public.organization_memberships membership
  where membership.organization_id = target_organization_id
    and membership.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.has_org_role(
  target_organization_id uuid,
  allowed_roles text[]
)
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
      and membership.role = any(allowed_roles)
  );
$$;

create or replace function public.is_org_owner(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_role(target_organization_id, array['owner']);
$$;

create or replace function public.is_org_admin_or_owner(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_role(target_organization_id, array['owner', 'admin']);
$$;

create or replace function public.can_manage_org(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_role(target_organization_id, array['owner', 'admin']);
$$;

create or replace function public.can_invite_members(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_role(target_organization_id, array['owner', 'admin']);
$$;

create or replace function public.can_create_invoice(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_role(
    target_organization_id,
    array['owner', 'admin', 'accountant', 'reviewer']
  );
$$;

create or replace function public.can_validate_invoice(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_role(
    target_organization_id,
    array['owner', 'admin', 'accountant', 'developer', 'reviewer']
  );
$$;

create or replace function public.can_manage_api_keys(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_role(
    target_organization_id,
    array['owner', 'admin', 'developer']
  );
$$;

create or replace function public.can_view_audit_logs(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_role(
    target_organization_id,
    array['owner', 'admin', 'developer']
  );
$$;

create or replace function public.can_delete_workspace_data(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_role(target_organization_id, array['owner', 'admin']);
$$;

grant execute on function public.get_org_role(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;
grant execute on function public.can_manage_org(uuid) to authenticated;
grant execute on function public.can_invite_members(uuid) to authenticated;
grant execute on function public.can_create_invoice(uuid) to authenticated;
grant execute on function public.can_validate_invoice(uuid) to authenticated;
grant execute on function public.can_manage_api_keys(uuid) to authenticated;
grant execute on function public.can_view_audit_logs(uuid) to authenticated;
grant execute on function public.can_delete_workspace_data(uuid) to authenticated;

commit;