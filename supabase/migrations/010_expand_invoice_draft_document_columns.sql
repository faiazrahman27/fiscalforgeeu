alter table public.invoice_drafts
add column if not exists due_date text not null default '',
add column if not exists invoice_type text not null default '',
add column if not exists profile text not null default '',
add column if not exists buyer_reference text not null default '',
add column if not exists contract_reference text not null default '',
add column if not exists line_extension_amount text not null default '',
add column if not exists tax_exclusive_amount text not null default '',
add column if not exists tax_amount text not null default '',
add column if not exists tax_inclusive_amount text not null default '';

update public.invoice_drafts
set
  due_date = case
    when trim(coalesce(due_date, '')) = ''
      then coalesce(nullif(trim(payload #>> '{document,dueDate}'), ''), due_date)
    else due_date
  end,
  invoice_type = case
    when trim(coalesce(invoice_type, '')) = ''
      then coalesce(nullif(trim(payload #>> '{document,invoiceType}'), ''), invoice_type)
    else invoice_type
  end,
  profile = case
    when trim(coalesce(profile, '')) = ''
      then coalesce(nullif(trim(payload #>> '{document,profile}'), ''), profile)
    else profile
  end,
  buyer_reference = case
    when trim(coalesce(buyer_reference, '')) = ''
      then coalesce(nullif(trim(payload #>> '{document,buyerReference}'), ''), buyer_reference)
    else buyer_reference
  end,
  contract_reference = case
    when trim(coalesce(contract_reference, '')) = ''
      then coalesce(nullif(trim(payload #>> '{document,contractReference}'), ''), contract_reference)
    else contract_reference
  end,
  line_extension_amount = case
    when trim(coalesce(line_extension_amount, '')) = ''
      then coalesce(nullif(trim(payload #>> '{totals,lineExtensionAmount}'), ''), line_extension_amount)
    else line_extension_amount
  end,
  tax_exclusive_amount = case
    when trim(coalesce(tax_exclusive_amount, '')) = ''
      then coalesce(nullif(trim(payload #>> '{totals,taxExclusiveAmount}'), ''), tax_exclusive_amount)
    else tax_exclusive_amount
  end,
  tax_amount = case
    when trim(coalesce(tax_amount, '')) = ''
      then coalesce(nullif(trim(payload #>> '{totals,taxAmount}'), ''), tax_amount)
    else tax_amount
  end,
  tax_inclusive_amount = case
    when trim(coalesce(tax_inclusive_amount, '')) = ''
      then coalesce(nullif(trim(payload #>> '{totals,taxInclusiveAmount}'), ''), tax_inclusive_amount)
    else tax_inclusive_amount
  end
where payload is not null;

create index if not exists invoice_drafts_due_date_idx
  on public.invoice_drafts(organization_id, due_date);

create index if not exists invoice_drafts_invoice_type_idx
  on public.invoice_drafts(organization_id, invoice_type);

create index if not exists invoice_drafts_profile_idx
  on public.invoice_drafts(organization_id, profile);
