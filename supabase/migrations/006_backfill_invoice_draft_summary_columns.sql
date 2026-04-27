update public.invoice_drafts
set
  seller_name = case
    when trim(coalesce(seller_name, '')) = ''
      then coalesce(nullif(trim(payload #>> '{seller,name}'), ''), seller_name)
    else seller_name
  end,
  seller_country = case
    when trim(coalesce(seller_country, '')) = ''
      then coalesce(nullif(trim(payload #>> '{seller,country}'), ''), seller_country)
    else seller_country
  end,
  issue_date = case
    when trim(coalesce(issue_date, '')) = ''
      then coalesce(nullif(trim(payload #>> '{document,issueDate}'), ''), issue_date)
    else issue_date
  end
where payload is not null;
