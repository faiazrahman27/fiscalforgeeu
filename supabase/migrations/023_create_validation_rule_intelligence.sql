create table if not exists public.validation_rule_sets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  version text not null,
  status text not null
    check (status in ('draft', 'published', 'deprecated', 'suspended')),
  legal_confidence text not null
    check (
      legal_confidence in (
        'technical',
        'standard_based',
        'official_source_derived',
        'educational_simulation',
        'professional_review_required'
      )
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.validation_rules (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.validation_rule_sets(id) on delete cascade,
  code text not null,
  title text not null,
  description text not null,
  category text not null
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
        'LEGAL_LABEL'
      )
    ),
  severity text not null
    check (severity in ('info', 'warning', 'fatal', 'blocked')),
  field_path text,
  message_template text not null,
  fix_suggestion text,
  legal_confidence text not null
    check (
      legal_confidence in (
        'technical',
        'standard_based',
        'official_source_derived',
        'educational_simulation',
        'professional_review_required'
      )
    ),
  version text not null,
  status text not null
    check (status in ('draft', 'published', 'deprecated', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rule_set_id, code, version)
);

create table if not exists public.validation_rule_sources (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.validation_rules(id) on delete cascade,
  source_name text not null,
  source_url text,
  jurisdiction text,
  source_type text not null
    check (
      source_type in (
        'internal_technical_policy',
        'standard_documentation',
        'official_eu_source',
        'official_national_source',
        'public_reference',
        'professional_review'
      )
    ),
  reviewed_at date,
  effective_from date,
  effective_until date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists validation_rule_sets_code_idx
  on public.validation_rule_sets(code);

create index if not exists validation_rules_code_idx
  on public.validation_rules(code);

create index if not exists validation_rules_category_idx
  on public.validation_rules(category);

create index if not exists validation_rules_status_idx
  on public.validation_rules(status);

create index if not exists validation_rule_sources_rule_id_idx
  on public.validation_rule_sources(rule_id);

drop trigger if exists set_validation_rule_sets_updated_at
  on public.validation_rule_sets;
create trigger set_validation_rule_sets_updated_at
before update on public.validation_rule_sets
for each row
execute function public.set_updated_at();

drop trigger if exists set_validation_rules_updated_at
  on public.validation_rules;
create trigger set_validation_rules_updated_at
before update on public.validation_rules
for each row
execute function public.set_updated_at();

drop trigger if exists set_validation_rule_sources_updated_at
  on public.validation_rule_sources;
create trigger set_validation_rule_sources_updated_at
before update on public.validation_rule_sources
for each row
execute function public.set_updated_at();

alter table public.validation_rule_sets enable row level security;
alter table public.validation_rules enable row level security;
alter table public.validation_rule_sources enable row level security;

drop policy if exists "Authenticated users can read published validation rule sets"
  on public.validation_rule_sets;

create policy "Authenticated users can read published validation rule sets"
  on public.validation_rule_sets
  for select
  to authenticated
  using (status = 'published');

drop policy if exists "Authenticated users can read published validation rules"
  on public.validation_rules;

create policy "Authenticated users can read published validation rules"
  on public.validation_rules
  for select
  to authenticated
  using (
    status = 'published'
    and exists (
      select 1
      from public.validation_rule_sets rule_set
      where rule_set.id = validation_rules.rule_set_id
        and rule_set.status = 'published'
    )
  );

drop policy if exists "Authenticated users can read published validation rule sources"
  on public.validation_rule_sources;

create policy "Authenticated users can read published validation rule sources"
  on public.validation_rule_sources
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.validation_rules rule
      join public.validation_rule_sets rule_set
        on rule_set.id = rule.rule_set_id
      where rule.id = validation_rule_sources.rule_id
        and rule.status = 'published'
        and rule_set.status = 'published'
    )
  );

grant select on table public.validation_rule_sets to authenticated;
grant select on table public.validation_rules to authenticated;
grant select on table public.validation_rule_sources to authenticated;

with rule_set as (
  insert into public.validation_rule_sets (
    code,
    name,
    description,
    version,
    status,
    legal_confidence
  )
  values (
    'INVOICE_LANTERN_CORE',
    'Invoice Lantern Core Technical Rules',
    'Internal technical validation rules for the Invoice Lantern canonical invoice sandbox. These rules are not official validation and are not legal, tax, or accounting advice.',
    '2026.04.1',
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
rules_seed (
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
      'CANONICAL_SCHEMA_INVALID',
      'Canonical invoice schema invalid',
      'The input payload must match the independent Invoice Lantern canonical invoice schema before validation can continue.',
      'SCHEMA',
      'blocked',
      'invoice',
      '{zodIssueMessage}',
      'Correct the invoice payload shape and decimal strings.',
      'technical',
      '2026.04.1',
      'published'
    ),
    (
      'DOCUMENT_NUMBER_REQUIRED',
      'Document number required',
      'A document number is required for technical invoice validation readiness.',
      'CANONICAL',
      'fatal',
      'document.number',
      'Document number is required for invoice validation readiness.',
      'Add the invoice document number before validation or export.',
      'technical',
      '2026.04.1',
      'published'
    ),
    (
      'CURRENCY_REQUIRED',
      'Currency required',
      'A document currency is required so decimal-safe invoice calculations can be evaluated.',
      'CANONICAL',
      'fatal',
      'document.currency',
      'Document currency is required for invoice calculations.',
      'Use a 3-letter ISO-style currency code such as EUR.',
      'technical',
      '2026.04.1',
      'published'
    ),
    (
      'SELLER_NAME_REQUIRED',
      'Seller name required',
      'The canonical invoice model requires a seller name for technical validation.',
      'CANONICAL',
      'fatal',
      'seller.name',
      'Seller name is required in the canonical invoice model.',
      'Add the seller legal or trading name.',
      'technical',
      '2026.04.1',
      'published'
    ),
    (
      'SELLER_COUNTRY_REQUIRED',
      'Seller country required',
      'The canonical invoice model requires a seller country code for technical validation.',
      'CANONICAL',
      'fatal',
      'seller.country',
      'Seller country is required in the canonical invoice model.',
      'Add the seller country code.',
      'technical',
      '2026.04.1',
      'published'
    ),
    (
      'BUYER_NAME_REQUIRED',
      'Buyer name required',
      'The canonical invoice model requires a buyer name for technical validation.',
      'CANONICAL',
      'fatal',
      'buyer.name',
      'Buyer name is required in the canonical invoice model.',
      'Add the buyer legal or trading name.',
      'technical',
      '2026.04.1',
      'published'
    ),
    (
      'BUYER_COUNTRY_REQUIRED',
      'Buyer country required',
      'The canonical invoice model requires a buyer country code for technical validation.',
      'CANONICAL',
      'fatal',
      'buyer.country',
      'Buyer country is required in the canonical invoice model.',
      'Add the buyer country code.',
      'technical',
      '2026.04.1',
      'published'
    ),
    (
      'INVOICE_LINE_REQUIRED',
      'Invoice line required',
      'At least one invoice line is required for technical invoice calculation readiness.',
      'CANONICAL',
      'fatal',
      'lines',
      'At least one invoice line is required.',
      'Add at least one line with description, quantity, price, and VAT rate.',
      'technical',
      '2026.04.1',
      'published'
    ),
    (
      'LINE_DESCRIPTION_REQUIRED',
      'Line description required',
      'Each invoice line needs a description in the canonical invoice model.',
      'CANONICAL',
      'fatal',
      'lines.{index}.description',
      'Line {lineLabel} requires a description.',
      'Add a short product or service description.',
      'technical',
      '2026.04.1',
      'published'
    ),
    (
      'LINE_QUANTITY_POSITIVE',
      'Line quantity positive',
      'Each invoice line quantity must be a positive decimal value for calculation readiness.',
      'CALCULATION',
      'fatal',
      'lines.{index}.quantity',
      'Line {lineLabel} quantity must be greater than zero.',
      'Use a positive decimal quantity such as 1 or 2.5.',
      'technical',
      '2026.04.1',
      'published'
    ),
    (
      'LINE_UNIT_PRICE_NON_NEGATIVE',
      'Line unit price non-negative',
      'Each invoice line unit price must be zero or greater for calculation readiness.',
      'CALCULATION',
      'fatal',
      'lines.{index}.unitPrice',
      'Line {lineLabel} unit price must be zero or greater.',
      'Use a non-negative decimal unit price.',
      'technical',
      '2026.04.1',
      'published'
    ),
    (
      'LINE_NET_AMOUNT_MISMATCH',
      'Line net amount mismatch',
      'A supplied line net amount should match quantity multiplied by unit price using decimal-safe calculation.',
      'CALCULATION',
      'fatal',
      'lines.{index}.netAmount',
      'Line {lineLabel} net amount does not match quantity multiplied by unit price.',
      null,
      'technical',
      '2026.04.1',
      'published'
    ),
    (
      'LINE_TAX_AMOUNT_MISMATCH',
      'Line tax amount mismatch',
      'A supplied line tax amount should match the calculated VAT amount using the line VAT rate.',
      'CALCULATION',
      'fatal',
      'lines.{index}.taxAmount',
      'Line {lineLabel} tax amount does not match the calculated VAT amount.',
      null,
      'technical',
      '2026.04.1',
      'published'
    ),
    (
      'TAX_AMOUNT_MISMATCH',
      'Tax amount mismatch',
      'A supplied invoice tax amount should match the sum of calculated line VAT amounts.',
      'CALCULATION',
      'fatal',
      'totals.taxAmount',
      'Tax amount does not match the sum of calculated line VAT amounts.',
      null,
      'technical',
      '2026.04.1',
      'published'
    ),
    (
      'PAYABLE_AMOUNT_MISMATCH',
      'Payable amount mismatch',
      'A supplied payable amount should match the calculated tax-inclusive amount.',
      'CALCULATION',
      'fatal',
      'totals.payableAmount',
      'Payable total does not match the calculated tax-inclusive amount.',
      null,
      'technical',
      '2026.04.1',
      'published'
    ),
    (
      'ZERO_VALUE_LINE_WARNING',
      'Zero value line warning',
      'Zero-value invoice lines are allowed by the sandbox model but should be reviewed.',
      'CALCULATION',
      'warning',
      'lines.{index}',
      'Line {lineLabel} has a zero net amount and should be reviewed.',
      'Confirm whether this zero-value line is intentional.',
      'technical',
      '2026.04.1',
      'published'
    ),
    (
      'CROSS_BORDER_REVIEW_REQUIRED',
      'Cross-border review required',
      'Different seller and buyer country codes are marked for professional review in this sandbox.',
      'LEGAL_LABEL',
      'warning',
      'buyer.country',
      'Seller and buyer countries differ. VAT treatment and reporting readiness require professional review.',
      'Review cross-border VAT treatment with a qualified professional before operational use.',
      'professional_review_required',
      '2026.04.1',
      'published'
    ),
    (
      'BUYER_VAT_ID_REQUIRED_FOR_CROSS_BORDER_SIMULATION',
      'Buyer VAT ID required for cross-border simulation',
      'The sandbox requires a buyer VAT ID for cross-border B2B simulation readiness checks.',
      'VAT_ID',
      'fatal',
      'buyer.vatId',
      'Buyer VAT ID is required for this cross-border B2B simulation.',
      'Add the buyer VAT ID or route this invoice for professional review.',
      'educational_simulation',
      '2026.04.1',
      'published'
    )
),
upserted_rules as (
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
    rule_set.id,
    rules_seed.code,
    rules_seed.title,
    rules_seed.description,
    rules_seed.category,
    rules_seed.severity,
    rules_seed.field_path,
    rules_seed.message_template,
    rules_seed.fix_suggestion,
    rules_seed.legal_confidence,
    rules_seed.version,
    rules_seed.status
  from rule_set
  cross join rules_seed
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
  upserted_rules.id,
  'Invoice Lantern internal technical validation policy',
  'platform',
  'internal_technical_policy',
  'These are internal technical and sandbox validation rules for generated validation findings. They do not represent legal, tax, accounting, official EU, Peppol, EN 16931, ViDA, government, or authority conclusions. Professional review is required where appropriate.'
from upserted_rules
where not exists (
  select 1
  from public.validation_rule_sources existing_source
  where existing_source.rule_id = upserted_rules.id
    and existing_source.source_name = 'Invoice Lantern internal technical validation policy'
);
