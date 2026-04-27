create table if not exists public.xml_readiness_monetary_totals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  xml_readiness_report_id uuid not null references public.xml_readiness_reports(id) on delete cascade,
  line_extension_amount text not null default '',
  tax_exclusive_amount text not null default '',
  tax_amount text not null default '',
  tax_inclusive_amount text not null default '',
  payable_amount text not null default '',
  currency text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (xml_readiness_report_id)
);

create table if not exists public.xml_readiness_tax_signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  xml_readiness_report_id uuid not null references public.xml_readiness_reports(id) on delete cascade,
  tax_total_detected boolean not null default false,
  tax_subtotal_detected boolean not null default false,
  tax_category_detected boolean not null default false,
  tax_rate_count integer not null default 0,
  tax_category_codes jsonb not null default '[]'::jsonb,
  vat_percent_values jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (xml_readiness_report_id)
);

create table if not exists public.xml_readiness_profile_signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  xml_readiness_report_id uuid not null references public.xml_readiness_reports(id) on delete cascade,
  customization_id text not null default '',
  profile_id text not null default '',
  profile_hints jsonb not null default '[]'::jsonb,
  ubl_namespace_detected boolean not null default false,
  ubl_document_detected boolean not null default false,
  peppol_signal_detected boolean not null default false,
  en16931_signal_detected boolean not null default false,
  endpoint_count integer not null default 0,
  seller_endpoint_id text not null default '',
  seller_endpoint_scheme text not null default '',
  buyer_endpoint_id text not null default '',
  buyer_endpoint_scheme text not null default '',
  seller_country text not null default '',
  buyer_country text not null default '',
  country_pair text not null default '',
  cross_border_signal boolean not null default false,
  payment_means_detected boolean not null default false,
  payment_terms_detected boolean not null default false,
  allowance_charge_detected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (xml_readiness_report_id)
);

create table if not exists public.xml_readiness_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  xml_readiness_report_id uuid not null references public.xml_readiness_reports(id) on delete cascade,
  finding_position integer not null check (finding_position >= 1),
  code text not null default '',
  severity text not null check (severity in ('info', 'warning', 'fatal')),
  field_path text not null default '',
  message text not null default '',
  confidence text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (xml_readiness_report_id, finding_position)
);

create index if not exists xml_readiness_monetary_totals_org_idx
  on public.xml_readiness_monetary_totals(organization_id);

create index if not exists xml_readiness_monetary_totals_report_idx
  on public.xml_readiness_monetary_totals(xml_readiness_report_id);

create index if not exists xml_readiness_tax_signals_org_idx
  on public.xml_readiness_tax_signals(organization_id);

create index if not exists xml_readiness_tax_signals_report_idx
  on public.xml_readiness_tax_signals(xml_readiness_report_id);

create index if not exists xml_readiness_profile_signals_org_idx
  on public.xml_readiness_profile_signals(organization_id);

create index if not exists xml_readiness_profile_signals_report_idx
  on public.xml_readiness_profile_signals(xml_readiness_report_id);

create index if not exists xml_readiness_profile_signals_profile_idx
  on public.xml_readiness_profile_signals(
    organization_id,
    peppol_signal_detected,
    en16931_signal_detected,
    cross_border_signal
  );

create index if not exists xml_readiness_findings_org_idx
  on public.xml_readiness_findings(organization_id);

create index if not exists xml_readiness_findings_report_idx
  on public.xml_readiness_findings(xml_readiness_report_id);

create index if not exists xml_readiness_findings_severity_idx
  on public.xml_readiness_findings(organization_id, severity);

create index if not exists xml_readiness_findings_code_idx
  on public.xml_readiness_findings(organization_id, code);

alter table public.xml_readiness_monetary_totals enable row level security;
alter table public.xml_readiness_tax_signals enable row level security;
alter table public.xml_readiness_profile_signals enable row level security;
alter table public.xml_readiness_findings enable row level security;

drop policy if exists "Members can read XML monetary totals"
  on public.xml_readiness_monetary_totals;

create policy "Members can read XML monetary totals"
  on public.xml_readiness_monetary_totals
  for select
  using (public.is_org_member(organization_id));

drop policy if exists "Members can insert XML monetary totals"
  on public.xml_readiness_monetary_totals;

create policy "Members can insert XML monetary totals"
  on public.xml_readiness_monetary_totals
  for insert
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can update XML monetary totals"
  on public.xml_readiness_monetary_totals;

create policy "Members can update XML monetary totals"
  on public.xml_readiness_monetary_totals
  for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can delete XML monetary totals"
  on public.xml_readiness_monetary_totals;

create policy "Members can delete XML monetary totals"
  on public.xml_readiness_monetary_totals
  for delete
  using (public.is_org_member(organization_id));

drop policy if exists "Members can read XML tax signals"
  on public.xml_readiness_tax_signals;

create policy "Members can read XML tax signals"
  on public.xml_readiness_tax_signals
  for select
  using (public.is_org_member(organization_id));

drop policy if exists "Members can insert XML tax signals"
  on public.xml_readiness_tax_signals;

create policy "Members can insert XML tax signals"
  on public.xml_readiness_tax_signals
  for insert
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can update XML tax signals"
  on public.xml_readiness_tax_signals;

create policy "Members can update XML tax signals"
  on public.xml_readiness_tax_signals
  for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can delete XML tax signals"
  on public.xml_readiness_tax_signals;

create policy "Members can delete XML tax signals"
  on public.xml_readiness_tax_signals
  for delete
  using (public.is_org_member(organization_id));

drop policy if exists "Members can read XML profile signals"
  on public.xml_readiness_profile_signals;

create policy "Members can read XML profile signals"
  on public.xml_readiness_profile_signals
  for select
  using (public.is_org_member(organization_id));

drop policy if exists "Members can insert XML profile signals"
  on public.xml_readiness_profile_signals;

create policy "Members can insert XML profile signals"
  on public.xml_readiness_profile_signals
  for insert
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can update XML profile signals"
  on public.xml_readiness_profile_signals;

create policy "Members can update XML profile signals"
  on public.xml_readiness_profile_signals
  for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can delete XML profile signals"
  on public.xml_readiness_profile_signals;

create policy "Members can delete XML profile signals"
  on public.xml_readiness_profile_signals
  for delete
  using (public.is_org_member(organization_id));

drop policy if exists "Members can read XML findings"
  on public.xml_readiness_findings;

create policy "Members can read XML findings"
  on public.xml_readiness_findings
  for select
  using (public.is_org_member(organization_id));

drop policy if exists "Members can insert XML findings"
  on public.xml_readiness_findings;

create policy "Members can insert XML findings"
  on public.xml_readiness_findings
  for insert
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can update XML findings"
  on public.xml_readiness_findings;

create policy "Members can update XML findings"
  on public.xml_readiness_findings
  for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can delete XML findings"
  on public.xml_readiness_findings;

create policy "Members can delete XML findings"
  on public.xml_readiness_findings
  for delete
  using (public.is_org_member(organization_id));

grant select, insert, update, delete
on table public.xml_readiness_monetary_totals
to authenticated;

grant select, insert, update, delete
on table public.xml_readiness_tax_signals
to authenticated;

grant select, insert, update, delete
on table public.xml_readiness_profile_signals
to authenticated;

grant select, insert, update, delete
on table public.xml_readiness_findings
to authenticated;
