-- Invoice Lantern
-- Migration 033: harden workspace authorization boundaries.
--
-- This migration aligns RLS backstops with the expanded workspace role model
-- from migration 032. It is intentionally additive: no prior migrations are
-- rewritten, tenant data is preserved, and organization ownership remains the
-- core isolation boundary.

begin;

/* API key metadata and API request logs */

drop policy if exists "Workspace admins can read API key metadata"
on public.api_keys;

create policy "Workspace admins can read API key metadata"
on public.api_keys
for select
to authenticated
using (public.can_manage_api_keys(organization_id));

drop policy if exists "Workspace admins can create API keys"
on public.api_keys;

create policy "Workspace admins can create API keys"
on public.api_keys
for insert
to authenticated
with check (
  public.can_manage_api_keys(organization_id)
  and (
    created_by is null
    or created_by = auth.uid()
  )
);

drop policy if exists "Workspace admins can update API keys"
on public.api_keys;

create policy "Workspace admins can update API keys"
on public.api_keys
for update
to authenticated
using (public.can_manage_api_keys(organization_id))
with check (public.can_manage_api_keys(organization_id));

drop policy if exists "Workspace admins can read API request logs"
on public.api_requests;

create policy "Workspace admins can read API request logs"
on public.api_requests
for select
to authenticated
using (
  organization_id is not null
  and public.can_view_audit_logs(organization_id)
);

/* Invoice drafts and relational draft details */

drop policy if exists "invoice_drafts_insert_members"
on public.invoice_drafts;

create policy "invoice_drafts_insert_members"
on public.invoice_drafts
for insert
to authenticated
with check (
  public.can_create_invoice(organization_id)
  and created_by = auth.uid()
);

drop policy if exists "invoice_drafts_update_members"
on public.invoice_drafts;

create policy "invoice_drafts_update_members"
on public.invoice_drafts
for update
to authenticated
using (public.can_create_invoice(organization_id))
with check (public.can_create_invoice(organization_id));

drop policy if exists "Members can insert invoice draft parties"
on public.invoice_draft_parties;

create policy "Members can insert invoice draft parties"
on public.invoice_draft_parties
for insert
to authenticated
with check (
  public.can_create_invoice(organization_id)
  and exists (
    select 1
    from public.invoice_drafts draft
    where draft.id = invoice_draft_parties.invoice_draft_id
      and draft.organization_id = invoice_draft_parties.organization_id
  )
);

drop policy if exists "Members can update invoice draft parties"
on public.invoice_draft_parties;

create policy "Members can update invoice draft parties"
on public.invoice_draft_parties
for update
to authenticated
using (public.can_create_invoice(organization_id))
with check (
  public.can_create_invoice(organization_id)
  and exists (
    select 1
    from public.invoice_drafts draft
    where draft.id = invoice_draft_parties.invoice_draft_id
      and draft.organization_id = invoice_draft_parties.organization_id
  )
);

drop policy if exists "Members can delete invoice draft parties"
on public.invoice_draft_parties;

create policy "Members can delete invoice draft parties"
on public.invoice_draft_parties
for delete
to authenticated
using (public.can_create_invoice(organization_id));

drop policy if exists "Members can insert invoice draft lines"
on public.invoice_draft_lines;

create policy "Members can insert invoice draft lines"
on public.invoice_draft_lines
for insert
to authenticated
with check (
  public.can_create_invoice(organization_id)
  and exists (
    select 1
    from public.invoice_drafts draft
    where draft.id = invoice_draft_lines.invoice_draft_id
      and draft.organization_id = invoice_draft_lines.organization_id
  )
);

drop policy if exists "Members can update invoice draft lines"
on public.invoice_draft_lines;

create policy "Members can update invoice draft lines"
on public.invoice_draft_lines
for update
to authenticated
using (public.can_create_invoice(organization_id))
with check (
  public.can_create_invoice(organization_id)
  and exists (
    select 1
    from public.invoice_drafts draft
    where draft.id = invoice_draft_lines.invoice_draft_id
      and draft.organization_id = invoice_draft_lines.organization_id
  )
);

drop policy if exists "Members can delete invoice draft lines"
on public.invoice_draft_lines;

create policy "Members can delete invoice draft lines"
on public.invoice_draft_lines
for delete
to authenticated
using (public.can_create_invoice(organization_id));

drop policy if exists "Members can insert invoice draft tax summaries"
on public.invoice_draft_tax_summaries;

create policy "Members can insert invoice draft tax summaries"
on public.invoice_draft_tax_summaries
for insert
to authenticated
with check (
  public.can_create_invoice(organization_id)
  and exists (
    select 1
    from public.invoice_drafts draft
    where draft.id = invoice_draft_tax_summaries.invoice_draft_id
      and draft.organization_id = invoice_draft_tax_summaries.organization_id
  )
);

drop policy if exists "Members can update invoice draft tax summaries"
on public.invoice_draft_tax_summaries;

create policy "Members can update invoice draft tax summaries"
on public.invoice_draft_tax_summaries
for update
to authenticated
using (public.can_create_invoice(organization_id))
with check (
  public.can_create_invoice(organization_id)
  and exists (
    select 1
    from public.invoice_drafts draft
    where draft.id = invoice_draft_tax_summaries.invoice_draft_id
      and draft.organization_id = invoice_draft_tax_summaries.organization_id
  )
);

drop policy if exists "Members can delete invoice draft tax summaries"
on public.invoice_draft_tax_summaries;

create policy "Members can delete invoice draft tax summaries"
on public.invoice_draft_tax_summaries
for delete
to authenticated
using (public.can_create_invoice(organization_id));

/* Validation runs and relational validation details */

drop policy if exists "validation_runs_insert_members"
on public.validation_runs;

create policy "validation_runs_insert_members"
on public.validation_runs
for insert
to authenticated
with check (
  public.can_validate_invoice(organization_id)
  and created_by = auth.uid()
);

drop policy if exists "Members can insert validation run totals"
on public.validation_run_totals;

create policy "Members can insert validation run totals"
on public.validation_run_totals
for insert
to authenticated
with check (
  public.can_validate_invoice(organization_id)
  and exists (
    select 1
    from public.validation_runs run
    where run.id = validation_run_totals.validation_run_id
      and run.organization_id = validation_run_totals.organization_id
  )
);

drop policy if exists "Members can update validation run totals"
on public.validation_run_totals;

create policy "Members can update validation run totals"
on public.validation_run_totals
for update
to authenticated
using (public.can_validate_invoice(organization_id))
with check (
  public.can_validate_invoice(organization_id)
  and exists (
    select 1
    from public.validation_runs run
    where run.id = validation_run_totals.validation_run_id
      and run.organization_id = validation_run_totals.organization_id
  )
);

drop policy if exists "Members can delete validation run totals"
on public.validation_run_totals;

create policy "Members can delete validation run totals"
on public.validation_run_totals
for delete
to authenticated
using (public.can_validate_invoice(organization_id));

drop policy if exists "Members can insert validation run findings"
on public.validation_run_findings;

create policy "Members can insert validation run findings"
on public.validation_run_findings
for insert
to authenticated
with check (
  public.can_validate_invoice(organization_id)
  and exists (
    select 1
    from public.validation_runs run
    where run.id = validation_run_findings.validation_run_id
      and run.organization_id = validation_run_findings.organization_id
  )
);

drop policy if exists "Members can update validation run findings"
on public.validation_run_findings;

create policy "Members can update validation run findings"
on public.validation_run_findings
for update
to authenticated
using (public.can_validate_invoice(organization_id))
with check (
  public.can_validate_invoice(organization_id)
  and exists (
    select 1
    from public.validation_runs run
    where run.id = validation_run_findings.validation_run_id
      and run.organization_id = validation_run_findings.organization_id
  )
);

drop policy if exists "Members can delete validation run findings"
on public.validation_run_findings;

create policy "Members can delete validation run findings"
on public.validation_run_findings
for delete
to authenticated
using (public.can_validate_invoice(organization_id));

/* XML readiness reports, relational XML details, and XML validation jobs */

drop policy if exists "xml_reports_insert_members"
on public.xml_readiness_reports;

create policy "xml_reports_insert_members"
on public.xml_readiness_reports
for insert
to authenticated
with check (
  public.can_validate_invoice(organization_id)
  and created_by = auth.uid()
);

drop policy if exists "Members can insert XML monetary totals"
on public.xml_readiness_monetary_totals;

create policy "Members can insert XML monetary totals"
on public.xml_readiness_monetary_totals
for insert
to authenticated
with check (
  public.can_validate_invoice(organization_id)
  and exists (
    select 1
    from public.xml_readiness_reports report
    where report.id = xml_readiness_monetary_totals.xml_readiness_report_id
      and report.organization_id = xml_readiness_monetary_totals.organization_id
  )
);

drop policy if exists "Members can update XML monetary totals"
on public.xml_readiness_monetary_totals;

create policy "Members can update XML monetary totals"
on public.xml_readiness_monetary_totals
for update
to authenticated
using (public.can_validate_invoice(organization_id))
with check (
  public.can_validate_invoice(organization_id)
  and exists (
    select 1
    from public.xml_readiness_reports report
    where report.id = xml_readiness_monetary_totals.xml_readiness_report_id
      and report.organization_id = xml_readiness_monetary_totals.organization_id
  )
);

drop policy if exists "Members can delete XML monetary totals"
on public.xml_readiness_monetary_totals;

create policy "Members can delete XML monetary totals"
on public.xml_readiness_monetary_totals
for delete
to authenticated
using (public.can_validate_invoice(organization_id));

drop policy if exists "Members can insert XML tax signals"
on public.xml_readiness_tax_signals;

create policy "Members can insert XML tax signals"
on public.xml_readiness_tax_signals
for insert
to authenticated
with check (
  public.can_validate_invoice(organization_id)
  and exists (
    select 1
    from public.xml_readiness_reports report
    where report.id = xml_readiness_tax_signals.xml_readiness_report_id
      and report.organization_id = xml_readiness_tax_signals.organization_id
  )
);

drop policy if exists "Members can update XML tax signals"
on public.xml_readiness_tax_signals;

create policy "Members can update XML tax signals"
on public.xml_readiness_tax_signals
for update
to authenticated
using (public.can_validate_invoice(organization_id))
with check (
  public.can_validate_invoice(organization_id)
  and exists (
    select 1
    from public.xml_readiness_reports report
    where report.id = xml_readiness_tax_signals.xml_readiness_report_id
      and report.organization_id = xml_readiness_tax_signals.organization_id
  )
);

drop policy if exists "Members can delete XML tax signals"
on public.xml_readiness_tax_signals;

create policy "Members can delete XML tax signals"
on public.xml_readiness_tax_signals
for delete
to authenticated
using (public.can_validate_invoice(organization_id));

drop policy if exists "Members can insert XML profile signals"
on public.xml_readiness_profile_signals;

create policy "Members can insert XML profile signals"
on public.xml_readiness_profile_signals
for insert
to authenticated
with check (
  public.can_validate_invoice(organization_id)
  and exists (
    select 1
    from public.xml_readiness_reports report
    where report.id = xml_readiness_profile_signals.xml_readiness_report_id
      and report.organization_id = xml_readiness_profile_signals.organization_id
  )
);

drop policy if exists "Members can update XML profile signals"
on public.xml_readiness_profile_signals;

create policy "Members can update XML profile signals"
on public.xml_readiness_profile_signals
for update
to authenticated
using (public.can_validate_invoice(organization_id))
with check (
  public.can_validate_invoice(organization_id)
  and exists (
    select 1
    from public.xml_readiness_reports report
    where report.id = xml_readiness_profile_signals.xml_readiness_report_id
      and report.organization_id = xml_readiness_profile_signals.organization_id
  )
);

drop policy if exists "Members can delete XML profile signals"
on public.xml_readiness_profile_signals;

create policy "Members can delete XML profile signals"
on public.xml_readiness_profile_signals
for delete
to authenticated
using (public.can_validate_invoice(organization_id));

drop policy if exists "Members can insert XML findings"
on public.xml_readiness_findings;

create policy "Members can insert XML findings"
on public.xml_readiness_findings
for insert
to authenticated
with check (
  public.can_validate_invoice(organization_id)
  and exists (
    select 1
    from public.xml_readiness_reports report
    where report.id = xml_readiness_findings.xml_readiness_report_id
      and report.organization_id = xml_readiness_findings.organization_id
  )
);

drop policy if exists "Members can update XML findings"
on public.xml_readiness_findings;

create policy "Members can update XML findings"
on public.xml_readiness_findings
for update
to authenticated
using (public.can_validate_invoice(organization_id))
with check (
  public.can_validate_invoice(organization_id)
  and exists (
    select 1
    from public.xml_readiness_reports report
    where report.id = xml_readiness_findings.xml_readiness_report_id
      and report.organization_id = xml_readiness_findings.organization_id
  )
);

drop policy if exists "Members can delete XML findings"
on public.xml_readiness_findings;

create policy "Members can delete XML findings"
on public.xml_readiness_findings
for delete
to authenticated
using (public.can_validate_invoice(organization_id));

drop policy if exists "Members can create XML validation jobs"
on public.xml_validation_jobs;

create policy "Members can create XML validation jobs"
on public.xml_validation_jobs
for insert
to authenticated
with check (
  public.can_validate_invoice(organization_id)
  and (
    created_by is null
    or created_by = auth.uid()
  )
  and (
    xml_readiness_report_id is null
    or exists (
      select 1
      from public.xml_readiness_reports report
      where report.id = xml_validation_jobs.xml_readiness_report_id
        and report.organization_id = xml_validation_jobs.organization_id
    )
  )
  and (
    invoice_draft_id is null
    or exists (
      select 1
      from public.invoice_drafts draft
      where draft.id = xml_validation_jobs.invoice_draft_id
        and draft.organization_id = xml_validation_jobs.organization_id
    )
  )
  and (
    validation_run_id is null
    or exists (
      select 1
      from public.validation_runs run
      where run.id = xml_validation_jobs.validation_run_id
        and run.organization_id = xml_validation_jobs.organization_id
    )
  )
);

drop policy if exists "Creators or admins can update XML validation jobs"
on public.xml_validation_jobs;

create policy "Creators or admins can update XML validation jobs"
on public.xml_validation_jobs
for update
to authenticated
using (
  public.can_manage_org(organization_id)
  or (
    public.can_validate_invoice(organization_id)
    and created_by = auth.uid()
  )
)
with check (
  (
    public.can_manage_org(organization_id)
    or (
      public.can_validate_invoice(organization_id)
      and created_by = auth.uid()
    )
  )
  and (
    xml_readiness_report_id is null
    or exists (
      select 1
      from public.xml_readiness_reports report
      where report.id = xml_validation_jobs.xml_readiness_report_id
        and report.organization_id = xml_validation_jobs.organization_id
    )
  )
  and (
    invoice_draft_id is null
    or exists (
      select 1
      from public.invoice_drafts draft
      where draft.id = xml_validation_jobs.invoice_draft_id
        and draft.organization_id = xml_validation_jobs.organization_id
    )
  )
  and (
    validation_run_id is null
    or exists (
      select 1
      from public.validation_runs run
      where run.id = xml_validation_jobs.validation_run_id
        and run.organization_id = xml_validation_jobs.organization_id
    )
  )
);

/* Export, VAT, and ViDA simulation evidence records */

drop policy if exists "Workspace members can create invoice exports"
on public.invoice_exports;

create policy "Workspace members can create invoice exports"
on public.invoice_exports
for insert
to authenticated
with check (
  generated_by = auth.uid()
  and public.has_org_role(
    organization_id,
    array['owner', 'admin', 'accountant', 'developer']
  )
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
using (public.has_org_role(organization_id, array['owner', 'admin', 'accountant', 'developer']))
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'accountant', 'developer'])
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

drop policy if exists "Workspace members can create VAT number checks"
on public.vat_number_checks;

create policy "Workspace members can create VAT number checks"
on public.vat_number_checks
for insert
to authenticated
with check (
  checked_by = auth.uid()
  and public.can_validate_invoice(organization_id)
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

drop policy if exists "Workspace members can create ViDA simulation runs"
on public.vida_simulation_runs;

create policy "Workspace members can create ViDA simulation runs"
on public.vida_simulation_runs
for insert
to authenticated
with check (
  public.can_validate_invoice(organization_id)
  and (
    created_by is null
    or created_by = auth.uid()
  )
  and (
    invoice_draft_id is null
    or exists (
      select 1
      from public.invoice_drafts draft
      where draft.id = vida_simulation_runs.invoice_draft_id
        and draft.organization_id = vida_simulation_runs.organization_id
    )
  )
  and (
    validation_run_id is null
    or exists (
      select 1
      from public.validation_runs run
      where run.id = vida_simulation_runs.validation_run_id
        and run.organization_id = vida_simulation_runs.organization_id
    )
  )
);

/* Workspace administration, privacy, retention, deletion, and activity */

drop policy if exists "Members can read workspace activity events"
on public.workspace_activity_events;

create policy "Members can read workspace activity events"
on public.workspace_activity_events
for select
to authenticated
using (public.can_view_audit_logs(organization_id));

drop policy if exists "Workspace members can read workspace settings"
on public.workspace_settings;

create policy "Workspace members can read workspace settings"
on public.workspace_settings
for select
to authenticated
using (public.can_manage_org(organization_id));

drop policy if exists "Workspace members can create workspace settings"
on public.workspace_settings;

create policy "Workspace members can create workspace settings"
on public.workspace_settings
for insert
to authenticated
with check (public.can_manage_org(organization_id));

drop policy if exists "Workspace members can update workspace settings"
on public.workspace_settings;

create policy "Workspace members can update workspace settings"
on public.workspace_settings
for update
to authenticated
using (public.can_manage_org(organization_id))
with check (public.can_manage_org(organization_id));

drop policy if exists "Workspace members can read privacy requests"
on public.workspace_privacy_requests;

create policy "Workspace members can read privacy requests"
on public.workspace_privacy_requests
for select
to authenticated
using (public.can_delete_workspace_data(organization_id));

drop policy if exists "Workspace members can create privacy requests"
on public.workspace_privacy_requests;

create policy "Workspace members can create privacy requests"
on public.workspace_privacy_requests
for insert
to authenticated
with check (
  requester_user_id = auth.uid()
  and public.can_delete_workspace_data(organization_id)
);

drop policy if exists "Workspace members can update privacy requests"
on public.workspace_privacy_requests;

create policy "Workspace members can update privacy requests"
on public.workspace_privacy_requests
for update
to authenticated
using (public.can_delete_workspace_data(organization_id))
with check (
  public.can_delete_workspace_data(organization_id)
  and (
    reviewer_user_id is null
    or reviewer_user_id = auth.uid()
  )
);

drop policy if exists "Workspace members can read export packages"
on public.workspace_export_packages;

create policy "Workspace members can read export packages"
on public.workspace_export_packages
for select
to authenticated
using (public.can_delete_workspace_data(organization_id));

drop policy if exists "Workspace members can create export packages"
on public.workspace_export_packages;

create policy "Workspace members can create export packages"
on public.workspace_export_packages
for insert
to authenticated
with check (
  requested_by = auth.uid()
  and public.can_delete_workspace_data(organization_id)
  and (
    source_privacy_request_id is null
    or exists (
      select 1
      from public.workspace_privacy_requests request
      where request.id = workspace_export_packages.source_privacy_request_id
        and request.organization_id = workspace_export_packages.organization_id
    )
  )
);

drop policy if exists "Workspace members can read retention runs"
on public.workspace_retention_runs;

create policy "Workspace members can read retention runs"
on public.workspace_retention_runs
for select
to authenticated
using (public.can_delete_workspace_data(organization_id));

drop policy if exists "Workspace members can create retention runs"
on public.workspace_retention_runs;

create policy "Workspace members can create retention runs"
on public.workspace_retention_runs
for insert
to authenticated
with check (public.can_delete_workspace_data(organization_id));

drop policy if exists "Workspace members can update retention runs"
on public.workspace_retention_runs;

create policy "Workspace members can update retention runs"
on public.workspace_retention_runs
for update
to authenticated
using (public.can_delete_workspace_data(organization_id))
with check (public.can_delete_workspace_data(organization_id));

drop policy if exists "Workspace members can read deletion runs"
on public.workspace_deletion_runs;

create policy "Workspace members can read deletion runs"
on public.workspace_deletion_runs
for select
to authenticated
using (public.can_delete_workspace_data(organization_id));

drop policy if exists "Workspace members can create deletion runs"
on public.workspace_deletion_runs;

create policy "Workspace members can create deletion runs"
on public.workspace_deletion_runs
for insert
to authenticated
with check (
  public.can_delete_workspace_data(organization_id)
  and (
    source_privacy_request_id is null
    or exists (
      select 1
      from public.workspace_privacy_requests request
      where request.id = workspace_deletion_runs.source_privacy_request_id
        and request.organization_id = workspace_deletion_runs.organization_id
    )
  )
);

drop policy if exists "Workspace members can update deletion runs"
on public.workspace_deletion_runs;

create policy "Workspace members can update deletion runs"
on public.workspace_deletion_runs
for update
to authenticated
using (public.can_delete_workspace_data(organization_id))
with check (
  public.can_delete_workspace_data(organization_id)
  and (
    source_privacy_request_id is null
    or exists (
      select 1
      from public.workspace_privacy_requests request
      where request.id = workspace_deletion_runs.source_privacy_request_id
        and request.organization_id = workspace_deletion_runs.organization_id
    )
  )
);

/* Service-role grants for scoped organization API-key persistence paths. */

grant select (id, organization_id)
on table public.invoice_drafts
to service_role;

grant insert, delete
on table public.validation_runs
to service_role;

grant insert, delete
on table public.validation_run_totals
to service_role;

grant insert, delete
on table public.validation_run_findings
to service_role;

grant select, insert
on table public.invoice_exports
to service_role;

grant insert
on table public.workspace_activity_events
to service_role;

comment on table public.api_requests is
'Workspace-owned API request metadata. Store safe operational metadata only; never store full API keys, key hashes, request bodies, raw XML, full VAT identifiers, or private service credentials.';

comment on table public.api_keys is
'Workspace-owned organization API key metadata. Secrets are displayed once at creation and only hashed key material is stored.';

commit;
