-- Invoice Lantern
-- Migration 037: validation rule engine vocabulary and VIES evidence records.
--
-- Additive only. This migration does not rewrite prior validation runs or VAT
-- format checks. VIES evidence remains explicit, time-of-check, and separated
-- from local VAT format validation.

begin;

alter table public.validation_rules
drop constraint if exists validation_rules_category_check;

alter table public.validation_rules
add constraint validation_rules_category_check
check (
  category in (
    'SCHEMA',
    'CANONICAL',
    'CALCULATION',
    'VAT_ID',
    'VIES',
    'UBL',
    'CII',
    'EN16931',
    'PEPPOL',
    'COUNTRY_PACK',
    'VIDA_SIMULATION',
    'SECURITY',
    'LEGAL_LABEL'
  )
);

alter table public.api_keys
drop constraint if exists api_keys_scopes_supported_chk;

alter table public.api_keys
add constraint api_keys_scopes_supported_chk
check (
  cardinality(scopes) between 1 and 32
  and scopes <@ array[
    'invoices:validate',
    'invoices:export_ubl',
    'invoices:parse_ubl',
    'invoices:import_ubl',
    'xml:validation_jobs',
    'vat:validate_format',
    'vat:check_vies',
    'transactions:simulate_vida',
    'validation_runs:read',
    'rules:read'
  ]::text[]
);

create table if not exists public.vies_evidence_checks (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id) on delete cascade,

  invoice_draft_id uuid
    references public.invoice_drafts(id) on delete set null,

  validation_run_id uuid
    references public.validation_runs(id) on delete set null,

  party_role text
    check (party_role is null or party_role in ('seller', 'buyer', 'other')),

  country_code char(2) not null
    check (country_code ~ '^[A-Z]{2}$'),

  vat_number_normalized text not null
    check (char_length(trim(vat_number_normalized)) between 1 and 80),

  vat_number_display text not null
    check (char_length(trim(vat_number_display)) between 1 and 80),

  vat_number_fingerprint text not null
    check (vat_number_fingerprint ~ '^[a-f0-9]{64}$'),

  request_source text not null
    check (request_source in ('local_format', 'vies')),

  status text not null
    check (
      status in (
        'valid',
        'invalid',
        'unavailable',
        'error',
        'not_checked',
        'unsupported',
        'rate_limited'
      )
    ),

  vies_valid boolean,
  vies_name text check (vies_name is null or char_length(vies_name) <= 500),
  vies_address text check (vies_address is null or char_length(vies_address) <= 2000),
  request_identifier text check (request_identifier is null or char_length(request_identifier) <= 240),

  checked_at timestamptz not null default now(),
  source_label text not null check (char_length(trim(source_label)) between 1 and 200),
  source_url text not null check (char_length(trim(source_url)) between 1 and 500),
  response_time_ms integer check (response_time_ms is null or response_time_ms >= 0),
  error_code text check (error_code is null or char_length(trim(error_code)) between 1 and 120),
  error_message_safe text check (error_message_safe is null or char_length(trim(error_message_safe)) between 1 and 500),
  raw_response_hash text check (raw_response_hash is null or raw_response_hash ~ '^[a-f0-9]{64}$'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists vies_evidence_checks_organization_id_idx
on public.vies_evidence_checks (organization_id);

create index if not exists vies_evidence_checks_validation_run_id_idx
on public.vies_evidence_checks (validation_run_id);

create index if not exists vies_evidence_checks_invoice_draft_id_idx
on public.vies_evidence_checks (invoice_draft_id);

create index if not exists vies_evidence_checks_org_checked_at_desc_idx
on public.vies_evidence_checks (organization_id, checked_at desc);

create index if not exists vies_evidence_checks_vat_fingerprint_idx
on public.vies_evidence_checks (organization_id, vat_number_fingerprint, checked_at desc);

create index if not exists vies_evidence_checks_status_idx
on public.vies_evidence_checks (status);

alter table public.vies_evidence_checks enable row level security;

drop policy if exists "Workspace members can read VIES evidence checks"
on public.vies_evidence_checks;

create policy "Workspace members can read VIES evidence checks"
on public.vies_evidence_checks
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Workspace members can create VIES evidence checks"
on public.vies_evidence_checks;

create policy "Workspace members can create VIES evidence checks"
on public.vies_evidence_checks
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_org_member(organization_id)
  and (
    invoice_draft_id is null
    or exists (
      select 1
      from public.invoice_drafts draft
      where draft.id = vies_evidence_checks.invoice_draft_id
        and draft.organization_id = vies_evidence_checks.organization_id
    )
  )
  and (
    validation_run_id is null
    or exists (
      select 1
      from public.validation_runs run
      where run.id = vies_evidence_checks.validation_run_id
        and run.organization_id = vies_evidence_checks.organization_id
    )
  )
);

drop policy if exists "Workspace admins can delete VIES evidence checks"
on public.vies_evidence_checks;

create policy "Workspace admins can delete VIES evidence checks"
on public.vies_evidence_checks
for delete
to authenticated
using (public.is_org_admin_or_owner(organization_id));

grant select, insert, delete on public.vies_evidence_checks to authenticated;

with engine_rule_set as (
  insert into public.validation_rule_sets (
    code,
    name,
    description,
    version,
    status,
    legal_confidence
  )
  values (
    'INVOICE_LANTERN_VALIDATION_ENGINE',
    'Invoice Lantern Validation Engine Mapping Rules',
    'Internal source-linked finding enrichment rules. These are technical sandbox mappings and are not official validation, legal, tax, accounting, or authority conclusions.',
    '2026.05.1',
    'published',
    'technical'
  )
  on conflict (code) do update
  set
    name = excluded.name,
    description = excluded.description,
    version = excluded.version,
    status = excluded.status,
    legal_confidence = excluded.legal_confidence,
    updated_at = now()
  returning id
),
engine_rules_seed (
  code,
  title,
  description,
  category,
  severity,
  field_path,
  message_template,
  fix_suggestion,
  legal_confidence,
  version,
  status
) as (
  values
    (
      'XML_XSD_FINDING_MAPPED',
      'UBL XSD finding mapped',
      'Maps local UBL XSD diagnostics into the unified validation finding contract.',
      'SCHEMA',
      'fatal',
      'xml',
      '{xsdMessage}',
      null,
      'technical',
      '2026.05.1',
      'published'
    ),
    (
      'SCHEMATRON_FINDING_MAPPED',
      'Schematron finding mapped',
      'Maps guarded local Schematron failed assertions into EN 16931-style and Peppol-style technical sandbox findings.',
      'EN16931',
      'warning',
      'xml',
      '{schematronMessage}',
      null,
      'educational_simulation',
      '2026.05.1',
      'published'
    )
),
engine_upserted_rules as (
  insert into public.validation_rules (
    rule_set_id,
    code,
    title,
    description,
    category,
    severity,
    field_path,
    message_template,
    fix_suggestion,
    legal_confidence,
    version,
    status
  )
  select
    engine_rule_set.id,
    engine_rules_seed.code,
    engine_rules_seed.title,
    engine_rules_seed.description,
    engine_rules_seed.category,
    engine_rules_seed.severity,
    engine_rules_seed.field_path,
    engine_rules_seed.message_template,
    engine_rules_seed.fix_suggestion,
    engine_rules_seed.legal_confidence,
    engine_rules_seed.version,
    engine_rules_seed.status
  from engine_rule_set
  cross join engine_rules_seed
  on conflict (rule_set_id, code, version) do update
  set
    title = excluded.title,
    description = excluded.description,
    category = excluded.category,
    severity = excluded.severity,
    field_path = excluded.field_path,
    message_template = excluded.message_template,
    fix_suggestion = excluded.fix_suggestion,
    legal_confidence = excluded.legal_confidence,
    status = excluded.status,
    updated_at = now()
  returning id
)
insert into public.validation_rule_sources (
  rule_id,
  source_name,
  jurisdiction,
  source_type,
  notes
)
select
  engine_upserted_rules.id,
  'Invoice Lantern validation engine mapping policy',
  'platform',
  'internal_technical_policy',
  'Internal technical enrichment metadata. No legal, tax, accounting, official EU, Peppol, EN 16931, ViDA, government, or authority conclusion is created by this mapping.'
from engine_upserted_rules
where not exists (
  select 1
  from public.validation_rule_sources existing_source
  where existing_source.rule_id = engine_upserted_rules.id
    and existing_source.source_name = 'Invoice Lantern validation engine mapping policy'
);

with vies_rule_set as (
  insert into public.validation_rule_sets (
    code,
    name,
    description,
    version,
    status,
    legal_confidence
  )
  values (
    'INVOICE_LANTERN_VIES_EVIDENCE',
    'Invoice Lantern VIES Evidence Rules',
    'Optional VIES time-of-check evidence findings. VAT format validity and VIES evidence remain separate.',
    '2026.05.1',
    'published',
    'official_source_derived'
  )
  on conflict (code) do update
  set
    name = excluded.name,
    description = excluded.description,
    version = excluded.version,
    status = excluded.status,
    legal_confidence = excluded.legal_confidence,
    updated_at = now()
  returning id
),
vies_rules_seed (
  code,
  title,
  description,
  category,
  severity,
  field_path,
  message_template,
  fix_suggestion,
  legal_confidence,
  version,
  status
) as (
  values
    (
      'VIES_EVIDENCE_VALID_AT_CHECK_TIME',
      'VIES valid at check time',
      'VIES returned time-of-check evidence that the VAT number was valid. This is not a full transaction treatment conclusion.',
      'VIES',
      'info',
      'parties.vatId',
      '{viesEvidenceMessage}',
      null,
      'official_source_derived',
      '2026.05.1',
      'published'
    ),
    (
      'VIES_EVIDENCE_INVALID_AT_CHECK_TIME',
      'VIES invalid at check time',
      'VIES returned time-of-check evidence that the VAT number was invalid. Professional review may still be required.',
      'VIES',
      'warning',
      'parties.vatId',
      '{viesEvidenceMessage}',
      'Check the VAT number and country code, then retry later or review with a qualified professional.',
      'official_source_derived',
      '2026.05.1',
      'published'
    ),
    (
      'VIES_EVIDENCE_UNAVAILABLE',
      'VIES unavailable',
      'The VIES evidence check could not retrieve evidence safely. Unavailable does not mean invalid.',
      'VIES',
      'warning',
      'parties.vatId',
      '{viesEvidenceMessage}',
      null,
      'technical',
      '2026.05.1',
      'published'
    ),
    (
      'VIES_EVIDENCE_RATE_LIMITED',
      'VIES rate limited',
      'The VIES evidence check was not sent because an Invoice Lantern rate limit was reached.',
      'VIES',
      'warning',
      'parties.vatId',
      '{viesEvidenceMessage}',
      null,
      'technical',
      '2026.05.1',
      'published'
    )
),
vies_upserted_rules as (
  insert into public.validation_rules (
    rule_set_id,
    code,
    title,
    description,
    category,
    severity,
    field_path,
    message_template,
    fix_suggestion,
    legal_confidence,
    version,
    status
  )
  select
    vies_rule_set.id,
    vies_rules_seed.code,
    vies_rules_seed.title,
    vies_rules_seed.description,
    vies_rules_seed.category,
    vies_rules_seed.severity,
    vies_rules_seed.field_path,
    vies_rules_seed.message_template,
    vies_rules_seed.fix_suggestion,
    vies_rules_seed.legal_confidence,
    vies_rules_seed.version,
    vies_rules_seed.status
  from vies_rule_set
  cross join vies_rules_seed
  on conflict (rule_set_id, code, version) do update
  set
    title = excluded.title,
    description = excluded.description,
    category = excluded.category,
    severity = excluded.severity,
    field_path = excluded.field_path,
    message_template = excluded.message_template,
    fix_suggestion = excluded.fix_suggestion,
    legal_confidence = excluded.legal_confidence,
    status = excluded.status,
    updated_at = now()
  returning id
)
insert into public.validation_rule_sources (
  rule_id,
  source_name,
  source_url,
  jurisdiction,
  source_type,
  notes
)
select
  vies_upserted_rules.id,
  'VAT Information Exchange System (VIES)',
  'https://ec.europa.eu/taxation_customs/vies/',
  'EU',
  'official_eu_source',
  'VIES time-of-check evidence source. Availability depends on EU and national VAT database systems; evidence is not legal, tax, accounting, filing, or full transaction treatment advice.'
from vies_upserted_rules
where not exists (
  select 1
  from public.validation_rule_sources existing_source
  where existing_source.rule_id = vies_upserted_rules.id
    and existing_source.source_name = 'VAT Information Exchange System (VIES)'
);

commit;
