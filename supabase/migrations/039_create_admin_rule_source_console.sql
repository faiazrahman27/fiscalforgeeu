-- Migration 039: platform admin rule/source/country-pack console foundations.
-- Additive metadata only. Historical validation findings are not rewritten.

alter table public.validation_rule_sets
drop constraint if exists validation_rule_sets_status_check;

alter table public.validation_rule_sets
add constraint validation_rule_sets_status_check
check (status in (
  'draft',
  'review',
  'published',
  'deprecated',
  'archived',
  'disabled',
  'suspended'
));

alter table public.validation_rules
drop constraint if exists validation_rules_status_check;

alter table public.validation_rules
add constraint validation_rules_status_check
check (status in (
  'draft',
  'review',
  'published',
  'deprecated',
  'archived',
  'disabled',
  'suspended'
));

alter table public.validation_rules
drop constraint if exists validation_rules_category_check;

alter table public.validation_rules
add constraint validation_rules_category_check
check (category in (
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
  'API',
  'SECURITY',
  'LEGAL_LABEL',
  'OTHER'
));

alter table public.validation_rules
add column if not exists check_type text,
add column if not exists layer text,
add column if not exists jurisdiction text not null default 'EU',
add column if not exists country_code text,
add column if not exists effective_from date,
add column if not exists effective_to date,
add column if not exists reviewed_at date,
add column if not exists reviewer_label text,
add column if not exists professional_review_required boolean not null default true,
add column if not exists internal_notes text,
add column if not exists metadata jsonb not null default '{}'::jsonb,
add column if not exists created_by uuid references auth.users(id) on delete set null,
add column if not exists updated_by uuid references auth.users(id) on delete set null,
add column if not exists published_at timestamptz,
add column if not exists deprecated_at timestamptz,
add column if not exists archived_at timestamptz,
add column if not exists disabled_at timestamptz;

alter table public.validation_rules
drop constraint if exists validation_rules_country_code_check;

alter table public.validation_rules
add constraint validation_rules_country_code_check
check (country_code is null or country_code ~ '^[A-Z]{2}$');

alter table public.validation_rules
drop constraint if exists validation_rules_effective_window_check;

alter table public.validation_rules
add constraint validation_rules_effective_window_check
check (effective_to is null or effective_from is null or effective_to >= effective_from);

alter table public.source_references
drop constraint if exists source_references_source_type_check;

alter table public.source_references
add constraint source_references_source_type_check
check (source_type in (
  'eu_law',
  'eu_guidance',
  'national_tax_authority',
  'national_einvoicing_authority',
  'standard',
  'peppol',
  'vies',
  'country_pack',
  'legal_notice',
  'internal_policy',
  'other'
));

alter table public.source_references
add column if not exists notes text,
add column if not exists retrieved_at date;

create table if not exists public.validation_rule_source_links (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.validation_rules(id) on delete cascade,
  source_reference_id uuid not null references public.source_references(id) on delete restrict,
  link_type text not null default 'supports'
    check (link_type in ('supports', 'explains', 'derived_from', 'reviewed_against')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (rule_id, source_reference_id)
);

create table if not exists public.country_pack_review_overlays (
  country_code text primary key
    check (country_code ~ '^[A-Z]{2}$' and country_code <> 'EL'),
  review_status text not null default 'professional_review_required'
    check (review_status in (
      'draft',
      'internal_review',
      'reviewed',
      'professional_review_required',
      'deprecated',
      'suspended'
    )),
  legal_confidence text not null default 'professional_review_required'
    check (legal_confidence in (
      'technical',
      'standard_based',
      'official_source_derived',
      'educational_simulation',
      'professional_review_required'
    )),
  review_notes text,
  source_ref_ids uuid[] not null default '{}'::uuid[],
  reviewed_at date,
  reviewer_label text,
  version_label text,
  professional_review_required boolean not null default true,
  warnings jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.country_pack_source_links (
  id uuid primary key default gen_random_uuid(),
  country_code text not null
    check (country_code ~ '^[A-Z]{2}$' and country_code <> 'EL'),
  source_reference_id uuid not null references public.source_references(id) on delete restrict,
  link_type text not null default 'reviewed_against'
    check (link_type in ('supports', 'explains', 'derived_from', 'reviewed_against')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (country_code, source_reference_id)
);

create table if not exists public.platform_admin_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null
    check (entity_type in ('validation_rule', 'source_reference', 'country_pack')),
  entity_id text not null,
  entity_label text not null,
  event_type text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_country_pack_review_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_country_pack_review_overlays_updated_at
  on public.country_pack_review_overlays;

create trigger set_country_pack_review_overlays_updated_at
before update on public.country_pack_review_overlays
for each row
execute function public.set_country_pack_review_updated_at();

create or replace function public.prevent_platform_admin_lifecycle_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'platform_admin_lifecycle_events are immutable';
end;
$$;

drop trigger if exists prevent_platform_admin_lifecycle_event_update
  on public.platform_admin_lifecycle_events;

create trigger prevent_platform_admin_lifecycle_event_update
before update or delete on public.platform_admin_lifecycle_events
for each row
execute function public.prevent_platform_admin_lifecycle_event_mutation();

create index if not exists validation_rules_admin_status_idx
  on public.validation_rules(status, updated_at desc);

create index if not exists validation_rules_admin_jurisdiction_idx
  on public.validation_rules(jurisdiction, country_code);

create index if not exists validation_rules_admin_effective_dates_idx
  on public.validation_rules(effective_from, effective_to);

create index if not exists validation_rule_source_links_rule_id_idx
  on public.validation_rule_source_links(rule_id);

create index if not exists validation_rule_source_links_source_id_idx
  on public.validation_rule_source_links(source_reference_id);

create index if not exists source_references_admin_effective_dates_idx
  on public.source_references(effective_from, effective_to);

create index if not exists source_references_admin_retrieved_at_idx
  on public.source_references(retrieved_at desc);

create index if not exists country_pack_review_overlays_status_idx
  on public.country_pack_review_overlays(review_status, legal_confidence);

create index if not exists country_pack_source_links_country_idx
  on public.country_pack_source_links(country_code);

create index if not exists country_pack_source_links_source_idx
  on public.country_pack_source_links(source_reference_id);

create index if not exists platform_admin_lifecycle_events_entity_idx
  on public.platform_admin_lifecycle_events(entity_type, entity_id, created_at desc);

create index if not exists platform_admin_lifecycle_events_event_type_idx
  on public.platform_admin_lifecycle_events(event_type, created_at desc);

alter table public.validation_rule_source_links enable row level security;
alter table public.country_pack_review_overlays enable row level security;
alter table public.country_pack_source_links enable row level security;
alter table public.platform_admin_lifecycle_events enable row level security;

drop policy if exists "Authenticated users can read validation rule source links"
  on public.validation_rule_source_links;

create policy "Authenticated users can read validation rule source links"
  on public.validation_rule_source_links
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read country pack review overlays"
  on public.country_pack_review_overlays;

create policy "Authenticated users can read country pack review overlays"
  on public.country_pack_review_overlays
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read country pack source links"
  on public.country_pack_source_links;

create policy "Authenticated users can read country pack source links"
  on public.country_pack_source_links
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read platform admin lifecycle events"
  on public.platform_admin_lifecycle_events;

create policy "Authenticated users can read platform admin lifecycle events"
  on public.platform_admin_lifecycle_events
  for select
  to authenticated
  using (true);

grant select on table public.validation_rule_source_links to authenticated;
grant select on table public.country_pack_review_overlays to authenticated;
grant select on table public.country_pack_source_links to authenticated;
grant select on table public.platform_admin_lifecycle_events to authenticated;

grant all on table public.validation_rule_source_links to service_role;
grant all on table public.country_pack_review_overlays to service_role;
grant all on table public.country_pack_source_links to service_role;
grant all on table public.platform_admin_lifecycle_events to service_role;
