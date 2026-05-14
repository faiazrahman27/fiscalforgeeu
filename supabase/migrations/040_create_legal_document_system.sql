-- Invoice Lantern
-- Migration 040: versioned legal document system and acceptance tracking.
--
-- This migration is additive. It creates public/versioned legal policy tables,
-- user/workspace acceptance records, and legal lifecycle events without editing
-- older migrations or claiming legal, tax, accounting, privacy, filing, or
-- official compliance status.

begin;

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_key text unique not null
    check (document_key ~ '^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$'),
  title text not null
    check (char_length(trim(title)) between 1 and 200),
  category text not null
    check (category in ('terms', 'privacy', 'security', 'developer', 'simulation', 'brand', 'operations')),
  audience text not null
    check (audience in ('public', 'workspace', 'developer', 'admin', 'processor', 'security')),
  status text not null
    check (status in ('draft', 'review', 'published', 'deprecated', 'archived', 'suspended')),
  is_required boolean not null default false,
  requires_acceptance boolean not null default false,
  legal_review_required boolean not null default true,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  legal_document_id uuid not null references public.legal_documents(id) on delete cascade,
  version text not null
    check (char_length(trim(version)) between 1 and 80),
  status text not null
    check (status in ('draft', 'review', 'published', 'deprecated', 'archived')),
  title text not null
    check (char_length(trim(title)) between 1 and 200),
  summary text
    check (summary is null or char_length(summary) <= 2000),
  body_md text not null
    check (char_length(trim(body_md)) >= 20),
  effective_from date,
  effective_to date,
  published_at timestamptz,
  reviewed_at date,
  reviewer_label text
    check (reviewer_label is null or char_length(reviewer_label) <= 200),
  source_refs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_refs) = 'array'),
  change_notes text
    check (change_notes is null or char_length(change_notes) <= 4000),
  legal_review_required boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (legal_document_id, version),
  check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

alter table public.legal_documents
drop constraint if exists legal_documents_current_version_fk;

alter table public.legal_documents
add constraint legal_documents_current_version_fk
foreign key (current_version_id)
references public.legal_document_versions(id)
on delete set null;

create table if not exists public.legal_document_acceptances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  legal_document_id uuid not null references public.legal_documents(id) on delete restrict,
  legal_document_version_id uuid not null references public.legal_document_versions(id) on delete restrict,
  accepted_at timestamptz not null default now(),
  acceptance_context text not null
    check (acceptance_context in ('workspace', 'developer', 'api_terms', 'webhook', 'privacy', 'public', 'country_pack')),
  ip_hash text
    check (ip_hash is null or ip_hash ~ '^[a-f0-9]{64}$'),
  user_agent_hash text
    check (user_agent_hash is null or user_agent_hash ~ '^[a-f0-9]{64}$'),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  unique (user_id, legal_document_version_id, acceptance_context)
);

create table if not exists public.legal_document_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  legal_document_id uuid references public.legal_documents(id) on delete cascade,
  legal_document_version_id uuid references public.legal_document_versions(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email_hash text
    check (actor_email_hash is null or actor_email_hash ~ '^[a-f0-9]{64}$'),
  event_type text not null
    check (event_type in ('document.created', 'document.updated', 'version.created', 'version.published', 'version.deprecated', 'version.archived', 'acceptance.recorded')),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists legal_documents_status_key_idx
on public.legal_documents (status, document_key);

create index if not exists legal_document_versions_doc_status_idx
on public.legal_document_versions (legal_document_id, status);

create index if not exists legal_document_acceptances_org_user_idx
on public.legal_document_acceptances (organization_id, user_id, accepted_at desc);

create index if not exists legal_document_acceptances_user_idx
on public.legal_document_acceptances (user_id, accepted_at desc);

create index if not exists legal_document_acceptances_version_idx
on public.legal_document_acceptances (legal_document_version_id, accepted_at desc);

create index if not exists legal_document_lifecycle_doc_idx
on public.legal_document_lifecycle_events (legal_document_id, created_at desc);

create or replace function public.set_legal_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_legal_document_versions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_legal_documents_updated_at
on public.legal_documents;

create trigger set_legal_documents_updated_at
before update on public.legal_documents
for each row
execute function public.set_legal_documents_updated_at();

drop trigger if exists set_legal_document_versions_updated_at
on public.legal_document_versions;

create trigger set_legal_document_versions_updated_at
before update on public.legal_document_versions
for each row
execute function public.set_legal_document_versions_updated_at();

alter table public.legal_documents enable row level security;
alter table public.legal_document_versions enable row level security;
alter table public.legal_document_acceptances enable row level security;
alter table public.legal_document_lifecycle_events enable row level security;

drop policy if exists "Published legal documents are public readable"
on public.legal_documents;

create policy "Published legal documents are public readable"
on public.legal_documents
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "Published legal document versions are public readable"
on public.legal_document_versions;

create policy "Published legal document versions are public readable"
on public.legal_document_versions
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "Users can read own legal acceptances"
on public.legal_document_acceptances;

create policy "Users can read own legal acceptances"
on public.legal_document_acceptances
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Workspace owners admins can read organization legal acceptances"
on public.legal_document_acceptances;

create policy "Workspace owners admins can read organization legal acceptances"
on public.legal_document_acceptances
for select
to authenticated
using (
  organization_id is not null
  and exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = legal_document_acceptances.organization_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin')
  )
);

drop policy if exists "Users can record own legal acceptances"
on public.legal_document_acceptances;

create policy "Users can record own legal acceptances"
on public.legal_document_acceptances
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    organization_id is null
    or exists (
      select 1
      from public.organization_memberships membership
      where membership.organization_id = legal_document_acceptances.organization_id
        and membership.user_id = auth.uid()
    )
  )
);

drop policy if exists "Workspace owners admins can read legal lifecycle events"
on public.legal_document_lifecycle_events;

create policy "Workspace owners admins can read legal lifecycle events"
on public.legal_document_lifecycle_events
for select
to authenticated
using (false);

grant select on public.legal_documents to anon, authenticated;
grant select on public.legal_document_versions to anon, authenticated;
grant select, insert on public.legal_document_acceptances to authenticated;
grant select on public.legal_document_lifecycle_events to authenticated;

grant select, insert, update, delete on public.legal_documents to service_role;
grant select, insert, update, delete on public.legal_document_versions to service_role;
grant select, insert, update, delete on public.legal_document_acceptances to service_role;
grant select, insert on public.legal_document_lifecycle_events to service_role;

with seed (
  document_key,
  title,
  category,
  audience,
  is_required,
  requires_acceptance,
  summary,
  body_md,
  change_notes
) as (
  values
  ('terms', 'Terms of Service', 'terms', 'public', true, true, 'Independent technical sandbox service terms requiring professional review.', $$Invoice Lantern is an independent, educational, technical e-invoice validation and ViDA-readiness sandbox. It is not official EU, European Commission, national tax authority, OpenPeppol, Peppol authority, or standards-body software. Results are informational only and are not legal, tax, accounting, filing, authority acceptance, or compliance advice. Account, workspace, API, and webhook use require responsible operation and professional review.$$,'Initial versioned policy draft.'),
  ('privacy', 'Privacy Policy', 'privacy', 'public', true, true, 'GDPR-aware privacy policy draft for account, workspace, invoice, API, XML, VIES, webhook, and audit data.', $$This Privacy Policy is a product policy draft. Controller and processor roles require review against the final operating entity and contracts. The platform may process account, workspace, invoice, XML, validation, API, VIES, webhook, legal acceptance, privacy request, export, retention, deletion, and audit metadata. Privacy tooling supports responsible handling but is not a GDPR compliance guarantee.$$,'Initial privacy policy draft.'),
  ('cookies', 'Cookie Policy', 'privacy', 'public', false, false, 'Essential-cookie and non-essential tracking stance.', $$Invoice Lantern is designed to use only essential authentication, security, session, preference, and workspace routing cookies or browser storage. No non-essential analytics, advertising, behavioral tracking, or third-party marketing cookies are introduced by this policy unless a future reviewed opt-in workflow is explicitly added.$$,'Initial cookie stance.'),
  ('dpa', 'Data Processing Addendum', 'privacy', 'processor', true, true, 'Processor/controller role draft for customer invoice data and platform operations.', $$This DPA is a draft requiring professional legal review. User organizations may act as controller and Invoice Lantern may act as processor for invoice/customer data where the final contract says so. Invoice Lantern may act as controller for account, security, abuse-prevention, and operational data where applicable. Export, deletion, retention, subprocessors, and incident cooperation require review.$$,'Initial DPA draft.'),
  ('acceptable-use', 'Acceptable Use Policy', 'terms', 'public', true, true, 'Use restrictions for unlawful use, impersonation, abuse, unsafe XML, and secrets.', $$Do not use Invoice Lantern for unlawful activity, official filing impersonation, authority impersonation, malware, unauthorized scraping, spam, abusive automation, unsafe XML payloads, rate-limit bypass, API key sharing, webhook abuse, or attempts to weaken tenant isolation. Do not upload illegal or malicious data.$$,'Initial acceptable-use policy draft.'),
  ('security', 'Security Policy', 'security', 'security', false, false, 'Security posture summary and contact placeholder.', $$Invoice Lantern is designed around tenant isolation, role-based access, API key hashing and scoping, safe rate limits, webhook signing, XML DTD and external entity protections, restricted service-role usage, and audit/activity logging. Service-role keys, database URLs, API signing secrets, webhook secrets, tokens, VIES credentials, and email provider keys must not be exposed.$$,'Initial security policy draft.'),
  ('disclaimer', 'Disclaimer And No Tax Advice Notice', 'terms', 'public', true, false, 'No-advice, non-official, no-certification, no-filing, professional-review boundary.', $$Invoice Lantern does not provide legal, tax, accounting, financial, professional, official filing, authority submission, Peppol certification, EN 16931 certification, ViDA compliance, VAT return submission, or authority acceptance services. All outputs are technical or educational and require professional review.$$,'Initial consolidated disclaimer.'),
  ('subprocessors', 'Subprocessor List', 'privacy', 'public', false, false, 'Structured provider list with configured, not configured, and review-required states.', $$The subprocessor list is a product-policy draft and must be reviewed against final deployment, contracts, data regions, and vendor configuration. Providers marked not configured or review required must not be treated as active subprocessors.$$,'Initial subprocessor list.'),
  ('retention', 'Data Retention Policy', 'privacy', 'workspace', false, false, 'Retention policy draft for workspace datasets and audit-preservation boundaries.', $$Workspace retention settings can define review windows for invoice drafts, validation reports, XML metadata, XML jobs, export metadata, API logs, webhook logs, VIES evidence, ViDA runs, activity logs, privacy requests, retention/deletion runs, and legal acceptance records. The tooling does not decide statutory accounting, tax, legal, or filing duties.$$,'Initial retention policy.'),
  ('incident-response', 'Incident Response Policy', 'security', 'security', false, false, 'Incident response lifecycle draft.', $$Incident response should detect, classify severity, contain, investigate, notify where legally required, fix, document evidence, and complete post-incident review. Security and audit records should be minimized but may need preservation for platform integrity and incident review.$$,'Initial incident response draft.'),
  ('vulnerability-disclosure', 'Vulnerability Disclosure Policy', 'security', 'security', false, false, 'Responsible disclosure boundaries and reporting placeholder.', $$Report suspected vulnerabilities with enough detail to reproduce safely. Testing must avoid unauthorized data access, persistence, destructive activity, social engineering, denial of service, credential harvesting, or bypassing consent. Safe-harbor wording is draft-only pending legal review.$$,'Initial vulnerability disclosure draft.'),
  ('trademark', 'Trademark And Brand Disclaimer', 'brand', 'public', false, false, 'Invoice Lantern identity and third-party mark/no-endorsement disclaimer.', $$The public product name is Invoice Lantern. Invoice Lantern is not affiliated with, endorsed by, certified by, or operated by EU institutions, the European Commission, national tax authorities, OpenPeppol, Peppol authorities, or standards bodies. Third-party marks belong to their owners.$$,'Initial brand disclaimer.'),
  ('api-terms', 'API Terms', 'developer', 'developer', true, true, 'Developer API terms for sandbox keys, scopes, rate limits, and no reliance.', $$The Invoice Lantern API is for sandbox technical validation, XML handling, VAT checks, ViDA simulations, rule reads, and developer testing. API keys must be protected and scoped. API responses are not legal, tax, accounting, filing, Peppol, EN 16931, ViDA, or authority determinations.$$,'Initial API terms.'),
  ('country-rule-pack-disclaimer', 'Country Rule Pack Disclaimer', 'simulation', 'workspace', false, true, 'Country-pack simulation boundary.', $$Country rule packs are source-linked educational simulations and technical readiness context. They are not official national tax guidance and do not provide national legal or tax advice. National rules may change, coverage may be incomplete, and warnings require professional review.$$,'Initial country-pack disclaimer.'),
  ('webhook-simulator-notice', 'Webhook Simulator Terms And Integration Notice', 'developer', 'developer', false, true, 'Webhook simulator signed test event and delivery-log boundary.', $$Webhook simulator events are signed sandbox test events for technical integration testing only. Delivery logs are technical integration logs and do not represent official filing, authority success, authority failure, downstream legal acceptance, or compliance evidence. Do not include secrets in payloads.$$,'Initial webhook notice.'),
  ('vida-simulator-notice', 'ViDA Simulator Notice', 'simulation', 'public', false, false, 'ViDA-readiness simulation boundary.', $$ViDA outputs are educational and technical readiness simulations. They are not official ViDA determinations, legal advice, tax advice, accounting advice, filing software, or compliance guarantees. Dates, countries, transaction classes, source labels, and evidence context require professional review.$$,'Initial ViDA notice.'),
  ('vies-evidence-notice', 'VIES Evidence Notice', 'simulation', 'public', false, false, 'VIES time-of-check evidence boundary.', $$VIES evidence is time-of-check evidence only. A format-valid VAT number is not VIES-valid. A VIES-valid response is not proof of transaction compliance, tax treatment, legal status, or accounting treatment. Raw VIES SOAP responses should not be stored.$$,'Initial VIES notice.'),
  ('xml-xsd-schematron-notice', 'XML, XSD, And Schematron Technical Validation Notice', 'simulation', 'public', false, false, 'Technical XML/XSD/Schematron validation boundary.', $$XML inspection, UBL parsing, local XSD validation, and guarded Schematron execution are technical checks only. They are not official certification, Peppol certification, EN 16931 certification, or authority acceptance. Findings must be sanitized and must not expose raw XML, file contents, full paths, or secrets.$$,'Initial XML/XSD/Schematron notice.')
),
upsert_docs as (
  insert into public.legal_documents (
    document_key,
    title,
    category,
    audience,
    status,
    is_required,
    requires_acceptance,
    legal_review_required
  )
  select
    seed.document_key,
    seed.title,
    seed.category,
    seed.audience,
    'published',
    seed.is_required,
    seed.requires_acceptance,
    true
  from seed
  on conflict (document_key) do update
  set
    title = excluded.title,
    category = excluded.category,
    audience = excluded.audience,
    status = excluded.status,
    is_required = excluded.is_required,
    requires_acceptance = excluded.requires_acceptance,
    legal_review_required = excluded.legal_review_required
  returning id, document_key
),
upsert_versions as (
  insert into public.legal_document_versions (
    legal_document_id,
    version,
    status,
    title,
    summary,
    body_md,
    effective_from,
    published_at,
    reviewer_label,
    source_refs,
    change_notes,
    legal_review_required
  )
  select
    upsert_docs.id,
    '2026.05.14',
    'published',
    seed.title,
    seed.summary,
    seed.body_md,
    date '2026-05-14',
    now(),
    'Professional legal review required',
    jsonb_build_array(jsonb_build_object('label', 'Invoice Lantern product boundaries', 'url', 'https://invoice-lantern.example/legal/boundaries')),
    seed.change_notes,
    true
  from upsert_docs
  join seed on seed.document_key = upsert_docs.document_key
  on conflict (legal_document_id, version) do update
  set
    status = excluded.status,
    title = excluded.title,
    summary = excluded.summary,
    body_md = excluded.body_md,
    effective_from = excluded.effective_from,
    published_at = coalesce(public.legal_document_versions.published_at, excluded.published_at),
    reviewer_label = excluded.reviewer_label,
    source_refs = excluded.source_refs,
    change_notes = excluded.change_notes,
    legal_review_required = excluded.legal_review_required
  returning id, legal_document_id
)
update public.legal_documents document
set current_version_id = version.id
from upsert_versions version
where document.id = version.legal_document_id;

insert into public.legal_document_lifecycle_events (
  legal_document_id,
  legal_document_version_id,
  event_type,
  metadata
)
select
  document.id,
  version.id,
  'version.published',
  jsonb_build_object(
    'version', version.version,
    'seededByMigration', '040_create_legal_document_system',
    'legalReviewRequired', true,
    'professionalReviewRequired', true,
    'safeWording', 'not legal tax accounting privacy filing or official compliance advice'
  )
from public.legal_documents document
join public.legal_document_versions version
  on version.id = document.current_version_id
where version.version = '2026.05.14'
on conflict do nothing;

commit;
