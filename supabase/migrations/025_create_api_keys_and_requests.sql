create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id) on delete cascade,

  name text not null
    check (char_length(trim(name)) between 1 and 120),

  key_prefix text not null
    check (key_prefix ~ '^il_(test|live)_[A-Za-z0-9_-]{6,40}$'),

  key_hash text not null
    check (key_hash ~ '^[a-f0-9]{64}$'),

  environment text not null default 'test'
    check (environment in ('test', 'live')),

  scopes text[] not null default '{}',

  status text not null default 'active'
    check (status in ('active', 'revoked', 'expired')),

  expires_at timestamptz,
  last_used_at timestamptz,
  last_used_ip inet,

  created_by uuid
    references auth.users(id) on delete set null,

  revoked_by uuid
    references auth.users(id) on delete set null,

  revoked_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, key_prefix)
);

create table if not exists public.api_requests (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid
    references public.organizations(id) on delete set null,

  api_key_id uuid
    references public.api_keys(id) on delete set null,

  request_method text not null
    check (char_length(trim(request_method)) between 1 and 16),

  request_path text not null
    check (char_length(trim(request_path)) between 1 and 2048),

  status_code integer
    check (status_code is null or status_code between 100 and 599),

  duration_ms integer
    check (duration_ms is null or duration_ms >= 0),

  ip_address inet,
  user_agent text,
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists api_keys_organization_id_idx
on public.api_keys (organization_id);

create index if not exists api_keys_key_prefix_idx
on public.api_keys (key_prefix);

create index if not exists api_keys_status_idx
on public.api_keys (status);

create index if not exists api_keys_created_at_desc_idx
on public.api_keys (created_at desc);

create index if not exists api_requests_organization_id_idx
on public.api_requests (organization_id);

create index if not exists api_requests_api_key_id_idx
on public.api_requests (api_key_id);

create index if not exists api_requests_created_at_desc_idx
on public.api_requests (created_at desc);

drop trigger if exists set_api_keys_updated_at on public.api_keys;
create trigger set_api_keys_updated_at
before update on public.api_keys
for each row
execute function public.set_updated_at();

alter table public.api_keys enable row level security;
alter table public.api_requests enable row level security;

drop policy if exists "Workspace admins can read API key metadata"
on public.api_keys;

create policy "Workspace admins can read API key metadata"
on public.api_keys
for select
to authenticated
using (public.is_org_admin_or_owner(organization_id));

drop policy if exists "Workspace admins can create API keys"
on public.api_keys;

create policy "Workspace admins can create API keys"
on public.api_keys
for insert
to authenticated
with check (
  public.is_org_admin_or_owner(organization_id)
  and (
    created_by is null
    or created_by = auth.uid()
  )
);

drop policy if exists "Workspace admins can update API keys"
on public.api_keys;

create policy "Workspace admins can update API keys"
on public.api_keys
for update
to authenticated
using (public.is_org_admin_or_owner(organization_id))
with check (public.is_org_admin_or_owner(organization_id));

drop policy if exists "Workspace admins can read API request logs"
on public.api_requests;

create policy "Workspace admins can read API request logs"
on public.api_requests
for select
to authenticated
using (
  organization_id is null
  or public.is_org_admin_or_owner(organization_id)
);

/*
 * Do not grant table-wide SELECT on api_keys because key_hash must not be
 * readable by normal authenticated clients. Column-level SELECT exposes
 * metadata only; server-side API verification uses the service role.
 */
grant select (
  id,
  organization_id,
  name,
  key_prefix,
  environment,
  scopes,
  status,
  expires_at,
  last_used_at,
  last_used_ip,
  created_by,
  revoked_by,
  revoked_at,
  created_at,
  updated_at
) on public.api_keys to authenticated;

grant insert (
  organization_id,
  name,
  key_prefix,
  key_hash,
  environment,
  scopes,
  status,
  expires_at,
  created_by
) on public.api_keys to authenticated;

grant update (
  name,
  status,
  expires_at,
  last_used_at,
  last_used_ip,
  revoked_by,
  revoked_at,
  updated_at
) on public.api_keys to authenticated;

grant select on public.api_requests to authenticated;
