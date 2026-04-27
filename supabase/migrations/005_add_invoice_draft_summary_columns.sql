alter table public.invoice_drafts
add column if not exists seller_name text not null default '',
add column if not exists seller_country text not null default '',
add column if not exists issue_date text not null default '';

create index if not exists invoice_drafts_seller_country_idx
  on public.invoice_drafts(organization_id, seller_country);

create index if not exists invoice_drafts_buyer_country_idx
  on public.invoice_drafts(organization_id, buyer_country);

create index if not exists invoice_drafts_issue_date_idx
  on public.invoice_drafts(organization_id, issue_date);
