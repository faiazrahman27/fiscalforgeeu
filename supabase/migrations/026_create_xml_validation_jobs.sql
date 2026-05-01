create table if not exists public.xml_validation_jobs (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id) on delete cascade,

  xml_readiness_report_id uuid
    references public.xml_readiness_reports(id) on delete set null,

  invoice_draft_id uuid
    references public.invoice_drafts(id) on delete set null,

  validation_run_id uuid
    references public.validation_runs(id) on delete set null,

  source_type text not null default 'uploaded_xml'
    check (source_type in ('uploaded_xml', 'pasted_xml', 'generated_ubl', 'api_payload')),

  document_type text,
  filename text,
  xml_sha256 text not null,
  xml_size_bytes integer not null
    check (xml_size_bytes >= 0),

  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),

  requested_checks text[] not null default '{}',
  completed_checks text[] not null default '{}',
  failed_checks text[] not null default '{}',

  worker_name text,
  worker_version text,

  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,

  error_code text,
  error_message text,

  result_summary jsonb not null default '{}'::jsonb,
  findings jsonb not null default '[]'::jsonb,

  disclaimer text not null,

  created_by uuid
    references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists xml_validation_jobs_organization_id_idx
on public.xml_validation_jobs (organization_id);

create index if not exists xml_validation_jobs_status_idx
on public.xml_validation_jobs (status);

create index if not exists xml_validation_jobs_created_at_desc_idx
on public.xml_validation_jobs (created_at desc);

create index if not exists xml_validation_jobs_xml_sha256_idx
on public.xml_validation_jobs (xml_sha256);

create index if not exists xml_validation_jobs_xml_readiness_report_id_idx
on public.xml_validation_jobs (xml_readiness_report_id);

create index if not exists xml_validation_jobs_invoice_draft_id_idx
on public.xml_validation_jobs (invoice_draft_id);

create index if not exists xml_validation_jobs_validation_run_id_idx
on public.xml_validation_jobs (validation_run_id);

drop trigger if exists set_xml_validation_jobs_updated_at on public.xml_validation_jobs;
create trigger set_xml_validation_jobs_updated_at
before update on public.xml_validation_jobs
for each row
execute function public.set_updated_at();

alter table public.xml_validation_jobs enable row level security;

drop policy if exists "Members can read XML validation jobs"
on public.xml_validation_jobs;

create policy "Members can read XML validation jobs"
on public.xml_validation_jobs
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Members can create XML validation jobs"
on public.xml_validation_jobs;

create policy "Members can create XML validation jobs"
on public.xml_validation_jobs
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and (
    created_by is null
    or created_by = auth.uid()
  )
);

drop policy if exists "Creators or admins can update XML validation jobs"
on public.xml_validation_jobs;

create policy "Creators or admins can update XML validation jobs"
on public.xml_validation_jobs
for update
to authenticated
using (
  public.is_org_admin_or_owner(organization_id)
  or created_by = auth.uid()
)
with check (
  public.is_org_admin_or_owner(organization_id)
  or created_by = auth.uid()
);

grant select, insert, update
on table public.xml_validation_jobs
to authenticated;
