create table if not exists public.vat_number_checks (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id) on delete cascade,

  invoice_draft_id uuid
    references public.invoice_drafts(id) on delete set null,

  validation_run_id uuid
    references public.validation_runs(id) on delete set null,

  party_role text
    check (party_role is null or party_role in ('seller', 'buyer', 'other')),

  input_country_hint text,
  detected_country_code text,

  normalized_vat_id text not null,

  vat_id_fingerprint text not null
    check (vat_id_fingerprint ~ '^[a-f0-9]{64}$'),

  check_level text not null default 'local_format'
    check (check_level in ('local_format')),

  source text not null default 'invoice_lantern_vat_format_rules'
    check (source in ('invoice_lantern_vat_format_rules')),

  format_valid boolean not null,

  message text not null
    check (char_length(trim(message)) >= 1),

  warnings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(warnings) = 'array'),

  disclaimer text not null
    check (char_length(trim(disclaimer)) >= 1),

  checked_by uuid
    references auth.users(id) on delete set null,

  created_at timestamptz not null default now()
);

create index if not exists vat_number_checks_organization_id_idx
on public.vat_number_checks (organization_id);

create index if not exists vat_number_checks_invoice_draft_id_idx
on public.vat_number_checks (invoice_draft_id);

create index if not exists vat_number_checks_validation_run_id_idx
on public.vat_number_checks (validation_run_id);

create index if not exists vat_number_checks_detected_country_code_idx
on public.vat_number_checks (detected_country_code);

create index if not exists vat_number_checks_format_valid_idx
on public.vat_number_checks (format_valid);

create index if not exists vat_number_checks_created_at_desc_idx
on public.vat_number_checks (created_at desc);

create index if not exists vat_number_checks_vat_id_fingerprint_idx
on public.vat_number_checks (vat_id_fingerprint);

alter table public.vat_number_checks enable row level security;

drop policy if exists "Workspace members can read VAT number checks"
on public.vat_number_checks;

create policy "Workspace members can read VAT number checks"
on public.vat_number_checks
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Workspace members can create VAT number checks"
on public.vat_number_checks;

create policy "Workspace members can create VAT number checks"
on public.vat_number_checks
for insert
to authenticated
with check (
  checked_by = auth.uid()
  and public.is_org_member(organization_id)
  and (
    invoice_draft_id is null
    or exists (
      select 1
      from public.invoice_drafts draft
      where draft.id = vat_number_checks.invoice_draft_id
        and draft.organization_id = vat_number_checks.organization_id
    )
  )
  and (
    validation_run_id is null
    or exists (
      select 1
      from public.validation_runs run
      where run.id = vat_number_checks.validation_run_id
        and run.organization_id = vat_number_checks.organization_id
    )
  )
);

drop policy if exists "Workspace admins can delete VAT number checks"
on public.vat_number_checks;

create policy "Workspace admins can delete VAT number checks"
on public.vat_number_checks
for delete
to authenticated
using (public.is_org_admin_or_owner(organization_id));

grant select, insert, delete on public.vat_number_checks to authenticated;
