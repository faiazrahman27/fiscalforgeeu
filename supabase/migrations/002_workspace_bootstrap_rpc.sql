create or replace function public.bootstrap_personal_workspace()
returns table (
  organization_id uuid,
  organization_name text,
  organization_slug text,
  membership_role text,
  user_email text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_user_email text;
  existing_membership record;
  created_organization_id uuid;
  created_organization_name text;
  created_organization_slug text;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select coalesce(email, '')
  into current_user_email
  from auth.users
  where id = current_user_id;

  insert into public.profiles (id, email, display_name)
  values (current_user_id, current_user_email, '')
  on conflict (id) do update
  set
    email = excluded.email,
    updated_at = now();

  select
    memberships.role,
    organizations.id,
    organizations.name,
    organizations.slug
  into existing_membership
  from public.organization_memberships memberships
  join public.organizations organizations
    on organizations.id = memberships.organization_id
  where memberships.user_id = current_user_id
  order by memberships.created_at asc
  limit 1;

  if existing_membership.id is not null then
    organization_id := existing_membership.id;
    organization_name := existing_membership.name;
    organization_slug := existing_membership.slug;
    membership_role := existing_membership.role;
    user_email := current_user_email;
    return next;
    return;
  end if;

  created_organization_name :=
    coalesce(
      nullif(
        trim(
          regexp_replace(
            split_part(current_user_email, '@', 1),
            '[^a-zA-Z0-9]+',
            ' ',
            'g'
          )
        ),
        ''
      ),
      'Personal'
    ) || ' Workspace';

  created_organization_slug :=
    'workspace-' || replace(current_user_id::text, '-', '');

  insert into public.organizations (name, slug, created_by)
  values (
    left(created_organization_name, 160),
    left(created_organization_slug, 80),
    current_user_id
  )
  on conflict (slug) do update
  set updated_at = now()
  returning id, name, slug
  into created_organization_id, created_organization_name, created_organization_slug;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role
  )
  values (
    created_organization_id,
    current_user_id,
    'owner'
  )
  on conflict (organization_id, user_id) do update
  set
    role = excluded.role,
    updated_at = now();

  organization_id := created_organization_id;
  organization_name := created_organization_name;
  organization_slug := created_organization_slug;
  membership_role := 'owner';
  user_email := current_user_email;

  return next;
end;
$$;

revoke all on function public.bootstrap_personal_workspace() from public;
grant execute on function public.bootstrap_personal_workspace() to authenticated;
