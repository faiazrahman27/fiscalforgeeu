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

  select coalesce(auth_users.email, '')
  into current_user_email
  from auth.users auth_users
  where auth_users.id = current_user_id;

  insert into public.profiles (
    id,
    email,
    display_name
  )
  values (
    current_user_id,
    current_user_email,
    ''
  )
  on conflict (id) do update
  set
    email = excluded.email,
    updated_at = now();

  select
    memberships.role as selected_role,
    organizations.id as selected_organization_id,
    organizations.name as selected_organization_name,
    organizations.slug as selected_organization_slug
  into existing_membership
  from public.organization_memberships memberships
  join public.organizations organizations
    on organizations.id = memberships.organization_id
  where memberships.user_id = current_user_id
  order by memberships.created_at asc
  limit 1;

  if existing_membership.selected_organization_id is not null then
    return query
    select
      existing_membership.selected_organization_id::uuid,
      existing_membership.selected_organization_name::text,
      existing_membership.selected_organization_slug::text,
      existing_membership.selected_role::text,
      current_user_email::text;

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

  insert into public.organizations (
    name,
    slug,
    created_by
  )
  values (
    left(created_organization_name, 160),
    left(created_organization_slug, 80),
    current_user_id
  )
  on conflict (slug) do update
  set updated_at = now()
  returning
    public.organizations.id,
    public.organizations.name,
    public.organizations.slug
  into
    created_organization_id,
    created_organization_name,
    created_organization_slug;

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
  on conflict on constraint organization_memberships_organization_id_user_id_key
  do update
  set
    role = excluded.role,
    updated_at = now();

  return query
  select
    created_organization_id::uuid,
    created_organization_name::text,
    created_organization_slug::text,
    'owner'::text,
    current_user_email::text;
end;
$$;

revoke all on function public.bootstrap_personal_workspace() from public;
grant execute on function public.bootstrap_personal_workspace() to authenticated;
