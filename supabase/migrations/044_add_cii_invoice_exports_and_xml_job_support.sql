/*
  Adds additive technical CII support for Invoice Lantern export metadata and
  XML validation job source labels. This does not create official CII
  certification, EN 16931 certification, Peppol certification, legal/tax/
  accounting compliance, official filing, or authority acceptance.
*/

do $$
declare
  constraint_name text;
begin
  select con.conname
    into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'invoice_exports'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%export_type%'
  limit 1;

  if constraint_name is not null then
    execute format(
      'alter table public.invoice_exports drop constraint %I',
      constraint_name
    );
  end if;
end $$;

alter table public.invoice_exports
add constraint invoice_exports_export_type_check
check (export_type in ('ubl_invoice', 'cii_invoice'));

do $$
declare
  constraint_name text;
begin
  select con.conname
    into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'xml_validation_jobs'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%source_type%'
  limit 1;

  if constraint_name is not null then
    execute format(
      'alter table public.xml_validation_jobs drop constraint %I',
      constraint_name
    );
  end if;
end $$;

alter table public.xml_validation_jobs
add constraint xml_validation_jobs_source_type_check
check (
  source_type in (
    'uploaded_xml',
    'pasted_xml',
    'generated_ubl',
    'generated_cii',
    'api_payload'
  )
);
