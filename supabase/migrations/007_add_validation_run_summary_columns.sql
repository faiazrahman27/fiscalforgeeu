alter table public.validation_runs
add column if not exists profile text not null default '',
add column if not exists issue_date text not null default '',
add column if not exists seller_country text not null default '',
add column if not exists buyer_country text not null default '',
add column if not exists findings_count integer not null default 0,
add column if not exists payable_amount numeric(18, 2) not null default 0;

create index if not exists validation_runs_invoice_number_idx
  on public.validation_runs(organization_id, invoice_number);

create index if not exists validation_runs_issue_date_idx
  on public.validation_runs(organization_id, issue_date);

create index if not exists validation_runs_seller_country_idx
  on public.validation_runs(organization_id, seller_country);

create index if not exists validation_runs_buyer_country_idx
  on public.validation_runs(organization_id, buyer_country);

create index if not exists validation_runs_technical_status_idx
  on public.validation_runs(organization_id, technical_status);

create index if not exists validation_runs_standard_status_idx
  on public.validation_runs(organization_id, standard_status);
