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
  activity_event_deleted_count integer := 0;

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

  if not exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_run.organization_id
      and membership.user_id = active_user_id
  ) then
    raise exception 'Deletion run does not belong to the authenticated user workspace.'
      using errcode = '42501';
  end if;

  if target_run.status <> 'prepared' then
    raise exception 'Only prepared deletion runs can be executed.'
      using errcode = 'P0001';
  end if;

  if target_run.source_privacy_request_id is not null and not exists (
    select 1
    from public.workspace_privacy_requests request
    where request.id = target_run.source_privacy_request_id
      and request.organization_id = target_run.organization_id
      and request.request_type = 'deletion'
  ) then
    raise exception 'Deletion run source privacy request is invalid.'
      using errcode = 'P0001';
  end if;

  /*
   * The destructive section is wrapped in an exception block.
   * If any delete/update/insert inside this block fails, PostgreSQL rolls back
   * changes made inside this block before running the exception handler.
   */
  begin
    with deleted_rows as (
      delete from public.invoice_drafts
      where organization_id = target_run.organization_id
      returning id
    )
    select count(*)::integer
    into invoice_draft_deleted_count
    from deleted_rows;

    with deleted_rows as (
      delete from public.validation_runs
      where organization_id = target_run.organization_id
      returning id
    )
    select count(*)::integer
    into validation_run_deleted_count
    from deleted_rows;

    with deleted_rows as (
      delete from public.xml_readiness_reports
      where organization_id = target_run.organization_id
      returning id
    )
    select count(*)::integer
    into xml_report_deleted_count
    from deleted_rows;

    with deleted_rows as (
      delete from public.workspace_export_packages
      where organization_id = target_run.organization_id
      returning id
    )
    select count(*)::integer
    into workspace_export_package_deleted_count
    from deleted_rows;

    with deleted_rows as (
      delete from public.workspace_activity_events
      where organization_id = target_run.organization_id
      returning id
    )
    select count(*)::integer
    into activity_event_deleted_count
    from deleted_rows;

    update public.workspace_deletion_runs
    set
      status = 'executed',
      invoice_draft_executed_count = invoice_draft_deleted_count,
      validation_run_executed_count = validation_run_deleted_count,
      xml_report_executed_count = xml_report_deleted_count,
      workspace_export_package_executed_count = workspace_export_package_deleted_count,
      activity_event_executed_count = activity_event_deleted_count,
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
      case
        when (
          invoice_draft_deleted_count +
          validation_run_deleted_count +
          xml_report_deleted_count +
          workspace_export_package_deleted_count +
          activity_event_deleted_count
        ) > 0 then 'warning'
        else 'info'
      end,
      'api',
      jsonb_build_object(
        'sourcePrivacyRequestId', executed_run.source_privacy_request_id,
        'totalAffectedCount',
          executed_run.invoice_draft_affected_count +
          executed_run.validation_run_affected_count +
          executed_run.xml_report_affected_count +
          executed_run.workspace_export_package_affected_count +
          executed_run.activity_event_affected_count,
        'totalExecutedCount',
          invoice_draft_deleted_count +
          validation_run_deleted_count +
          xml_report_deleted_count +
          workspace_export_package_deleted_count +
          activity_event_deleted_count,
        'affectedCounts', jsonb_build_object(
          'invoiceDrafts', executed_run.invoice_draft_affected_count,
          'validationRuns', executed_run.validation_run_affected_count,
          'xmlReadinessReports', executed_run.xml_report_affected_count,
          'workspaceExportPackages', executed_run.workspace_export_package_affected_count,
          'activityEvents', executed_run.activity_event_affected_count
        ),
        'executedCounts', jsonb_build_object(
          'invoiceDrafts', invoice_draft_deleted_count,
          'validationRuns', validation_run_deleted_count,
          'xmlReadinessReports', xml_report_deleted_count,
          'workspaceExportPackages', workspace_export_package_deleted_count,
          'activityEvents', activity_event_deleted_count
        )
      )
    );

    return executed_run;

  exception
    when others then
      execution_error_message = left(sqlerrm, 1000);

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
          'totalAffectedCount',
            target_run.invoice_draft_affected_count +
            target_run.validation_run_affected_count +
            target_run.xml_report_affected_count +
            target_run.workspace_export_package_affected_count +
            target_run.activity_event_affected_count,
          'totalExecutedCount', 0
        )
      );

      return failed_run;
  end;
end;
$$;

revoke all on function public.execute_workspace_deletion_run(uuid) from public;
grant execute on function public.execute_workspace_deletion_run(uuid) to authenticated;
