-- Invoice Lantern
-- Migration 042: Complete legal/privacy retention and deletion execution.
--
-- This migration is additive. It replaces narrow execution RPC definitions and
-- tightens privacy-management RLS without editing historical migrations. These
-- controls are GDPR-aware support workflows only; they are not legal advice,
-- privacy advice, tax advice, accounting advice, official filing, authority
-- acceptance, or a compliance guarantee.

begin;

drop policy if exists "Workspace members can read privacy requests"
on public.workspace_privacy_requests;

drop policy if exists "Workspace members can create privacy requests"
on public.workspace_privacy_requests;

drop policy if exists "Workspace members can update privacy requests"
on public.workspace_privacy_requests;

create policy "Workspace privacy managers can read privacy requests"
on public.workspace_privacy_requests
for select
to authenticated
using (public.can_manage_org(organization_id));

create policy "Workspace privacy managers can create privacy requests"
on public.workspace_privacy_requests
for insert
to authenticated
with check (
  requester_user_id = auth.uid()
  and public.can_manage_org(organization_id)
);

create policy "Workspace privacy managers can update privacy requests"
on public.workspace_privacy_requests
for update
to authenticated
using (public.can_manage_org(organization_id))
with check (
  (
    reviewer_user_id is null
    or reviewer_user_id = auth.uid()
  )
  and public.can_manage_org(organization_id)
);

drop policy if exists "Workspace members can read export packages"
on public.workspace_export_packages;

drop policy if exists "Workspace members can create export packages"
on public.workspace_export_packages;

create policy "Workspace privacy managers can read export packages"
on public.workspace_export_packages
for select
to authenticated
using (public.can_manage_org(organization_id));

create policy "Workspace privacy managers can create export packages"
on public.workspace_export_packages
for insert
to authenticated
with check (
  requested_by = auth.uid()
  and public.can_manage_org(organization_id)
);

drop policy if exists "Workspace members can read retention runs"
on public.workspace_retention_runs;

drop policy if exists "Workspace members can create retention runs"
on public.workspace_retention_runs;

drop policy if exists "Workspace members can update retention runs"
on public.workspace_retention_runs;

create policy "Workspace privacy managers can read retention runs"
on public.workspace_retention_runs
for select
to authenticated
using (public.can_manage_org(organization_id));

create policy "Workspace privacy managers can create retention runs"
on public.workspace_retention_runs
for insert
to authenticated
with check (public.can_manage_org(organization_id));

create policy "Workspace privacy managers can update retention runs"
on public.workspace_retention_runs
for update
to authenticated
using (public.can_manage_org(organization_id))
with check (public.can_manage_org(organization_id));

drop policy if exists "Workspace members can read deletion runs"
on public.workspace_deletion_runs;

drop policy if exists "Workspace members can create deletion runs"
on public.workspace_deletion_runs;

drop policy if exists "Workspace members can update deletion runs"
on public.workspace_deletion_runs;

create policy "Workspace privacy managers can read deletion runs"
on public.workspace_deletion_runs
for select
to authenticated
using (public.can_manage_org(organization_id));

create policy "Workspace privacy managers can create deletion runs"
on public.workspace_deletion_runs
for insert
to authenticated
with check (public.can_manage_org(organization_id));

create policy "Workspace privacy managers can update deletion runs"
on public.workspace_deletion_runs
for update
to authenticated
using (public.can_manage_org(organization_id))
with check (public.can_manage_org(organization_id));

drop policy if exists "Workspace members can read settings"
on public.workspace_settings;

drop policy if exists "Workspace members can create settings"
on public.workspace_settings;

drop policy if exists "Workspace members can update settings"
on public.workspace_settings;

drop policy if exists "Workspace members can read workspace settings"
on public.workspace_settings;

drop policy if exists "Workspace members can create workspace settings"
on public.workspace_settings;

drop policy if exists "Workspace members can update workspace settings"
on public.workspace_settings;

drop policy if exists "Workspace managers can read settings"
on public.workspace_settings;

drop policy if exists "Workspace managers can create settings"
on public.workspace_settings;

drop policy if exists "Workspace managers can update settings"
on public.workspace_settings;

create policy "Workspace privacy managers can read settings"
on public.workspace_settings
for select
to authenticated
using (public.can_manage_org(organization_id));

create policy "Workspace privacy managers can create settings"
on public.workspace_settings
for insert
to authenticated
with check (public.can_manage_org(organization_id));

create policy "Workspace privacy managers can update settings"
on public.workspace_settings
for update
to authenticated
using (public.can_manage_org(organization_id))
with check (public.can_manage_org(organization_id));

create or replace function public.execute_workspace_retention_run(
  retention_run_id uuid
)
returns public.workspace_retention_runs
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  active_user_id uuid := auth.uid();

  target_run public.workspace_retention_runs%rowtype;
  executed_run public.workspace_retention_runs%rowtype;
  failed_run public.workspace_retention_runs%rowtype;

  invoice_draft_deleted_count integer := 0;
  validation_run_deleted_count integer := 0;
  xml_report_deleted_count integer := 0;
  xml_validation_job_deleted_count integer := 0;
  invoice_export_deleted_count integer := 0;
  api_request_log_deleted_count integer := 0;
  webhook_delivery_log_deleted_count integer := 0;
  vies_evidence_deleted_count integer := 0;
  vida_simulation_deleted_count integer := 0;
  activity_event_deleted_count integer := 0;

  execution_error_message text := '';
begin
  if active_user_id is null then
    raise exception 'Authenticated user required.'
      using errcode = '42501';
  end if;

  select *
  into target_run
  from public.workspace_retention_runs
  where id = retention_run_id
  for update;

  if not found then
    raise exception 'Retention run was not found.'
      using errcode = 'P0002';
  end if;

  if not public.can_manage_org(target_run.organization_id) then
    raise exception 'Retention run execution requires an organization owner or admin role.'
      using errcode = '42501';
  end if;

  if target_run.status <> 'prepared' then
    raise exception 'Only prepared retention runs can be executed.'
      using errcode = 'P0001';
  end if;

  begin
    with deleted_rows as (
      delete from public.invoice_drafts
      where organization_id = target_run.organization_id
        and updated_at < target_run.invoice_draft_cutoff_date
      returning id
    )
    select count(*)::integer into invoice_draft_deleted_count from deleted_rows;

    with deleted_rows as (
      delete from public.validation_runs
      where organization_id = target_run.organization_id
        and created_at < target_run.validation_run_cutoff_date
      returning id
    )
    select count(*)::integer into validation_run_deleted_count from deleted_rows;

    with deleted_rows as (
      delete from public.xml_readiness_reports
      where organization_id = target_run.organization_id
        and uploaded_at < target_run.xml_report_cutoff_date
      returning id
    )
    select count(*)::integer into xml_report_deleted_count from deleted_rows;

    with deleted_rows as (
      delete from public.xml_validation_jobs
      where organization_id = target_run.organization_id
        and created_at < target_run.xml_validation_job_cutoff_date
      returning id
    )
    select count(*)::integer into xml_validation_job_deleted_count from deleted_rows;

    with deleted_rows as (
      delete from public.invoice_exports
      where organization_id = target_run.organization_id
        and created_at < target_run.invoice_export_cutoff_date
      returning id
    )
    select count(*)::integer into invoice_export_deleted_count from deleted_rows;

    with deleted_rows as (
      delete from public.api_requests
      where organization_id = target_run.organization_id
        and created_at < target_run.api_request_log_cutoff_date
      returning id
    )
    select count(*)::integer into api_request_log_deleted_count from deleted_rows;

    with deleted_rows as (
      delete from public.webhook_deliveries
      where organization_id = target_run.organization_id
        and created_at < target_run.webhook_delivery_log_cutoff_date
      returning id
    )
    select count(*)::integer into webhook_delivery_log_deleted_count from deleted_rows;

    with deleted_rows as (
      delete from public.vies_evidence_checks
      where organization_id = target_run.organization_id
        and created_at < target_run.vies_evidence_cutoff_date
      returning id
    )
    select count(*)::integer into vies_evidence_deleted_count from deleted_rows;

    with deleted_rows as (
      delete from public.vida_simulation_runs
      where organization_id = target_run.organization_id
        and created_at < target_run.vida_simulation_cutoff_date
      returning id
    )
    select count(*)::integer into vida_simulation_deleted_count from deleted_rows;

    with deleted_rows as (
      delete from public.workspace_activity_events
      where organization_id = target_run.organization_id
        and created_at < target_run.activity_log_cutoff_date
      returning id
    )
    select count(*)::integer into activity_event_deleted_count from deleted_rows;

    update public.workspace_retention_runs
    set
      status = 'executed',
      invoice_draft_executed_count = invoice_draft_deleted_count,
      validation_run_executed_count = validation_run_deleted_count,
      xml_report_executed_count = xml_report_deleted_count,
      xml_validation_job_executed_count = xml_validation_job_deleted_count,
      invoice_export_executed_count = invoice_export_deleted_count,
      api_request_log_executed_count = api_request_log_deleted_count,
      webhook_delivery_log_executed_count = webhook_delivery_log_deleted_count,
      vies_evidence_executed_count = vies_evidence_deleted_count,
      vida_simulation_executed_count = vida_simulation_deleted_count,
      activity_event_executed_count = activity_event_deleted_count,
      privacy_request_executed_count = 0,
      retention_run_executed_count = 0,
      deletion_run_executed_count = 0,
      legal_acceptance_executed_count = 0,
      error_message = '',
      executed_at = now()
    where id = target_run.id
      and organization_id = target_run.organization_id
      and status = 'prepared'
    returning *
    into executed_run;

    if executed_run.id is null then
      raise exception 'Retention run could not be marked as executed.'
        using errcode = 'P0001';
    end if;

    insert into public.workspace_activity_events (
      organization_id,
      actor_user_id,
      event_type,
      entity_type,
      entity_id,
      entity_label,
      severity,
      source,
      metadata
    )
    values (
      target_run.organization_id,
      active_user_id,
      'retention_run.executed',
      'workspace_retention_run',
      executed_run.id::text,
      'Retention review executed ' || executed_run.executed_at::text,
      case
        when (
          invoice_draft_deleted_count +
          validation_run_deleted_count +
          xml_report_deleted_count +
          xml_validation_job_deleted_count +
          invoice_export_deleted_count +
          api_request_log_deleted_count +
          webhook_delivery_log_deleted_count +
          vies_evidence_deleted_count +
          vida_simulation_deleted_count +
          activity_event_deleted_count
        ) > 0 then 'warning'
        else 'info'
      end,
      'api',
      jsonb_build_object(
        'retentionMode', executed_run.retention_mode,
        'privacySupportOnly', true,
        'notGdprComplianceGuarantee', true,
        'preservedDatasets', jsonb_build_array(
          'workspace_privacy_requests',
          'workspace_retention_runs',
          'workspace_deletion_runs',
          'legal_document_acceptances'
        ),
        'executedCounts', jsonb_build_object(
          'invoiceDrafts', invoice_draft_deleted_count,
          'validationRuns', validation_run_deleted_count,
          'xmlReadinessReports', xml_report_deleted_count,
          'xmlValidationJobs', xml_validation_job_deleted_count,
          'invoiceExports', invoice_export_deleted_count,
          'apiRequests', api_request_log_deleted_count,
          'webhookDeliveries', webhook_delivery_log_deleted_count,
          'viesEvidenceChecks', vies_evidence_deleted_count,
          'vidaSimulationRuns', vida_simulation_deleted_count,
          'activityEvents', activity_event_deleted_count,
          'privacyRequests', 0,
          'retentionRuns', 0,
          'deletionRuns', 0,
          'legalAcceptances', 0
        )
      )
    );

    return executed_run;

  exception
    when others then
      execution_error_message := left(sqlerrm, 1000);

      update public.workspace_retention_runs
      set
        status = 'failed',
        error_message = execution_error_message
      where id = target_run.id
        and organization_id = target_run.organization_id
        and status = 'prepared'
      returning *
      into failed_run;

      insert into public.workspace_activity_events (
        organization_id,
        actor_user_id,
        event_type,
        entity_type,
        entity_id,
        entity_label,
        severity,
        source,
        metadata
      )
      values (
        target_run.organization_id,
        active_user_id,
        'retention_run.failed',
        'workspace_retention_run',
        target_run.id::text,
        'Retention review failed ' || now()::text,
        'error',
        'api',
        jsonb_build_object(
          'errorMessage', execution_error_message,
          'privacySupportOnly', true,
          'totalExecutedCount', 0
        )
      );

      return failed_run;
  end;
end;
$$;

revoke all on function public.execute_workspace_retention_run(uuid) from public;
grant execute on function public.execute_workspace_retention_run(uuid) to authenticated;

create or replace function public.execute_workspace_deletion_run(
  deletion_run_id uuid
)
returns public.workspace_deletion_runs
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  active_user_id uuid := auth.uid();

  target_run public.workspace_deletion_runs%rowtype;
  executed_run public.workspace_deletion_runs%rowtype;
  failed_run public.workspace_deletion_runs%rowtype;

  invoice_draft_deleted_count integer := 0;
  validation_run_deleted_count integer := 0;
  xml_report_deleted_count integer := 0;
  workspace_export_package_deleted_count integer := 0;
  production_invoice_deleted_count integer := 0;
  business_profile_deleted_count integer := 0;
  contact_deleted_count integer := 0;
  invoice_export_deleted_count integer := 0;
  vat_number_check_deleted_count integer := 0;
  xml_validation_job_deleted_count integer := 0;
  api_key_revoked_count integer := 0;
  api_request_log_deleted_count integer := 0;
  webhook_endpoint_disabled_count integer := 0;
  webhook_delivery_deleted_count integer := 0;
  vies_evidence_deleted_count integer := 0;
  vida_simulation_deleted_count integer := 0;

  execution_error_message text := '';
begin
  if active_user_id is null then
    raise exception 'Authenticated user required.'
      using errcode = '42501';
  end if;

  select *
  into target_run
  from public.workspace_deletion_runs
  where id = deletion_run_id
  for update;

  if not found then
    raise exception 'Deletion run was not found.'
      using errcode = 'P0002';
  end if;

  if not public.can_manage_org(target_run.organization_id) then
    raise exception 'Deletion run execution requires an organization owner or admin role.'
      using errcode = '42501';
  end if;

  if target_run.status <> 'prepared' then
    raise exception 'Only prepared deletion runs can be executed.'
      using errcode = 'P0001';
  end if;

  if target_run.source_privacy_request_id is null or not exists (
    select 1
    from public.workspace_privacy_requests request
    where request.id = target_run.source_privacy_request_id
      and request.organization_id = target_run.organization_id
      and request.request_type = 'deletion'
  ) then
    raise exception 'Deletion run source privacy request is invalid.'
      using errcode = 'P0001';
  end if;

  begin
    with deleted_rows as (
      delete from public.webhook_deliveries
      where organization_id = target_run.organization_id
      returning id
    )
    select count(*)::integer into webhook_delivery_deleted_count from deleted_rows;

    with deleted_rows as (
      delete from public.api_requests
      where organization_id = target_run.organization_id
      returning id
    )
    select count(*)::integer into api_request_log_deleted_count from deleted_rows;

    with deleted_rows as (
      delete from public.xml_validation_jobs
      where organization_id = target_run.organization_id
      returning id
    )
    select count(*)::integer into xml_validation_job_deleted_count from deleted_rows;

    with deleted_rows as (
      delete from public.invoice_exports
      where organization_id = target_run.organization_id
      returning id
    )
    select count(*)::integer into invoice_export_deleted_count from deleted_rows;

    with deleted_rows as (
      delete from public.vies_evidence_checks
      where organization_id = target_run.organization_id
      returning id
    )
    select count(*)::integer into vies_evidence_deleted_count from deleted_rows;

    with deleted_rows as (
      delete from public.vida_simulation_runs
      where organization_id = target_run.organization_id
      returning id
    )
    select count(*)::integer into vida_simulation_deleted_count from deleted_rows;

    with deleted_rows as (
      delete from public.vat_number_checks
      where organization_id = target_run.organization_id
      returning id
    )
    select count(*)::integer into vat_number_check_deleted_count from deleted_rows;

    with deleted_rows as (
      delete from public.validation_runs
      where organization_id = target_run.organization_id
      returning id
    )
    select count(*)::integer into validation_run_deleted_count from deleted_rows;

    with deleted_rows as (
      delete from public.xml_readiness_reports
      where organization_id = target_run.organization_id
      returning id
    )
    select count(*)::integer into xml_report_deleted_count from deleted_rows;

    with deleted_rows as (
      delete from public.invoice_drafts
      where organization_id = target_run.organization_id
      returning id
    )
    select count(*)::integer into invoice_draft_deleted_count from deleted_rows;

    with deleted_rows as (
      delete from public.invoices
      where organization_id = target_run.organization_id
      returning id
    )
    select count(*)::integer into production_invoice_deleted_count from deleted_rows;

    with deleted_rows as (
      delete from public.contacts
      where organization_id = target_run.organization_id
      returning id
    )
    select count(*)::integer into contact_deleted_count from deleted_rows;

    with deleted_rows as (
      delete from public.business_profiles
      where organization_id = target_run.organization_id
      returning id
    )
    select count(*)::integer into business_profile_deleted_count from deleted_rows;

    with deleted_rows as (
      delete from public.workspace_export_packages
      where organization_id = target_run.organization_id
      returning id
    )
    select count(*)::integer into workspace_export_package_deleted_count from deleted_rows;

    with updated_rows as (
      update public.api_keys
      set
        status = 'revoked',
        revoked_at = coalesce(revoked_at, now()),
        revoked_by = coalesce(revoked_by, active_user_id)
      where organization_id = target_run.organization_id
        and status <> 'revoked'
      returning id
    )
    select count(*)::integer into api_key_revoked_count from updated_rows;

    with updated_rows as (
      update public.webhook_endpoints
      set
        status = 'disabled',
        signing_secret_encrypted = null,
        signing_secret_iv = null,
        signing_secret_tag = null,
        signing_secret_last4 = null,
        signing_secret_key_id = null,
        disabled_at = coalesce(disabled_at, now()),
        updated_by = active_user_id
      where organization_id = target_run.organization_id
      returning id
    )
    select count(*)::integer into webhook_endpoint_disabled_count from updated_rows;

    update public.workspace_deletion_runs
    set
      status = 'executed',
      invoice_draft_executed_count = invoice_draft_deleted_count,
      validation_run_executed_count = validation_run_deleted_count,
      xml_report_executed_count = xml_report_deleted_count,
      workspace_export_package_executed_count = workspace_export_package_deleted_count,
      activity_event_executed_count = 0,
      production_invoice_executed_count = production_invoice_deleted_count,
      business_profile_executed_count = business_profile_deleted_count,
      contact_executed_count = contact_deleted_count,
      invoice_export_executed_count = invoice_export_deleted_count,
      vat_number_check_executed_count = vat_number_check_deleted_count,
      xml_validation_job_executed_count = xml_validation_job_deleted_count,
      api_key_executed_count = api_key_revoked_count,
      api_request_log_executed_count = api_request_log_deleted_count,
      webhook_endpoint_executed_count = webhook_endpoint_disabled_count,
      webhook_delivery_executed_count = webhook_delivery_deleted_count,
      vies_evidence_executed_count = vies_evidence_deleted_count,
      vida_simulation_executed_count = vida_simulation_deleted_count,
      legal_acceptance_executed_count = 0,
      privacy_request_event_executed_count = 0,
      privacy_audit_event_executed_count = 0,
      error_message = '',
      executed_at = now()
    where id = target_run.id
      and organization_id = target_run.organization_id
      and status = 'prepared'
    returning *
    into executed_run;

    if executed_run.id is null then
      raise exception 'Deletion run could not be marked as executed.'
        using errcode = 'P0001';
    end if;

    insert into public.workspace_activity_events (
      organization_id,
      actor_user_id,
      event_type,
      entity_type,
      entity_id,
      entity_label,
      severity,
      source,
      metadata
    )
    values (
      target_run.organization_id,
      active_user_id,
      'deletion_run.executed',
      'workspace_deletion_run',
      executed_run.id::text,
      'Workspace deletion run executed ' || executed_run.executed_at::text,
      'warning',
      'api',
      jsonb_build_object(
        'sourcePrivacyRequestId', executed_run.source_privacy_request_id,
        'privacySupportOnly', true,
        'notGdprComplianceGuarantee', true,
        'preservedDatasets', jsonb_build_array(
          'workspace_activity_events',
          'legal_document_acceptances',
          'privacy_request_events',
          'workspace_privacy_audit_events',
          'legal_documents',
          'validation_rules',
          'source_references',
          'country_pack_registry'
        ),
        'secretHandling', jsonb_build_object(
          'apiKeys', 'revoked metadata only',
          'webhookEndpoints', 'disabled and secret material nulled'
        ),
        'executedCounts', jsonb_build_object(
          'invoiceDrafts', invoice_draft_deleted_count,
          'validationRuns', validation_run_deleted_count,
          'xmlReadinessReports', xml_report_deleted_count,
          'workspaceExportPackages', workspace_export_package_deleted_count,
          'activityEvents', 0,
          'productionInvoices', production_invoice_deleted_count,
          'businessProfiles', business_profile_deleted_count,
          'contacts', contact_deleted_count,
          'invoiceExports', invoice_export_deleted_count,
          'vatNumberChecks', vat_number_check_deleted_count,
          'xmlValidationJobs', xml_validation_job_deleted_count,
          'apiKeys', api_key_revoked_count,
          'apiRequests', api_request_log_deleted_count,
          'webhookEndpoints', webhook_endpoint_disabled_count,
          'webhookDeliveries', webhook_delivery_deleted_count,
          'viesEvidenceChecks', vies_evidence_deleted_count,
          'vidaSimulationRuns', vida_simulation_deleted_count,
          'legalAcceptances', 0,
          'privacyRequestEvents', 0,
          'privacyAuditEvents', 0
        )
      )
    );

    return executed_run;

  exception
    when others then
      execution_error_message := left(sqlerrm, 1000);

      update public.workspace_deletion_runs
      set
        status = 'failed',
        error_message = execution_error_message
      where id = target_run.id
        and organization_id = target_run.organization_id
        and status = 'prepared'
      returning *
      into failed_run;

      insert into public.workspace_activity_events (
        organization_id,
        actor_user_id,
        event_type,
        entity_type,
        entity_id,
        entity_label,
        severity,
        source,
        metadata
      )
      values (
        target_run.organization_id,
        active_user_id,
        'deletion_run.failed',
        'workspace_deletion_run',
        target_run.id::text,
        'Workspace deletion run failed ' || now()::text,
        'error',
        'api',
        jsonb_build_object(
          'sourcePrivacyRequestId', target_run.source_privacy_request_id,
          'errorMessage', execution_error_message,
          'privacySupportOnly', true,
          'totalExecutedCount', 0
        )
      );

      return failed_run;
  end;
end;
$$;

revoke all on function public.execute_workspace_deletion_run(uuid) from public;
grant execute on function public.execute_workspace_deletion_run(uuid) to authenticated;

comment on function public.execute_workspace_retention_run(uuid) is
'Executes owner/admin-reviewed workspace retention cleanup for selected tenant-owned datasets. Preserves privacy request, deletion/retention, and legal acceptance evidence by default. This is privacy-support tooling, not GDPR compliance advice.';

comment on function public.execute_workspace_deletion_run(uuid) is
'Executes owner/admin-reviewed workspace deletion workflow from a linked deletion privacy request. It revokes API keys, disables webhook endpoints, preserves/minimizes audit and legal acceptance records, and never deletes public legal documents, platform rule sources, or country packs.';

commit;
