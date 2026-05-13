-- Invoice Lantern
-- Migration 035: workspace member invitations and owner/admin membership management.
--
-- This migration is additive. It creates a token-hash-only invitation table,
-- preserves existing organization_memberships rows, and adds a database
-- backstop that prevents removing the last workspace owner.

begin;

create table if not exists public.workspace_member_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null
    check (
      email = lower(trim(email))
      and char_length(email) between 3 and 320
      and position('@' in email) > 1
    ),
  role text not null
    check (
      role in (
        'owner',
        'admin',
        'accountant',
        'developer',
        'reviewer',
        'viewer'
      )
    ),
  token_hash text not null unique
    check (token_hash ~ '^[a-f0-9]{64}$'),
  token_prefix text not null
    check (char_length(trim(token_prefix)) between 8 and 64),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_member_invitations_status_timestamps_chk
    check (
      (status <> 'accepted' or accepted_at is not null)
      and (status <> 'revoked' or revoked_at is not null)
    )
);

create index if not exists workspace_member_invitations_organization_id_idx
on public.workspace_member_invitations (organization_id);

create index if not exists workspace_member_invitations_lower_email_idx
on public.workspace_member_invitations (lower(email));

create index if not exists workspace_member_invitations_org_email_status_idx
on public.workspace_member_invitations (organization_id, lower(email), status);

create unique index if not exists workspace_member_invitations_one_pending_email_idx
on public.workspace_member_invitations (organization_id, lower(email))
where status = 'pending';

create index if not exists workspace_member_invitations_status_idx
on public.workspace_member_invitations (status);

create index if not exists workspace_member_invitations_expires_at_idx
on public.workspace_member_invitations (expires_at);

create index if not exists workspace_member_invitations_invited_by_idx
on public.workspace_member_invitations (invited_by);

create index if not exists workspace_member_invitations_accepted_by_idx
on public.workspace_member_invitations (accepted_by);

drop trigger if exists set_workspace_member_invitations_updated_at
on public.workspace_member_invitations;

create trigger set_workspace_member_invitations_updated_at
before update on public.workspace_member_invitations
for each row
execute function public.set_updated_at();

create or replace function public.prevent_last_workspace_owner_loss()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_owner_count integer;
begin
  if tg_op = 'UPDATE' then
    if old.organization_id <> new.organization_id then
      raise exception 'Organization membership cannot be moved between organizations.';
    end if;

    if old.user_id <> new.user_id then
      raise exception 'Organization membership cannot be moved between users.';
    end if;
  end if;

  if tg_op = 'DELETE' and old.role = 'owner' then
    select count(*)
    into remaining_owner_count
    from public.organization_memberships membership
    where membership.organization_id = old.organization_id
      and membership.role = 'owner'
      and membership.id <> old.id;

    if remaining_owner_count = 0 then
      raise exception 'Cannot remove the last owner from an organization.';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner' then
    select count(*)
    into remaining_owner_count
    from public.organization_memberships membership
    where membership.organization_id = old.organization_id
      and membership.role = 'owner'
      and membership.id <> old.id;

    if remaining_owner_count = 0 then
      raise exception 'Cannot remove the last owner from an organization.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_last_workspace_owner_loss
on public.organization_memberships;

create trigger prevent_last_workspace_owner_loss
before update or delete on public.organization_memberships
for each row
execute function public.prevent_last_workspace_owner_loss();

alter table public.workspace_member_invitations enable row level security;

drop policy if exists "Workspace managers can read member invitations"
on public.workspace_member_invitations;

create policy "Workspace managers can read member invitations"
on public.workspace_member_invitations
for select
to authenticated
using (public.can_manage_org(organization_id));

drop policy if exists "Invitees can read their own pending invitations"
on public.workspace_member_invitations;

create policy "Invitees can read their own pending invitations"
on public.workspace_member_invitations
for select
to authenticated
using (
  status = 'pending'
  and expires_at > now()
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "Workspace managers can create member invitations"
on public.workspace_member_invitations;

create policy "Workspace managers can create member invitations"
on public.workspace_member_invitations
for insert
to authenticated
with check (
  public.can_invite_members(organization_id)
  and (invited_by is null or invited_by = auth.uid())
  and status = 'pending'
  and accepted_by is null
  and revoked_by is null
  and accepted_at is null
  and revoked_at is null
);

drop policy if exists "Workspace managers can update member invitations"
on public.workspace_member_invitations;

create policy "Workspace managers can update member invitations"
on public.workspace_member_invitations
for update
to authenticated
using (public.can_invite_members(organization_id))
with check (public.can_invite_members(organization_id));

drop policy if exists "Invitees can accept their own pending invitations"
on public.workspace_member_invitations;

create policy "Invitees can accept their own pending invitations"
on public.workspace_member_invitations
for update
to authenticated
using (
  status = 'pending'
  and expires_at > now()
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
with check (
  status = 'accepted'
  and accepted_by = auth.uid()
  and accepted_at is not null
  and revoked_by is null
  and revoked_at is null
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "memberships_insert_owner_or_bootstrap"
on public.organization_memberships;

create policy "memberships_insert_owner_or_bootstrap"
on public.organization_memberships
for insert
to authenticated
with check (
  public.can_manage_org(organization_id)
  or (
    public.organization_has_no_members(organization_id)
    and user_id = auth.uid()
    and role = 'owner'
  )
);

drop policy if exists "memberships_update_owners"
on public.organization_memberships;

create policy "memberships_update_owners"
on public.organization_memberships
for update
to authenticated
using (public.can_manage_org(organization_id))
with check (public.can_manage_org(organization_id));

drop policy if exists "memberships_delete_owners"
on public.organization_memberships;

create policy "memberships_delete_owners"
on public.organization_memberships
for delete
to authenticated
using (public.can_manage_org(organization_id));

grant select (
  id,
  organization_id,
  email,
  role,
  token_prefix,
  status,
  invited_by,
  accepted_by,
  revoked_by,
  expires_at,
  accepted_at,
  revoked_at,
  metadata,
  created_at,
  updated_at
) on public.workspace_member_invitations to authenticated;

grant insert (
  organization_id,
  email,
  role,
  token_hash,
  token_prefix,
  status,
  invited_by,
  expires_at
) on public.workspace_member_invitations to authenticated;

grant update (
  status,
  accepted_by,
  revoked_by,
  accepted_at,
  revoked_at
) on public.workspace_member_invitations to authenticated;

grant select, insert, update, delete
on table public.workspace_member_invitations
to service_role;

grant execute on function public.prevent_last_workspace_owner_loss() to authenticated;

comment on table public.workspace_member_invitations is
'Workspace-scoped member invitations. Raw invite tokens are never stored; only SHA-256 token hashes and short prefixes are persisted.';

commit;
