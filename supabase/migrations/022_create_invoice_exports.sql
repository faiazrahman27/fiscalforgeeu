create table if not exists public.invoice_exports (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id) on delete cascade,

  invoice_draft_id uuid
    references public.invoice_drafts(id) on delete set null,

  validation_run_id uuid
    references public.validation_runs(id) on delete set null,

  export_type text not null
    check (export_type in ('ubl_invoice')),

  format text not null
    check (format in ('xml')),

  profile text not null
    check (char_length(trim(profile)) between 1 and 80),

  filename text not null
    check (char_length(trim(filename)) between 1 and 220),

  content_type text not null
    check (char_length(trim(content_type)) between 1 and 120),

  xml_sha256 text not null
    check (xml_sha256 ~ '^[a-f0-9]{64}$'),

  xml_size_bytes integer not null
    check (xml_size_bytes >= 0),

  status text not null default 'generated'
    check (status in ('generated', 'downloaded', 'failed', 'deleted')),

  disclaimer text not null
    check (char_length(trim(disclaimer)) >= 1),

  generated_by uuid
    references auth.users(id) on delete set null,

  created_at timestamptz not null default now()
);

create index if not exists invoice_exports_organization_id_idx
on public.invoice_exports (organization_id);

create index if not exists invoice_exports_invoice_draft_id_idx
on public.invoice_exports (invoice_draft_id);

create index if not exists invoice_exports_validation_run_id_idx
on public.invoice_exports (validation_run_id);

create index if not exists invoice_exports_created_at_desc_idx
on public.invoice_exports (created_at desc);

alter table public.invoice_exports enable row level security;

drop policy if exists "Workspace members can read invoice exports"
on public.invoice_exports;

create policy "Workspace members can read invoice exports"
on public.invoice_exports
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Workspace members can create invoice exports"
on public.invoice_exports;

create policy "Workspace members can create invoice exports"
on public.invoice_exports
for insert
to authenticated
with check (
  generated_by = auth.uid()
  and public.is_org_member(organization_id)
  and (
    invoice_draft_id is null
    or exists (
      select 1
      from public.invoice_drafts draft
      where draft.id = invoice_exports.invoice_draft_id
        and draft.organization_id = invoice_exports.organization_id
    )
  )
  and (
    validation_run_id is null
    or exists (
      select 1
      from public.validation_runs run
      where run.id = invoice_exports.validation_run_id
        and run.organization_id = invoice_exports.organization_id
    )
  )
);

drop policy if exists "Workspace members can update invoice exports"
on public.invoice_exports;

create policy "Workspace members can update invoice exports"
on public.invoice_exports
for update
to authenticated
using (public.is_org_member(organization_id))
with check (
  public.is_org_member(organization_id)
  and (
    invoice_draft_id is null
    or exists (
      select 1
      from public.invoice_drafts draft
      where draft.id = invoice_exports.invoice_draft_id
        and draft.organization_id = invoice_exports.organization_id
    )
  )
  and (
    validation_run_id is null
    or exists (
      select 1
      from public.validation_runs run
      where run.id = invoice_exports.validation_run_id
        and run.organization_id = invoice_exports.organization_id
    )
  )
);

drop policy if exists "Workspace admins can delete invoice exports"
on public.invoice_exports;

create policy "Workspace admins can delete invoice exports"
on public.invoice_exports
for delete
to authenticated
using (public.is_org_admin_or_owner(organization_id));

grant select, insert, update, delete on public.invoice_exports to authenticated;
