-- Webhook simulator endpoint and delivery storage.
--
-- These tables are tenant-owned by organization_id. They support signed
-- sandbox test deliveries only; they do not model official filing,
-- authority submission, or downstream acceptance.

create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  url text not null,
  status text not null default 'active',
  event_types text[] not null default '{}',
  description text,
  signing_secret_encrypted text,
  signing_secret_iv text,
  signing_secret_tag text,
  signing_secret_last4 text,
  signing_secret_key_id text,
  last_delivery_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failure_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz,
  constraint webhook_endpoints_name_length check (char_length(name) between 1 and 120),
  constraint webhook_endpoints_url_length check (char_length(url) between 12 and 2048),
  constraint webhook_endpoints_description_length check (description is null or char_length(description) <= 1000),
  constraint webhook_endpoints_status_check check (status in ('active', 'disabled', 'failing', 'suspended')),
  constraint webhook_endpoints_event_type_count check (cardinality(event_types) between 0 and 16),
  constraint webhook_endpoints_failure_count_nonnegative check (failure_count >= 0),
  constraint webhook_endpoints_secret_last4_length check (signing_secret_last4 is null or char_length(signing_secret_last4) = 4)
);

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  webhook_endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  event_type text not null,
  status text not null default 'pending',
  attempt_number integer not null default 1,
  max_attempts integer not null default 3,
  request_url text not null,
  request_method text not null default 'POST',
  request_headers_redacted jsonb not null default '{}'::jsonb,
  request_payload jsonb not null default '{}'::jsonb,
  payload_hash text not null,
  signature_header text,
  response_status integer,
  response_headers_redacted jsonb not null default '{}'::jsonb,
  response_body_preview text,
  response_time_ms integer,
  error_code text,
  error_message_safe text,
  next_retry_at timestamptz,
  delivered_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint webhook_deliveries_event_type_length check (char_length(event_type) between 1 and 120),
  constraint webhook_deliveries_status_check check (status in ('pending', 'delivered', 'failed', 'retry_scheduled', 'skipped', 'blocked')),
  constraint webhook_deliveries_attempt_positive check (attempt_number between 1 and 10),
  constraint webhook_deliveries_max_attempts_positive check (max_attempts between 1 and 10),
  constraint webhook_deliveries_attempt_within_max check (attempt_number <= max_attempts),
  constraint webhook_deliveries_request_method_check check (request_method = 'POST'),
  constraint webhook_deliveries_request_url_length check (char_length(request_url) between 12 and 2048),
  constraint webhook_deliveries_request_payload_object check (jsonb_typeof(request_payload) = 'object'),
  constraint webhook_deliveries_payload_hash_length check (char_length(payload_hash) between 32 and 128),
  constraint webhook_deliveries_response_preview_length check (response_body_preview is null or char_length(response_body_preview) <= 12000),
  constraint webhook_deliveries_response_time_nonnegative check (response_time_ms is null or response_time_ms >= 0)
);

create index if not exists webhook_endpoints_organization_id_idx
  on public.webhook_endpoints(organization_id);

create index if not exists webhook_endpoints_status_idx
  on public.webhook_endpoints(status);

create index if not exists webhook_endpoints_created_at_idx
  on public.webhook_endpoints(created_at desc);

create index if not exists webhook_deliveries_organization_id_idx
  on public.webhook_deliveries(organization_id);

create index if not exists webhook_deliveries_endpoint_id_idx
  on public.webhook_deliveries(webhook_endpoint_id);

create index if not exists webhook_deliveries_status_idx
  on public.webhook_deliveries(status);

create index if not exists webhook_deliveries_event_type_idx
  on public.webhook_deliveries(event_type);

create index if not exists webhook_deliveries_created_at_idx
  on public.webhook_deliveries(created_at desc);

create index if not exists webhook_deliveries_org_created_at_idx
  on public.webhook_deliveries(organization_id, created_at desc);

create index if not exists webhook_deliveries_next_retry_at_idx
  on public.webhook_deliveries(next_retry_at)
  where next_retry_at is not null;

drop trigger if exists set_webhook_endpoints_updated_at on public.webhook_endpoints;
create trigger set_webhook_endpoints_updated_at
  before update on public.webhook_endpoints
  for each row
  execute function public.set_updated_at();

alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;

drop policy if exists webhook_endpoints_select_policy on public.webhook_endpoints;
create policy webhook_endpoints_select_policy
  on public.webhook_endpoints
  for select
  to authenticated
  using (public.can_manage_api_keys(organization_id));

drop policy if exists webhook_endpoints_insert_policy on public.webhook_endpoints;
create policy webhook_endpoints_insert_policy
  on public.webhook_endpoints
  for insert
  to authenticated
  with check (public.can_manage_api_keys(organization_id));

drop policy if exists webhook_endpoints_update_policy on public.webhook_endpoints;
create policy webhook_endpoints_update_policy
  on public.webhook_endpoints
  for update
  to authenticated
  using (public.can_manage_api_keys(organization_id))
  with check (public.can_manage_api_keys(organization_id));

drop policy if exists webhook_endpoints_delete_policy on public.webhook_endpoints;
create policy webhook_endpoints_delete_policy
  on public.webhook_endpoints
  for delete
  to authenticated
  using (public.can_manage_api_keys(organization_id));

drop policy if exists webhook_deliveries_select_policy on public.webhook_deliveries;
create policy webhook_deliveries_select_policy
  on public.webhook_deliveries
  for select
  to authenticated
  using (public.can_manage_api_keys(organization_id));

drop policy if exists webhook_deliveries_insert_policy on public.webhook_deliveries;
create policy webhook_deliveries_insert_policy
  on public.webhook_deliveries
  for insert
  to authenticated
  with check (public.can_manage_api_keys(organization_id));

drop policy if exists webhook_deliveries_update_policy on public.webhook_deliveries;
create policy webhook_deliveries_update_policy
  on public.webhook_deliveries
  for update
  to authenticated
  using (public.can_manage_api_keys(organization_id))
  with check (public.can_manage_api_keys(organization_id));

grant select, insert, update, delete on public.webhook_endpoints to authenticated;
grant select, insert, update on public.webhook_deliveries to authenticated;
grant select, insert, update, delete on public.webhook_endpoints to service_role;
grant select, insert, update, delete on public.webhook_deliveries to service_role;

comment on table public.webhook_endpoints is
  'Invoice Lantern webhook simulator endpoints for signed sandbox test events. Not official filing, authority submission, or compliance evidence.';

comment on table public.webhook_deliveries is
  'Invoice Lantern webhook simulator delivery attempts with redacted request/response metadata and bounded retry information.';
