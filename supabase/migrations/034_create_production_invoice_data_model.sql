-- Invoice Lantern
-- Migration 034: production invoice data model foundation.
--
-- This migration is additive. It creates the persistent business profile,
-- contact, production invoice, attachment, security-event, and source-reference
-- foundations needed by later implementation steps without replacing drafts or
-- claiming official compliance functionality.

begin;

create unique index if not exists invoice_drafts_id_organization_id_unique_idx
on public.invoice_drafts (id, organization_id);

create unique index if not exists validation_runs_id_organization_id_unique_idx
on public.validation_runs (id, organization_id);

create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_type text not null check (profile_type in ('seller', 'buyer', 'both')),
  display_name text not null check (char_length(trim(display_name)) between 1 and 200),
  legal_name text check (legal_name is null or char_length(trim(legal_name)) between 1 and 240),
  trading_name text check (trading_name is null or char_length(trim(trading_name)) between 1 and 240),
  country_code char(2) not null check (country_code ~ '^[A-Z]{2}$'),
  vat_id text check (vat_id is null or char_length(trim(vat_id)) between 1 and 80),
  tax_registration_number text check (tax_registration_number is null or char_length(trim(tax_registration_number)) between 1 and 120),
  electronic_address text check (electronic_address is null or char_length(trim(electronic_address)) between 1 and 240),
  electronic_address_scheme text check (electronic_address_scheme is null or char_length(trim(electronic_address_scheme)) between 1 and 40),
  email text check (email is null or char_length(trim(email)) between 3 and 320),
  phone text check (phone is null or char_length(trim(phone)) between 1 and 80),
  website text check (website is null or char_length(trim(website)) between 1 and 500),
  address_line1 text check (address_line1 is null or char_length(trim(address_line1)) between 1 and 240),
  address_line2 text check (address_line2 is null or char_length(trim(address_line2)) between 1 and 240),
  city text check (city is null or char_length(trim(city)) between 1 and 160),
  region text check (region is null or char_length(trim(region)) between 1 and 160),
  postal_code text check (postal_code is null or char_length(trim(postal_code)) between 1 and 40),
  country_subdivision text check (country_subdivision is null or char_length(trim(country_subdivision)) between 1 and 80),
  default_currency char(3) check (default_currency is null or default_currency ~ '^[A-Z]{3}$'),
  payment_terms text check (payment_terms is null or char_length(trim(payment_terms)) between 1 and 2000),
  bank_account_label text check (bank_account_label is null or char_length(trim(bank_account_label)) between 1 and 120),
  bank_account_last4 text check (bank_account_last4 is null or bank_account_last4 ~ '^[A-Za-z0-9]{2,4}$'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists business_profiles_id_organization_id_unique_idx
on public.business_profiles (id, organization_id);

create index if not exists business_profiles_organization_id_idx
on public.business_profiles (organization_id);

create index if not exists business_profiles_organization_profile_type_idx
on public.business_profiles (organization_id, profile_type);

create index if not exists business_profiles_organization_status_idx
on public.business_profiles (organization_id, status);

create index if not exists business_profiles_organization_vat_id_idx
on public.business_profiles (organization_id, vat_id)
where vat_id is not null;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_profile_id uuid references public.business_profiles(id) on delete set null,
  contact_type text not null default 'business' check (contact_type in ('business', 'person', 'department', 'other')),
  display_name text not null check (char_length(trim(display_name)) between 1 and 200),
  legal_name text check (legal_name is null or char_length(trim(legal_name)) between 1 and 240),
  email text check (email is null or char_length(trim(email)) between 3 and 320),
  phone text check (phone is null or char_length(trim(phone)) between 1 and 80),
  country_code char(2) check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  vat_id text check (vat_id is null or char_length(trim(vat_id)) between 1 and 80),
  tax_registration_number text check (tax_registration_number is null or char_length(trim(tax_registration_number)) between 1 and 120),
  electronic_address text check (electronic_address is null or char_length(trim(electronic_address)) between 1 and 240),
  electronic_address_scheme text check (electronic_address_scheme is null or char_length(trim(electronic_address_scheme)) between 1 and 40),
  address_line1 text check (address_line1 is null or char_length(trim(address_line1)) between 1 and 240),
  address_line2 text check (address_line2 is null or char_length(trim(address_line2)) between 1 and 240),
  city text check (city is null or char_length(trim(city)) between 1 and 160),
  region text check (region is null or char_length(trim(region)) between 1 and 160),
  postal_code text check (postal_code is null or char_length(trim(postal_code)) between 1 and 40),
  country_subdivision text check (country_subdivision is null or char_length(trim(country_subdivision)) between 1 and 80),
  notes text check (notes is null or char_length(trim(notes)) <= 4000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists contacts_id_organization_id_unique_idx
on public.contacts (id, organization_id);

create index if not exists contacts_organization_id_idx
on public.contacts (organization_id);

create index if not exists contacts_organization_status_idx
on public.contacts (organization_id, status);

create index if not exists contacts_organization_email_idx
on public.contacts (organization_id, email)
where email is not null;

create index if not exists contacts_organization_vat_id_idx
on public.contacts (organization_id, vat_id)
where vat_id is not null;

create index if not exists contacts_organization_business_profile_id_idx
on public.contacts (organization_id, business_profile_id);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  draft_id uuid references public.invoice_drafts(id) on delete set null,
  seller_profile_id uuid references public.business_profiles(id) on delete set null,
  buyer_profile_id uuid references public.business_profiles(id) on delete set null,
  buyer_contact_id uuid references public.contacts(id) on delete set null,
  seller_contact_id uuid references public.contacts(id) on delete set null,
  invoice_number text not null check (char_length(trim(invoice_number)) between 1 and 120),
  invoice_type text not null check (invoice_type in ('invoice', 'credit_note')),
  profile text not null default 'EN16931' check (profile in ('EN16931', 'PEPPOL_BIS_3', 'COUNTRY_PACK')),
  issue_date date not null,
  due_date date,
  tax_point_date date,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  buyer_reference text check (buyer_reference is null or char_length(trim(buyer_reference)) between 1 and 120),
  contract_reference text check (contract_reference is null or char_length(trim(contract_reference)) between 1 and 120),
  order_reference text check (order_reference is null or char_length(trim(order_reference)) between 1 and 120),
  project_reference text check (project_reference is null or char_length(trim(project_reference)) between 1 and 120),
  accounting_cost text check (accounting_cost is null or char_length(trim(accounting_cost)) between 1 and 120),
  payment_terms text check (payment_terms is null or char_length(trim(payment_terms)) between 1 and 2000),
  payment_means_code text check (payment_means_code is null or char_length(trim(payment_means_code)) between 1 and 40),
  payment_reference text check (payment_reference is null or char_length(trim(payment_reference)) between 1 and 120),
  seller_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(seller_snapshot) = 'object'),
  buyer_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(buyer_snapshot) = 'object'),
  delivery_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(delivery_snapshot) = 'object'),
  payment_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(payment_snapshot) = 'object'),
  canonical_json jsonb not null default '{}'::jsonb check (jsonb_typeof(canonical_json) = 'object'),
  calculation_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(calculation_summary) = 'object'),
  validation_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(validation_summary) = 'object'),
  legal_disclaimer text not null default 'Invoice Lantern stores this invoice as an independent technical validation and readiness sandbox record. Results are informational only and are not legal, tax, accounting, financial, professional, official filing, authority acceptance, Peppol certification, EN 16931 certification, or compliance advice.',
  legal_confidence text not null default 'technical' check (legal_confidence in ('technical', 'standard_based', 'official_source_derived', 'educational_simulation', 'professional_review_required')),
  status text not null default 'draft' check (status in ('draft', 'ready_for_review', 'validated', 'issued', 'archived', 'voided')),
  source text not null default 'manual' check (source in ('manual', 'api', 'ubl_import', 'cii_import', 'system')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finalized_at timestamptz,
  issued_at timestamptz,
  archived_at timestamptz
);

create unique index if not exists invoices_id_organization_id_unique_idx
on public.invoices (id, organization_id);

create unique index if not exists invoices_organization_invoice_number_active_idx
on public.invoices (organization_id, invoice_number)
where status <> 'voided';

create index if not exists invoices_organization_id_idx
on public.invoices (organization_id);

create index if not exists invoices_organization_status_idx
on public.invoices (organization_id, status);

create index if not exists invoices_organization_invoice_number_idx
on public.invoices (organization_id, invoice_number);

create index if not exists invoices_organization_issue_date_desc_idx
on public.invoices (organization_id, issue_date desc);

create index if not exists invoices_organization_buyer_profile_id_idx
on public.invoices (organization_id, buyer_profile_id);

create index if not exists invoices_organization_seller_profile_id_idx
on public.invoices (organization_id, seller_profile_id);

create index if not exists invoices_organization_draft_id_idx
on public.invoices (organization_id, draft_id);

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null,
  line_number integer not null check (line_number >= 1),
  description text not null check (char_length(trim(description)) between 1 and 1000),
  item_name text check (item_name is null or char_length(trim(item_name)) between 1 and 240),
  quantity numeric(18, 6) not null check (quantity >= 0),
  unit_code text not null check (char_length(trim(unit_code)) between 1 and 24),
  unit_price numeric(18, 6) not null check (unit_price >= 0),
  discount_amount numeric(18, 6) not null default 0 check (discount_amount >= 0),
  charge_amount numeric(18, 6) not null default 0 check (charge_amount >= 0),
  net_amount numeric(18, 6) not null check (net_amount >= 0),
  vat_category text not null check (char_length(trim(vat_category)) between 1 and 40),
  vat_rate numeric(9, 4) not null default 0 check (vat_rate >= 0),
  tax_scheme text not null default 'VAT' check (char_length(trim(tax_scheme)) between 1 and 40),
  accounting_cost text check (accounting_cost is null or char_length(trim(accounting_cost)) between 1 and 120),
  order_line_reference text check (order_line_reference is null or char_length(trim(order_line_reference)) between 1 and 120),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_lines_invoice_org_fk
    foreign key (invoice_id, organization_id)
    references public.invoices(id, organization_id) on delete cascade,
  unique (invoice_id, line_number)
);

create unique index if not exists invoice_lines_id_invoice_organization_unique_idx
on public.invoice_lines (id, invoice_id, organization_id);

create index if not exists invoice_lines_organization_id_idx
on public.invoice_lines (organization_id);

create index if not exists invoice_lines_invoice_id_idx
on public.invoice_lines (invoice_id);

create index if not exists invoice_lines_organization_invoice_id_idx
on public.invoice_lines (organization_id, invoice_id);

create table if not exists public.invoice_taxes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null,
  invoice_line_id uuid,
  tax_category text not null check (char_length(trim(tax_category)) between 1 and 40),
  tax_scheme text not null default 'VAT' check (char_length(trim(tax_scheme)) between 1 and 40),
  vat_rate numeric(9, 4) not null default 0 check (vat_rate >= 0),
  taxable_amount numeric(18, 6) not null default 0 check (taxable_amount >= 0),
  tax_amount numeric(18, 6) not null default 0 check (tax_amount >= 0),
  exemption_reason text check (exemption_reason is null or char_length(trim(exemption_reason)) between 1 and 500),
  exemption_reason_code text check (exemption_reason_code is null or char_length(trim(exemption_reason_code)) between 1 and 80),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_taxes_invoice_org_fk
    foreign key (invoice_id, organization_id)
    references public.invoices(id, organization_id) on delete cascade,
  constraint invoice_taxes_line_invoice_org_fk
    foreign key (invoice_line_id, invoice_id, organization_id)
    references public.invoice_lines(id, invoice_id, organization_id) on delete cascade
);

create index if not exists invoice_taxes_organization_id_idx
on public.invoice_taxes (organization_id);

create index if not exists invoice_taxes_invoice_id_idx
on public.invoice_taxes (invoice_id);

create index if not exists invoice_taxes_invoice_line_id_idx
on public.invoice_taxes (invoice_line_id);

create index if not exists invoice_taxes_organization_invoice_id_idx
on public.invoice_taxes (organization_id, invoice_id);

create table if not exists public.invoice_allowances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null,
  invoice_line_id uuid,
  scope text not null check (scope in ('document', 'line')),
  reason text check (reason is null or char_length(trim(reason)) between 1 and 500),
  reason_code text check (reason_code is null or char_length(trim(reason_code)) between 1 and 80),
  amount numeric(18, 6) not null check (amount >= 0),
  base_amount numeric(18, 6) check (base_amount is null or base_amount >= 0),
  percentage numeric(9, 4) check (percentage is null or percentage >= 0),
  tax_category text check (tax_category is null or char_length(trim(tax_category)) between 1 and 40),
  vat_rate numeric(9, 4) check (vat_rate is null or vat_rate >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_allowances_scope_line_chk
    check (
      (scope = 'line' and invoice_line_id is not null)
      or (scope = 'document' and invoice_line_id is null)
    ),
  constraint invoice_allowances_invoice_org_fk
    foreign key (invoice_id, organization_id)
    references public.invoices(id, organization_id) on delete cascade,
  constraint invoice_allowances_line_invoice_org_fk
    foreign key (invoice_line_id, invoice_id, organization_id)
    references public.invoice_lines(id, invoice_id, organization_id) on delete cascade
);

create index if not exists invoice_allowances_organization_id_idx
on public.invoice_allowances (organization_id);

create index if not exists invoice_allowances_invoice_id_idx
on public.invoice_allowances (invoice_id);

create index if not exists invoice_allowances_invoice_line_id_idx
on public.invoice_allowances (invoice_line_id);

create index if not exists invoice_allowances_organization_invoice_id_idx
on public.invoice_allowances (organization_id, invoice_id);

create table if not exists public.invoice_charges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null,
  invoice_line_id uuid,
  scope text not null check (scope in ('document', 'line')),
  reason text check (reason is null or char_length(trim(reason)) between 1 and 500),
  reason_code text check (reason_code is null or char_length(trim(reason_code)) between 1 and 80),
  amount numeric(18, 6) not null check (amount >= 0),
  base_amount numeric(18, 6) check (base_amount is null or base_amount >= 0),
  percentage numeric(9, 4) check (percentage is null or percentage >= 0),
  tax_category text check (tax_category is null or char_length(trim(tax_category)) between 1 and 40),
  vat_rate numeric(9, 4) check (vat_rate is null or vat_rate >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_charges_scope_line_chk
    check (
      (scope = 'line' and invoice_line_id is not null)
      or (scope = 'document' and invoice_line_id is null)
    ),
  constraint invoice_charges_invoice_org_fk
    foreign key (invoice_id, organization_id)
    references public.invoices(id, organization_id) on delete cascade,
  constraint invoice_charges_line_invoice_org_fk
    foreign key (invoice_line_id, invoice_id, organization_id)
    references public.invoice_lines(id, invoice_id, organization_id) on delete cascade
);

create index if not exists invoice_charges_organization_id_idx
on public.invoice_charges (organization_id);

create index if not exists invoice_charges_invoice_id_idx
on public.invoice_charges (invoice_id);

create index if not exists invoice_charges_invoice_line_id_idx
on public.invoice_charges (invoice_line_id);

create index if not exists invoice_charges_organization_invoice_id_idx
on public.invoice_charges (organization_id, invoice_id);

create table if not exists public.invoice_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid,
  invoice_draft_id uuid,
  file_upload_id uuid,
  storage_bucket text check (storage_bucket is null or char_length(trim(storage_bucket)) between 1 and 120),
  storage_path text check (storage_path is null or char_length(trim(storage_path)) between 1 and 1200),
  original_filename text not null check (char_length(trim(original_filename)) between 1 and 260),
  content_type text not null check (char_length(trim(content_type)) between 1 and 160),
  size_bytes bigint not null check (size_bytes > 0),
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$'),
  attachment_type text not null default 'supporting_evidence'
    check (attachment_type in ('supporting_evidence', 'source_xml', 'generated_pdf', 'imported_pdf', 'manual_entry_helper', 'other')),
  validation_role text not null default 'supporting_only'
    check (validation_role in ('structured_source', 'supporting_only', 'generated_output')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invoice_attachments_invoice_or_draft_chk
    check (invoice_id is not null or invoice_draft_id is not null),
  constraint invoice_attachments_structured_source_role_chk
    check (validation_role <> 'structured_source' or attachment_type = 'source_xml'),
  constraint invoice_attachments_invoice_org_fk
    foreign key (invoice_id, organization_id)
    references public.invoices(id, organization_id) on delete cascade,
  constraint invoice_attachments_invoice_draft_org_fk
    foreign key (invoice_draft_id, organization_id)
    references public.invoice_drafts(id, organization_id) on delete cascade
);

create index if not exists invoice_attachments_organization_id_idx
on public.invoice_attachments (organization_id);

create index if not exists invoice_attachments_invoice_id_idx
on public.invoice_attachments (invoice_id);

create index if not exists invoice_attachments_invoice_draft_id_idx
on public.invoice_attachments (invoice_draft_id);

create index if not exists invoice_attachments_organization_attachment_type_idx
on public.invoice_attachments (organization_id, attachment_type);

create index if not exists invoice_attachments_organization_created_at_desc_idx
on public.invoice_attachments (organization_id, created_at desc);

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_api_key_id uuid references public.api_keys(id) on delete set null,
  event_type text not null check (char_length(trim(event_type)) between 1 and 160),
  severity text not null default 'info' check (severity in ('info', 'warning', 'high', 'critical')),
  category text not null default 'security' check (char_length(trim(category)) between 1 and 80),
  ip_hash text check (ip_hash is null or char_length(trim(ip_hash)) between 16 and 160),
  user_agent text check (user_agent is null or char_length(user_agent) <= 512),
  request_id text check (request_id is null or char_length(trim(request_id)) between 1 and 120),
  resource_type text check (resource_type is null or char_length(trim(resource_type)) between 1 and 120),
  resource_id uuid,
  outcome text not null default 'recorded' check (outcome in ('success', 'failure', 'blocked', 'recorded')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists security_events_organization_created_at_desc_idx
on public.security_events (organization_id, created_at desc);

create index if not exists security_events_actor_user_created_at_desc_idx
on public.security_events (actor_user_id, created_at desc);

create index if not exists security_events_actor_api_key_created_at_desc_idx
on public.security_events (actor_api_key_id, created_at desc);

create index if not exists security_events_event_type_idx
on public.security_events (event_type);

create index if not exists security_events_severity_idx
on public.security_events (severity);

create index if not exists security_events_outcome_idx
on public.security_events (outcome);

create table if not exists public.source_references (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  scope text not null default 'platform' check (scope in ('platform', 'organization')),
  source_type text not null check (source_type in ('eu_law', 'eu_guidance', 'national_tax_authority', 'standard', 'peppol', 'vies', 'country_pack', 'legal_notice', 'internal_policy', 'other')),
  title text not null check (char_length(trim(title)) between 1 and 300),
  publisher text check (publisher is null or char_length(trim(publisher)) between 1 and 200),
  jurisdiction text check (jurisdiction is null or char_length(trim(jurisdiction)) between 1 and 80),
  url text check (url is null or char_length(trim(url)) between 1 and 1200),
  citation text check (citation is null or char_length(trim(citation)) between 1 and 1000),
  reviewed_at date,
  effective_from date,
  effective_to date,
  version_label text check (version_label is null or char_length(trim(version_label)) between 1 and 120),
  confidence_status text not null default 'draft' check (confidence_status in ('draft', 'reviewed', 'professional_review_required', 'deprecated', 'suspended')),
  language_code text check (language_code is null or language_code ~ '^[A-Za-z]{2,12}(-[A-Za-z0-9]{2,12})?$'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_references_scope_organization_chk
    check (
      (scope = 'platform' and organization_id is null)
      or (scope = 'organization' and organization_id is not null)
    ),
  constraint source_references_effective_window_chk
    check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

create unique index if not exists source_references_id_organization_id_unique_idx
on public.source_references (id, organization_id)
where organization_id is not null;

create index if not exists source_references_scope_idx
on public.source_references (scope);

create index if not exists source_references_organization_id_idx
on public.source_references (organization_id);

create index if not exists source_references_source_type_idx
on public.source_references (source_type);

create index if not exists source_references_jurisdiction_idx
on public.source_references (jurisdiction);

create index if not exists source_references_confidence_status_idx
on public.source_references (confidence_status);

create index if not exists source_references_reviewed_at_desc_idx
on public.source_references (reviewed_at desc);

create table if not exists public.source_reference_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  source_reference_id uuid not null references public.source_references(id) on delete cascade,
  target_table text not null check (char_length(trim(target_table)) between 1 and 120),
  target_id uuid not null,
  link_type text not null default 'supports' check (link_type in ('supports', 'explains', 'derived_from', 'reviewed_against', 'disclaimer')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists source_reference_links_source_reference_id_idx
on public.source_reference_links (source_reference_id);

create index if not exists source_reference_links_target_idx
on public.source_reference_links (target_table, target_id);

create index if not exists source_reference_links_organization_id_idx
on public.source_reference_links (organization_id);

create index if not exists source_reference_links_organization_target_idx
on public.source_reference_links (organization_id, target_table, target_id);

drop trigger if exists set_business_profiles_updated_at on public.business_profiles;
create trigger set_business_profiles_updated_at
before update on public.business_profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_contacts_updated_at on public.contacts;
create trigger set_contacts_updated_at
before update on public.contacts
for each row
execute function public.set_updated_at();

drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at
before update on public.invoices
for each row
execute function public.set_updated_at();

drop trigger if exists set_invoice_lines_updated_at on public.invoice_lines;
create trigger set_invoice_lines_updated_at
before update on public.invoice_lines
for each row
execute function public.set_updated_at();

drop trigger if exists set_invoice_taxes_updated_at on public.invoice_taxes;
create trigger set_invoice_taxes_updated_at
before update on public.invoice_taxes
for each row
execute function public.set_updated_at();

drop trigger if exists set_invoice_allowances_updated_at on public.invoice_allowances;
create trigger set_invoice_allowances_updated_at
before update on public.invoice_allowances
for each row
execute function public.set_updated_at();

drop trigger if exists set_invoice_charges_updated_at on public.invoice_charges;
create trigger set_invoice_charges_updated_at
before update on public.invoice_charges
for each row
execute function public.set_updated_at();

drop trigger if exists set_source_references_updated_at on public.source_references;
create trigger set_source_references_updated_at
before update on public.source_references
for each row
execute function public.set_updated_at();

alter table public.business_profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.invoice_taxes enable row level security;
alter table public.invoice_allowances enable row level security;
alter table public.invoice_charges enable row level security;
alter table public.invoice_attachments enable row level security;
alter table public.security_events enable row level security;
alter table public.source_references enable row level security;
alter table public.source_reference_links enable row level security;

drop policy if exists "Workspace members can read business profiles" on public.business_profiles;
create policy "Workspace members can read business profiles"
on public.business_profiles
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Invoice editors can create business profiles" on public.business_profiles;
create policy "Invoice editors can create business profiles"
on public.business_profiles
for insert
to authenticated
with check (
  public.can_create_invoice(organization_id)
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists "Invoice editors can update business profiles" on public.business_profiles;
create policy "Invoice editors can update business profiles"
on public.business_profiles
for update
to authenticated
using (public.can_create_invoice(organization_id))
with check (
  public.can_create_invoice(organization_id)
  and (updated_by is null or updated_by = auth.uid())
);

drop policy if exists "Workspace admins can delete business profiles" on public.business_profiles;
create policy "Workspace admins can delete business profiles"
on public.business_profiles
for delete
to authenticated
using (public.can_manage_org(organization_id));

drop policy if exists "Workspace members can read contacts" on public.contacts;
create policy "Workspace members can read contacts"
on public.contacts
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Invoice editors can create contacts" on public.contacts;
create policy "Invoice editors can create contacts"
on public.contacts
for insert
to authenticated
with check (
  public.can_create_invoice(organization_id)
  and (created_by is null or created_by = auth.uid())
  and (
    business_profile_id is null
    or exists (
      select 1
      from public.business_profiles profile
      where profile.id = contacts.business_profile_id
        and profile.organization_id = contacts.organization_id
    )
  )
);

drop policy if exists "Invoice editors can update contacts" on public.contacts;
create policy "Invoice editors can update contacts"
on public.contacts
for update
to authenticated
using (public.can_create_invoice(organization_id))
with check (
  public.can_create_invoice(organization_id)
  and (updated_by is null or updated_by = auth.uid())
  and (
    business_profile_id is null
    or exists (
      select 1
      from public.business_profiles profile
      where profile.id = contacts.business_profile_id
        and profile.organization_id = contacts.organization_id
    )
  )
);

drop policy if exists "Workspace admins can delete contacts" on public.contacts;
create policy "Workspace admins can delete contacts"
on public.contacts
for delete
to authenticated
using (public.can_manage_org(organization_id));

drop policy if exists "Workspace members can read invoices" on public.invoices;
create policy "Workspace members can read invoices"
on public.invoices
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Invoice editors can create invoices" on public.invoices;
create policy "Invoice editors can create invoices"
on public.invoices
for insert
to authenticated
with check (
  public.can_create_invoice(organization_id)
  and (created_by is null or created_by = auth.uid())
  and (
    draft_id is null
    or exists (
      select 1
      from public.invoice_drafts draft
      where draft.id = invoices.draft_id
        and draft.organization_id = invoices.organization_id
    )
  )
  and (
    seller_profile_id is null
    or exists (
      select 1
      from public.business_profiles profile
      where profile.id = invoices.seller_profile_id
        and profile.organization_id = invoices.organization_id
    )
  )
  and (
    buyer_profile_id is null
    or exists (
      select 1
      from public.business_profiles profile
      where profile.id = invoices.buyer_profile_id
        and profile.organization_id = invoices.organization_id
    )
  )
  and (
    buyer_contact_id is null
    or exists (
      select 1
      from public.contacts contact
      where contact.id = invoices.buyer_contact_id
        and contact.organization_id = invoices.organization_id
    )
  )
  and (
    seller_contact_id is null
    or exists (
      select 1
      from public.contacts contact
      where contact.id = invoices.seller_contact_id
        and contact.organization_id = invoices.organization_id
    )
  )
);

drop policy if exists "Invoice editors can update invoices" on public.invoices;
create policy "Invoice editors can update invoices"
on public.invoices
for update
to authenticated
using (public.can_create_invoice(organization_id))
with check (
  public.can_create_invoice(organization_id)
  and (updated_by is null or updated_by = auth.uid())
  and (
    draft_id is null
    or exists (
      select 1
      from public.invoice_drafts draft
      where draft.id = invoices.draft_id
        and draft.organization_id = invoices.organization_id
    )
  )
  and (
    seller_profile_id is null
    or exists (
      select 1
      from public.business_profiles profile
      where profile.id = invoices.seller_profile_id
        and profile.organization_id = invoices.organization_id
    )
  )
  and (
    buyer_profile_id is null
    or exists (
      select 1
      from public.business_profiles profile
      where profile.id = invoices.buyer_profile_id
        and profile.organization_id = invoices.organization_id
    )
  )
  and (
    buyer_contact_id is null
    or exists (
      select 1
      from public.contacts contact
      where contact.id = invoices.buyer_contact_id
        and contact.organization_id = invoices.organization_id
    )
  )
  and (
    seller_contact_id is null
    or exists (
      select 1
      from public.contacts contact
      where contact.id = invoices.seller_contact_id
        and contact.organization_id = invoices.organization_id
    )
  )
);

drop policy if exists "Workspace admins can delete invoices" on public.invoices;
create policy "Workspace admins can delete invoices"
on public.invoices
for delete
to authenticated
using (public.can_manage_org(organization_id));

drop policy if exists "Workspace members can read invoice lines" on public.invoice_lines;
create policy "Workspace members can read invoice lines"
on public.invoice_lines
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Invoice editors can create invoice lines" on public.invoice_lines;
create policy "Invoice editors can create invoice lines"
on public.invoice_lines
for insert
to authenticated
with check (
  public.can_create_invoice(organization_id)
  and exists (
    select 1
    from public.invoices invoice
    where invoice.id = invoice_lines.invoice_id
      and invoice.organization_id = invoice_lines.organization_id
  )
);

drop policy if exists "Invoice editors can update invoice lines" on public.invoice_lines;
create policy "Invoice editors can update invoice lines"
on public.invoice_lines
for update
to authenticated
using (public.can_create_invoice(organization_id))
with check (
  public.can_create_invoice(organization_id)
  and exists (
    select 1
    from public.invoices invoice
    where invoice.id = invoice_lines.invoice_id
      and invoice.organization_id = invoice_lines.organization_id
  )
);

drop policy if exists "Invoice editors can delete invoice lines" on public.invoice_lines;
create policy "Invoice editors can delete invoice lines"
on public.invoice_lines
for delete
to authenticated
using (public.can_create_invoice(organization_id));

drop policy if exists "Workspace members can read invoice taxes" on public.invoice_taxes;
create policy "Workspace members can read invoice taxes"
on public.invoice_taxes
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Invoice editors can create invoice taxes" on public.invoice_taxes;
create policy "Invoice editors can create invoice taxes"
on public.invoice_taxes
for insert
to authenticated
with check (
  public.can_create_invoice(organization_id)
  and exists (
    select 1
    from public.invoices invoice
    where invoice.id = invoice_taxes.invoice_id
      and invoice.organization_id = invoice_taxes.organization_id
  )
  and (
    invoice_line_id is null
    or exists (
      select 1
      from public.invoice_lines line
      where line.id = invoice_taxes.invoice_line_id
        and line.invoice_id = invoice_taxes.invoice_id
        and line.organization_id = invoice_taxes.organization_id
    )
  )
);

drop policy if exists "Invoice editors can update invoice taxes" on public.invoice_taxes;
create policy "Invoice editors can update invoice taxes"
on public.invoice_taxes
for update
to authenticated
using (public.can_create_invoice(organization_id))
with check (
  public.can_create_invoice(organization_id)
  and exists (
    select 1
    from public.invoices invoice
    where invoice.id = invoice_taxes.invoice_id
      and invoice.organization_id = invoice_taxes.organization_id
  )
  and (
    invoice_line_id is null
    or exists (
      select 1
      from public.invoice_lines line
      where line.id = invoice_taxes.invoice_line_id
        and line.invoice_id = invoice_taxes.invoice_id
        and line.organization_id = invoice_taxes.organization_id
    )
  )
);

drop policy if exists "Invoice editors can delete invoice taxes" on public.invoice_taxes;
create policy "Invoice editors can delete invoice taxes"
on public.invoice_taxes
for delete
to authenticated
using (public.can_create_invoice(organization_id));

drop policy if exists "Workspace members can read invoice allowances" on public.invoice_allowances;
create policy "Workspace members can read invoice allowances"
on public.invoice_allowances
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Invoice editors can create invoice allowances" on public.invoice_allowances;
create policy "Invoice editors can create invoice allowances"
on public.invoice_allowances
for insert
to authenticated
with check (
  public.can_create_invoice(organization_id)
  and exists (
    select 1
    from public.invoices invoice
    where invoice.id = invoice_allowances.invoice_id
      and invoice.organization_id = invoice_allowances.organization_id
  )
  and (
    invoice_line_id is null
    or exists (
      select 1
      from public.invoice_lines line
      where line.id = invoice_allowances.invoice_line_id
        and line.invoice_id = invoice_allowances.invoice_id
        and line.organization_id = invoice_allowances.organization_id
    )
  )
);

drop policy if exists "Invoice editors can update invoice allowances" on public.invoice_allowances;
create policy "Invoice editors can update invoice allowances"
on public.invoice_allowances
for update
to authenticated
using (public.can_create_invoice(organization_id))
with check (
  public.can_create_invoice(organization_id)
  and exists (
    select 1
    from public.invoices invoice
    where invoice.id = invoice_allowances.invoice_id
      and invoice.organization_id = invoice_allowances.organization_id
  )
  and (
    invoice_line_id is null
    or exists (
      select 1
      from public.invoice_lines line
      where line.id = invoice_allowances.invoice_line_id
        and line.invoice_id = invoice_allowances.invoice_id
        and line.organization_id = invoice_allowances.organization_id
    )
  )
);

drop policy if exists "Invoice editors can delete invoice allowances" on public.invoice_allowances;
create policy "Invoice editors can delete invoice allowances"
on public.invoice_allowances
for delete
to authenticated
using (public.can_create_invoice(organization_id));

drop policy if exists "Workspace members can read invoice charges" on public.invoice_charges;
create policy "Workspace members can read invoice charges"
on public.invoice_charges
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Invoice editors can create invoice charges" on public.invoice_charges;
create policy "Invoice editors can create invoice charges"
on public.invoice_charges
for insert
to authenticated
with check (
  public.can_create_invoice(organization_id)
  and exists (
    select 1
    from public.invoices invoice
    where invoice.id = invoice_charges.invoice_id
      and invoice.organization_id = invoice_charges.organization_id
  )
  and (
    invoice_line_id is null
    or exists (
      select 1
      from public.invoice_lines line
      where line.id = invoice_charges.invoice_line_id
        and line.invoice_id = invoice_charges.invoice_id
        and line.organization_id = invoice_charges.organization_id
    )
  )
);

drop policy if exists "Invoice editors can update invoice charges" on public.invoice_charges;
create policy "Invoice editors can update invoice charges"
on public.invoice_charges
for update
to authenticated
using (public.can_create_invoice(organization_id))
with check (
  public.can_create_invoice(organization_id)
  and exists (
    select 1
    from public.invoices invoice
    where invoice.id = invoice_charges.invoice_id
      and invoice.organization_id = invoice_charges.organization_id
  )
  and (
    invoice_line_id is null
    or exists (
      select 1
      from public.invoice_lines line
      where line.id = invoice_charges.invoice_line_id
        and line.invoice_id = invoice_charges.invoice_id
        and line.organization_id = invoice_charges.organization_id
    )
  )
);

drop policy if exists "Invoice editors can delete invoice charges" on public.invoice_charges;
create policy "Invoice editors can delete invoice charges"
on public.invoice_charges
for delete
to authenticated
using (public.can_create_invoice(organization_id));

drop policy if exists "Workspace members can read invoice attachments" on public.invoice_attachments;
create policy "Workspace members can read invoice attachments"
on public.invoice_attachments
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Invoice editors can create invoice attachments" on public.invoice_attachments;
create policy "Invoice editors can create invoice attachments"
on public.invoice_attachments
for insert
to authenticated
with check (
  public.can_create_invoice(organization_id)
  and (created_by is null or created_by = auth.uid())
  and (
    invoice_id is null
    or exists (
      select 1
      from public.invoices invoice
      where invoice.id = invoice_attachments.invoice_id
        and invoice.organization_id = invoice_attachments.organization_id
    )
  )
  and (
    invoice_draft_id is null
    or exists (
      select 1
      from public.invoice_drafts draft
      where draft.id = invoice_attachments.invoice_draft_id
        and draft.organization_id = invoice_attachments.organization_id
    )
  )
);

drop policy if exists "Invoice editors and admins can delete invoice attachments" on public.invoice_attachments;
create policy "Invoice editors and admins can delete invoice attachments"
on public.invoice_attachments
for delete
to authenticated
using (
  public.can_manage_org(organization_id)
  or (
    public.can_create_invoice(organization_id)
    and created_by = auth.uid()
  )
);

drop policy if exists "Workspace admins can read security events" on public.security_events;
create policy "Workspace admins can read security events"
on public.security_events
for select
to authenticated
using (
  organization_id is not null
  and public.can_manage_org(organization_id)
);

drop policy if exists "Authenticated users can read visible source references" on public.source_references;
create policy "Authenticated users can read visible source references"
on public.source_references
for select
to authenticated
using (
  (scope = 'platform' and organization_id is null)
  or (
    scope = 'organization'
    and organization_id is not null
    and public.is_org_member(organization_id)
  )
);

drop policy if exists "Workspace admins can create organization source references" on public.source_references;
create policy "Workspace admins can create organization source references"
on public.source_references
for insert
to authenticated
with check (
  scope = 'organization'
  and organization_id is not null
  and public.can_manage_org(organization_id)
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists "Workspace admins can update organization source references" on public.source_references;
create policy "Workspace admins can update organization source references"
on public.source_references
for update
to authenticated
using (
  scope = 'organization'
  and organization_id is not null
  and public.can_manage_org(organization_id)
)
with check (
  scope = 'organization'
  and organization_id is not null
  and public.can_manage_org(organization_id)
  and (updated_by is null or updated_by = auth.uid())
);

drop policy if exists "Workspace admins can delete organization source references" on public.source_references;
create policy "Workspace admins can delete organization source references"
on public.source_references
for delete
to authenticated
using (
  scope = 'organization'
  and organization_id is not null
  and public.can_manage_org(organization_id)
);

drop policy if exists "Authenticated users can read visible source reference links" on public.source_reference_links;
create policy "Authenticated users can read visible source reference links"
on public.source_reference_links
for select
to authenticated
using (
  (
    organization_id is null
    and exists (
      select 1
      from public.source_references source
      where source.id = source_reference_links.source_reference_id
        and source.scope = 'platform'
        and source.organization_id is null
    )
  )
  or (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
);

drop policy if exists "Workspace admins can create organization source reference links" on public.source_reference_links;
create policy "Workspace admins can create organization source reference links"
on public.source_reference_links
for insert
to authenticated
with check (
  organization_id is not null
  and public.can_manage_org(organization_id)
  and (created_by is null or created_by = auth.uid())
  and exists (
    select 1
    from public.source_references source
    where source.id = source_reference_links.source_reference_id
      and (
        (source.scope = 'platform' and source.organization_id is null)
        or (
          source.scope = 'organization'
          and source.organization_id = source_reference_links.organization_id
        )
      )
  )
);

drop policy if exists "Workspace admins can delete organization source reference links" on public.source_reference_links;
create policy "Workspace admins can delete organization source reference links"
on public.source_reference_links
for delete
to authenticated
using (
  organization_id is not null
  and public.can_manage_org(organization_id)
);

grant select, insert, update, delete
on table public.business_profiles,
  public.contacts,
  public.invoices,
  public.invoice_lines,
  public.invoice_taxes,
  public.invoice_allowances,
  public.invoice_charges,
  public.invoice_attachments,
  public.source_references,
  public.source_reference_links
to authenticated;

grant select
on table public.security_events
to authenticated;

grant select, insert, update, delete
on table public.business_profiles,
  public.contacts,
  public.invoices,
  public.invoice_lines,
  public.invoice_taxes,
  public.invoice_allowances,
  public.invoice_charges,
  public.invoice_attachments,
  public.security_events,
  public.source_references,
  public.source_reference_links
to service_role;

comment on table public.business_profiles is
'Workspace-owned reusable seller and buyer business profile records. Bank details are intentionally limited to safe labels and last-four style metadata.';

comment on table public.contacts is
'Workspace-owned contact records that may contain personal data. Access is tenant-scoped and role-limited.';

comment on table public.invoices is
'Production invoice records that coexist with invoice_drafts. These are independent technical sandbox records and do not represent official filing, authority acceptance, certified Peppol compliance, tax compliance, or legal advice.';

comment on table public.invoice_attachments is
'Attachment metadata for supporting evidence, source XML, and generated outputs. Scanned PDFs and images are not primary e-invoice validation truth.';

comment on table public.security_events is
'Security-sensitive audit stream. Store hashed IP data and safe metadata only; never store raw API keys, key hashes, secrets, request bodies, or raw XML payloads.';

comment on table public.source_references is
'Source register for source-linked validation and simulation foundations. Platform sources are backend-managed until an admin console exists; organization sources are tenant-scoped.';

comment on table public.source_reference_links is
'Generic links from invoices, validation findings, rules, country packs, and future reports to source references.';

commit;
