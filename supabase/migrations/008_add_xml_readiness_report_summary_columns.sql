alter table public.xml_readiness_reports
add column if not exists status text not null default '',
add column if not exists note text not null default '',
add column if not exists findings_count integer not null default 0,
add column if not exists seller_name text not null default '',
add column if not exists buyer_name text not null default '',
add column if not exists line_count integer not null default 0,
add column if not exists payable_amount text not null default '',
add column if not exists tax_amount text not null default '';

create index if not exists xml_readiness_reports_invoice_id_idx
  on public.xml_readiness_reports(organization_id, invoice_id);

create index if not exists xml_readiness_reports_issue_date_idx
  on public.xml_readiness_reports(organization_id, issue_date);

create index if not exists xml_readiness_reports_status_idx
  on public.xml_readiness_reports(organization_id, status);

create index if not exists xml_readiness_reports_readiness_status_idx
  on public.xml_readiness_reports(organization_id, readiness_status);

create index if not exists xml_readiness_reports_document_status_idx
  on public.xml_readiness_reports(organization_id, document_status);
