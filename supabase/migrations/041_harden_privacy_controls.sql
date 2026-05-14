-- Invoice Lantern
-- Migration 041: GDPR-aware privacy controls, data minimization metadata,
-- retention/deletion counters, privacy request events, cookie preferences, and
-- privacy audit hooks.
--
-- This migration is additive and does not edit historical migrations. It
-- supports privacy operations without claiming GDPR compliance, legal advice,
-- tax advice, accounting advice, official filing, or authority acceptance.

begin;

alter table public.workspace_settings
  add column if not exists xml_validation_job_retention_days integer not null default 180
    check (xml_validation_job_retention_days >= 0 and xml_validation_job_retention_days <= 3650),
  add column if not exists invoice_export_retention_days integer not null default 365
    check (invoice_export_retention_days >= 0 and invoice_export_retention_days <= 3650),
  add column if not exists api_request_log_retention_days integer not null default 180
    check (api_request_log_retention_days >= 0 and api_request_log_retention_days <= 3650),
  add column if not exists webhook_delivery_log_retention_days integer not null default 180
    check (webhook_delivery_log_retention_days >= 0 and webhook_delivery_log_retention_days <= 3650),
  add column if not exists vies_evidence_retention_days integer not null default 365
    check (vies_evidence_retention_days >= 0 and vies_evidence_retention_days <= 3650),
  add column if not exists vida_simulation_retention_days integer not null default 365
    check (vida_simulation_retention_days >= 0 and vida_simulation_retention_days <= 3650),
  add column if not exists privacy_request_retention_days integer not null default 1095
    check (privacy_request_retention_days >= 0 and privacy_request_retention_days <= 3650),
  add column if not exists retention_run_retention_days integer not null default 1095
    check (retention_run_retention_days >= 0 and retention_run_retention_days <= 3650),
  add column if not exists deletion_run_retention_days integer not null default 1095
    check (deletion_run_retention_days >= 0 and deletion_run_retention_days <= 3650),
  add column if not exists legal_acceptance_retention_days integer not null default 2555
    check (legal_acceptance_retention_days >= 0 and legal_acceptance_retention_days <= 3650),
  add column if not exists store_uploaded_xml_after_validation boolean not null default false,
  add column if not exists retain_validation_reports boolean not null default true,
  add column if not exists retain_vies_evidence boolean not null default true,
  add column if not exists retain_webhook_payload_previews boolean not null default false,
  add column if not exists include_api_logs_in_exports boolean not null default true,
  add column if not exists include_webhook_logs_in_exports boolean not null default true,
  add column if not exists include_legal_acceptances_in_exports boolean not null default true,
  add column if not exists data_minimization_mode text not null default 'standard'
    check (data_minimization_mode in ('standard', 'reduced', 'strict')),
  add column if not exists privacy_contact_email text not null default ''
    check (privacy_contact_email = '' or char_length(privacy_contact_email) between 3 and 320),
  add column if not exists security_contact_email text not null default ''
    check (security_contact_email = '' or char_length(security_contact_email) between 3 and 320);

alter table public.workspace_privacy_requests
drop constraint if exists workspace_privacy_requests_request_type_check;

alter table public.workspace_privacy_requests
add constraint workspace_privacy_requests_request_type_check
check (
  request_type in (
    'data_export',
    'export',
    'deletion',
    'access',
    'correction',
    'objection',
    'restriction',
    'portability',
    'retention_review',
    'other'
  )
);

alter table public.workspace_privacy_requests
drop constraint if exists workspace_privacy_requests_status_check;

alter table public.workspace_privacy_requests
add constraint workspace_privacy_requests_status_check
check (
  status in (
    'submitted',
    'in_review',
    'awaiting_verification',
    'approved',
    'rejected',
    'fulfilled',
    'cancelled',
    'completed'
  )
);

create table if not exists public.privacy_request_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  privacy_request_id uuid references public.workspace_privacy_requests(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null
    check (char_length(trim(event_type)) between 1 and 120),
  status text not null
    check (
      status in (
        'submitted',
        'in_review',
        'awaiting_verification',
        'approved',
        'rejected',
        'fulfilled',
        'cancelled',
        'completed'
      )
    ),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists privacy_request_events_org_created_idx
on public.privacy_request_events (organization_id, created_at desc);

create index if not exists privacy_request_events_request_idx
on public.privacy_request_events (privacy_request_id, created_at desc);

create table if not exists public.workspace_cookie_preferences (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  essential_only boolean not null default true,
  non_essential_analytics_enabled boolean not null default false,
  non_essential_marketing_enabled boolean not null default false,
  preference_version text not null default '2026.05.14'
    check (char_length(trim(preference_version)) between 1 and 80),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (essential_only = true),
  check (non_essential_analytics_enabled = false),
  check (non_essential_marketing_enabled = false)
);

create table if not exists public.workspace_privacy_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null
    check (char_length(trim(event_type)) between 1 and 120),
  entity_type text not null
    check (char_length(trim(entity_type)) between 1 and 120),
  entity_id text not null default ''
    check (char_length(entity_id) <= 240),
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'error')),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists workspace_privacy_audit_events_org_created_idx
on public.workspace_privacy_audit_events (organization_id, created_at desc);

create table if not exists public.workspace_subprocessor_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_key text not null
    check (char_length(trim(provider_key)) between 1 and 120),
  provider_name text not null
    check (char_length(trim(provider_name)) between 1 and 200),
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz not null default now(),
  legal_document_version text not null default '2026.05.14',
  legal_review_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  unique (organization_id, provider_key, legal_document_version)
);

alter table public.workspace_retention_runs
  add column if not exists xml_validation_job_retention_days integer not null default 180 check (xml_validation_job_retention_days >= 0 and xml_validation_job_retention_days <= 3650),
  add column if not exists invoice_export_retention_days integer not null default 365 check (invoice_export_retention_days >= 0 and invoice_export_retention_days <= 3650),
  add column if not exists api_request_log_retention_days integer not null default 180 check (api_request_log_retention_days >= 0 and api_request_log_retention_days <= 3650),
  add column if not exists webhook_delivery_log_retention_days integer not null default 180 check (webhook_delivery_log_retention_days >= 0 and webhook_delivery_log_retention_days <= 3650),
  add column if not exists vies_evidence_retention_days integer not null default 365 check (vies_evidence_retention_days >= 0 and vies_evidence_retention_days <= 3650),
  add column if not exists vida_simulation_retention_days integer not null default 365 check (vida_simulation_retention_days >= 0 and vida_simulation_retention_days <= 3650),
  add column if not exists privacy_request_retention_days integer not null default 1095 check (privacy_request_retention_days >= 0 and privacy_request_retention_days <= 3650),
  add column if not exists retention_run_retention_days integer not null default 1095 check (retention_run_retention_days >= 0 and retention_run_retention_days <= 3650),
  add column if not exists deletion_run_retention_days integer not null default 1095 check (deletion_run_retention_days >= 0 and deletion_run_retention_days <= 3650),
  add column if not exists legal_acceptance_retention_days integer not null default 2555 check (legal_acceptance_retention_days >= 0 and legal_acceptance_retention_days <= 3650),
  add column if not exists xml_validation_job_cutoff_date timestamptz not null default now(),
  add column if not exists invoice_export_cutoff_date timestamptz not null default now(),
  add column if not exists api_request_log_cutoff_date timestamptz not null default now(),
  add column if not exists webhook_delivery_log_cutoff_date timestamptz not null default now(),
  add column if not exists vies_evidence_cutoff_date timestamptz not null default now(),
  add column if not exists vida_simulation_cutoff_date timestamptz not null default now(),
  add column if not exists privacy_request_cutoff_date timestamptz not null default now(),
  add column if not exists retention_run_cutoff_date timestamptz not null default now(),
  add column if not exists deletion_run_cutoff_date timestamptz not null default now(),
  add column if not exists legal_acceptance_cutoff_date timestamptz not null default now(),
  add column if not exists xml_validation_job_affected_count integer not null default 0 check (xml_validation_job_affected_count >= 0),
  add column if not exists invoice_export_affected_count integer not null default 0 check (invoice_export_affected_count >= 0),
  add column if not exists api_request_log_affected_count integer not null default 0 check (api_request_log_affected_count >= 0),
  add column if not exists webhook_delivery_log_affected_count integer not null default 0 check (webhook_delivery_log_affected_count >= 0),
  add column if not exists vies_evidence_affected_count integer not null default 0 check (vies_evidence_affected_count >= 0),
  add column if not exists vida_simulation_affected_count integer not null default 0 check (vida_simulation_affected_count >= 0),
  add column if not exists privacy_request_affected_count integer not null default 0 check (privacy_request_affected_count >= 0),
  add column if not exists retention_run_affected_count integer not null default 0 check (retention_run_affected_count >= 0),
  add column if not exists deletion_run_affected_count integer not null default 0 check (deletion_run_affected_count >= 0),
  add column if not exists legal_acceptance_affected_count integer not null default 0 check (legal_acceptance_affected_count >= 0),
  add column if not exists xml_validation_job_executed_count integer not null default 0 check (xml_validation_job_executed_count >= 0),
  add column if not exists invoice_export_executed_count integer not null default 0 check (invoice_export_executed_count >= 0),
  add column if not exists api_request_log_executed_count integer not null default 0 check (api_request_log_executed_count >= 0),
  add column if not exists webhook_delivery_log_executed_count integer not null default 0 check (webhook_delivery_log_executed_count >= 0),
  add column if not exists vies_evidence_executed_count integer not null default 0 check (vies_evidence_executed_count >= 0),
  add column if not exists vida_simulation_executed_count integer not null default 0 check (vida_simulation_executed_count >= 0),
  add column if not exists privacy_request_executed_count integer not null default 0 check (privacy_request_executed_count >= 0),
  add column if not exists retention_run_executed_count integer not null default 0 check (retention_run_executed_count >= 0),
  add column if not exists deletion_run_executed_count integer not null default 0 check (deletion_run_executed_count >= 0),
  add column if not exists legal_acceptance_executed_count integer not null default 0 check (legal_acceptance_executed_count >= 0);

alter table public.workspace_deletion_runs
  add column if not exists production_invoice_affected_count integer not null default 0 check (production_invoice_affected_count >= 0),
  add column if not exists business_profile_affected_count integer not null default 0 check (business_profile_affected_count >= 0),
  add column if not exists contact_affected_count integer not null default 0 check (contact_affected_count >= 0),
  add column if not exists invoice_export_affected_count integer not null default 0 check (invoice_export_affected_count >= 0),
  add column if not exists vat_number_check_affected_count integer not null default 0 check (vat_number_check_affected_count >= 0),
  add column if not exists xml_validation_job_affected_count integer not null default 0 check (xml_validation_job_affected_count >= 0),
  add column if not exists api_key_affected_count integer not null default 0 check (api_key_affected_count >= 0),
  add column if not exists api_request_log_affected_count integer not null default 0 check (api_request_log_affected_count >= 0),
  add column if not exists webhook_endpoint_affected_count integer not null default 0 check (webhook_endpoint_affected_count >= 0),
  add column if not exists webhook_delivery_affected_count integer not null default 0 check (webhook_delivery_affected_count >= 0),
  add column if not exists vies_evidence_affected_count integer not null default 0 check (vies_evidence_affected_count >= 0),
  add column if not exists vida_simulation_affected_count integer not null default 0 check (vida_simulation_affected_count >= 0),
  add column if not exists legal_acceptance_affected_count integer not null default 0 check (legal_acceptance_affected_count >= 0),
  add column if not exists privacy_request_event_affected_count integer not null default 0 check (privacy_request_event_affected_count >= 0),
  add column if not exists privacy_audit_event_affected_count integer not null default 0 check (privacy_audit_event_affected_count >= 0),
  add column if not exists production_invoice_executed_count integer not null default 0 check (production_invoice_executed_count >= 0),
  add column if not exists business_profile_executed_count integer not null default 0 check (business_profile_executed_count >= 0),
  add column if not exists contact_executed_count integer not null default 0 check (contact_executed_count >= 0),
  add column if not exists invoice_export_executed_count integer not null default 0 check (invoice_export_executed_count >= 0),
  add column if not exists vat_number_check_executed_count integer not null default 0 check (vat_number_check_executed_count >= 0),
  add column if not exists xml_validation_job_executed_count integer not null default 0 check (xml_validation_job_executed_count >= 0),
  add column if not exists api_key_executed_count integer not null default 0 check (api_key_executed_count >= 0),
  add column if not exists api_request_log_executed_count integer not null default 0 check (api_request_log_executed_count >= 0),
  add column if not exists webhook_endpoint_executed_count integer not null default 0 check (webhook_endpoint_executed_count >= 0),
  add column if not exists webhook_delivery_executed_count integer not null default 0 check (webhook_delivery_executed_count >= 0),
  add column if not exists vies_evidence_executed_count integer not null default 0 check (vies_evidence_executed_count >= 0),
  add column if not exists vida_simulation_executed_count integer not null default 0 check (vida_simulation_executed_count >= 0),
  add column if not exists legal_acceptance_executed_count integer not null default 0 check (legal_acceptance_executed_count >= 0),
  add column if not exists privacy_request_event_executed_count integer not null default 0 check (privacy_request_event_executed_count >= 0),
  add column if not exists privacy_audit_event_executed_count integer not null default 0 check (privacy_audit_event_executed_count >= 0);

alter table public.privacy_request_events enable row level security;
alter table public.workspace_cookie_preferences enable row level security;
alter table public.workspace_privacy_audit_events enable row level security;
alter table public.workspace_subprocessor_acknowledgements enable row level security;

drop policy if exists "Workspace managers can read privacy request events"
on public.privacy_request_events;

create policy "Workspace managers can read privacy request events"
on public.privacy_request_events
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = privacy_request_events.organization_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin')
  )
);

drop policy if exists "Workspace managers can create privacy request events"
on public.privacy_request_events;

create policy "Workspace managers can create privacy request events"
on public.privacy_request_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = privacy_request_events.organization_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin')
  )
);

drop policy if exists "Workspace managers can read cookie preferences"
on public.workspace_cookie_preferences;

create policy "Workspace managers can read cookie preferences"
on public.workspace_cookie_preferences
for select
to authenticated
using (public.can_manage_org(organization_id));

drop policy if exists "Workspace managers can write cookie preferences"
on public.workspace_cookie_preferences;

create policy "Workspace managers can write cookie preferences"
on public.workspace_cookie_preferences
for insert
to authenticated
with check (public.can_manage_org(organization_id));

drop policy if exists "Workspace managers can update cookie preferences"
on public.workspace_cookie_preferences;

create policy "Workspace managers can update cookie preferences"
on public.workspace_cookie_preferences
for update
to authenticated
using (public.can_manage_org(organization_id))
with check (public.can_manage_org(organization_id));

drop policy if exists "Workspace managers can read privacy audit events"
on public.workspace_privacy_audit_events;

create policy "Workspace managers can read privacy audit events"
on public.workspace_privacy_audit_events
for select
to authenticated
using (public.can_manage_org(organization_id));

drop policy if exists "Workspace managers can read subprocessor acknowledgements"
on public.workspace_subprocessor_acknowledgements;

create policy "Workspace managers can read subprocessor acknowledgements"
on public.workspace_subprocessor_acknowledgements
for select
to authenticated
using (public.can_manage_org(organization_id));

drop policy if exists "Workspace managers can write subprocessor acknowledgements"
on public.workspace_subprocessor_acknowledgements;

create policy "Workspace managers can write subprocessor acknowledgements"
on public.workspace_subprocessor_acknowledgements
for insert
to authenticated
with check (public.can_manage_org(organization_id));

grant select, insert on public.privacy_request_events to authenticated;
grant select, insert, update on public.workspace_cookie_preferences to authenticated;
grant select on public.workspace_privacy_audit_events to authenticated;
grant select, insert on public.workspace_subprocessor_acknowledgements to authenticated;

grant select, insert, update, delete on public.privacy_request_events to service_role;
grant select, insert, update, delete on public.workspace_cookie_preferences to service_role;
grant select, insert, update, delete on public.workspace_privacy_audit_events to service_role;
grant select, insert, update, delete on public.workspace_subprocessor_acknowledgements to service_role;

comment on table public.privacy_request_events is
'Immutable privacy request lifecycle events. Metadata must remain minimized and must not contain legal advice, raw secrets, raw XML, or raw SOAP.';

comment on table public.workspace_cookie_preferences is
'Workspace cookie/tracking preference state. Current policy constrains preferences to essential-only storage.';

comment on table public.workspace_privacy_audit_events is
'Privacy workflow audit events with minimized metadata for export, deletion, retention, data-map, and legal acceptance operations.';

comment on table public.workspace_subprocessor_acknowledgements is
'Workspace acknowledgement metadata for review-required subprocessors. This does not make a provider legally approved.';

commit;
