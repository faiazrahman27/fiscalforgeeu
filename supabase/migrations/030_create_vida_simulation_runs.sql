create table if not exists public.vida_simulation_runs (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id) on delete cascade,

  created_by uuid
    references auth.users(id) on delete set null,

  api_key_id uuid
    references public.api_keys(id) on delete set null,

  invoice_draft_id uuid
    references public.invoice_drafts(id) on delete set null,

  validation_run_id uuid
    references public.validation_runs(id) on delete set null,

  source text not null default 'workspace'
    check (source in ('workspace', 'developer_api', 'system')),

  status text not null default 'completed'
    check (status in ('completed', 'failed')),

  simulation_version text not null
    check (char_length(trim(simulation_version)) between 1 and 80),

  seller_country_code text
    check (seller_country_code is null or seller_country_code ~ '^[A-Z]{2}$'),

  buyer_country_code text
    check (buyer_country_code is null or buyer_country_code ~ '^[A-Z]{2}$'),

  buyer_type text not null
    check (buyer_type in ('business', 'consumer', 'public_authority', 'unknown')),

  transaction_type text not null
    check (transaction_type in ('goods', 'services', 'digital_service', 'mixed', 'unknown')),

  transaction_class text not null
    check (
      transaction_class in (
        'intra_eu_b2b_goods',
        'intra_eu_b2b_service',
        'intra_eu_b2b_digital_service',
        'intra_eu_b2b_mixed',
        'intra_eu_b2b_unknown',
        'intra_eu_b2c',
        'intra_eu_public_authority',
        'domestic_eu_business',
        'domestic_eu_consumer',
        'domestic_eu_unknown',
        'non_eu_or_unsupported',
        'insufficient_data'
      )
    ),

  vida_relevance text not null
    check (vida_relevance in ('high', 'medium', 'low', 'not_relevant', 'review_required')),

  legal_confidence text not null
    check (legal_confidence in ('educational_simulation', 'professional_review_required')),

  invoice_date text
    check (invoice_date is null or char_length(invoice_date) <= 32),

  currency_code text
    check (currency_code is null or currency_code ~ '^[A-Z]{3}$'),

  amount_text text
    check (amount_text is null or char_length(amount_text) <= 80),

  country_pack_versions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(country_pack_versions) = 'object'),

  input_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(input_payload) = 'object'),

  normalized_input jsonb not null default '{}'::jsonb
    check (jsonb_typeof(normalized_input) = 'object'),

  country_context jsonb not null default '{}'::jsonb
    check (jsonb_typeof(country_context) = 'object'),

  result_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(result_payload) = 'object'),

  findings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(findings) = 'array'),

  source_labels jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_labels) = 'array'),

  recommended_next_actions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(recommended_next_actions) = 'array'),

  finding_count integer not null default 0
    check (finding_count >= 0),

  info_count integer not null default 0
    check (info_count >= 0),

  warning_count integer not null default 0
    check (warning_count >= 0),

  review_required_count integer not null default 0
    check (review_required_count >= 0),

  reason text not null default '',

  effective_date_context text not null
    check (char_length(trim(effective_date_context)) >= 1),

  disclaimer text not null
    check (char_length(trim(disclaimer)) >= 1),

  error_code text,

  error_message text,

  request_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(request_metadata) = 'object'),

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  check (finding_count = jsonb_array_length(findings)),

  check (info_count + warning_count + review_required_count <= finding_count)
);

create index if not exists vida_simulation_runs_organization_created_idx
on public.vida_simulation_runs (organization_id, created_at desc);

create index if not exists vida_simulation_runs_created_by_idx
on public.vida_simulation_runs (created_by);

create index if not exists vida_simulation_runs_api_key_id_idx
on public.vida_simulation_runs (api_key_id);

create index if not exists vida_simulation_runs_invoice_draft_id_idx
on public.vida_simulation_runs (invoice_draft_id);

create index if not exists vida_simulation_runs_validation_run_id_idx
on public.vida_simulation_runs (validation_run_id);

create index if not exists vida_simulation_runs_vida_relevance_idx
on public.vida_simulation_runs (vida_relevance);

create index if not exists vida_simulation_runs_transaction_class_idx
on public.vida_simulation_runs (transaction_class);

create index if not exists vida_simulation_runs_seller_country_idx
on public.vida_simulation_runs (seller_country_code);

create index if not exists vida_simulation_runs_buyer_country_idx
on public.vida_simulation_runs (buyer_country_code);

create index if not exists vida_simulation_runs_simulation_version_idx
on public.vida_simulation_runs (simulation_version);

create index if not exists vida_simulation_runs_result_payload_gin_idx
on public.vida_simulation_runs
using gin (result_payload);

create index if not exists vida_simulation_runs_findings_gin_idx
on public.vida_simulation_runs
using gin (findings);

drop trigger if exists set_vida_simulation_runs_updated_at
on public.vida_simulation_runs;

create trigger set_vida_simulation_runs_updated_at
before update on public.vida_simulation_runs
for each row
execute function public.set_updated_at();

alter table public.vida_simulation_runs enable row level security;

drop policy if exists "Workspace members can read ViDA simulation runs"
on public.vida_simulation_runs;

create policy "Workspace members can read ViDA simulation runs"
on public.vida_simulation_runs
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Workspace members can create ViDA simulation runs"
on public.vida_simulation_runs;

create policy "Workspace members can create ViDA simulation runs"
on public.vida_simulation_runs
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and (
    created_by is null
    or created_by = auth.uid()
  )
  and (
    invoice_draft_id is null
    or exists (
      select 1
      from public.invoice_drafts draft
      where draft.id = vida_simulation_runs.invoice_draft_id
        and draft.organization_id = vida_simulation_runs.organization_id
    )
  )
  and (
    validation_run_id is null
    or exists (
      select 1
      from public.validation_runs run
      where run.id = vida_simulation_runs.validation_run_id
        and run.organization_id = vida_simulation_runs.organization_id
    )
  )
);

comment on table public.vida_simulation_runs is
'Workspace-owned ViDA-readiness simulation audit records. These are educational technical simulation records only and do not represent official filing, authority submission, tax/legal/accounting advice, or compliance guarantees.';

comment on column public.vida_simulation_runs.input_payload is
'Original sanitized simulation request payload. Do not store full private documents or raw XML here.';

comment on column public.vida_simulation_runs.result_payload is
'Full sanitized ViDA-readiness simulation result snapshot. Legal-safe disclaimer must be preserved.';

comment on column public.vida_simulation_runs.findings is
'Sanitized finding array from the ViDA-readiness simulator.';

comment on column public.vida_simulation_runs.request_metadata is
'Safe request metadata only. Do not store request bodies, full API keys, key hashes, raw XML, or unnecessary personal data.';

grant select, insert
on table public.vida_simulation_runs
to authenticated;

grant select, insert, update, delete
on table public.vida_simulation_runs
to service_role;