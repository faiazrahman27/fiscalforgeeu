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

  if not exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_run.organization_id
      and membership.user_id = active_user_id
  ) then
    raise exception 'Retention run does not belong to the authenticated user workspace.'
      using errcode = '42501';
  end if;

  if target_run.status <> 'prepared' then
    raise exception 'Only prepared retention runs can be executed.'
      using errcode = 'P0001';
  end if;

  /*
   * The destructive section is wrapped in an exception block.
   * If any delete/update/insert inside this block fails, PostgreSQL rolls back
   * the changes made inside the block before running the exception handler.
   * That prevents partial cleanup.
   */
  begin
    with deleted_rows as (
      delete from public.invoice_drafts
      where organization_id = target_run.organization_id
        and updated_at < target_run.invoice_draft_cutoff_date
      returning id
    )
    select count(*)::integer
    into invoice_draft_deleted_count
    from deleted_rows;

    with deleted_rows as (
      delete from public.validation_runs
      where organization_id = target_run.organization_id
        and created_at < target_run.validation_run_cutoff_date
      returning id
    )
    select count(*)::integer
    into validation_run_deleted_count
    from deleted_rows;

    with deleted_rows as (
      delete from public.xml_readiness_reports
      where organization_id = target_run.organization_id
        and uploaded_at < target_run.xml_report_cutoff_date
      returning id
    )
    select count(*)::integer
    into xml_report_deleted_count
    from deleted_rows;

    with deleted_rows as (
      delete from public.workspace_activity_events
      where organization_id = target_run.organization_id
        and created_at < target_run.activity_log_cutoff_date
      returning id
    )
    select count(*)::integer
    into activity_event_deleted_count
    from deleted_rows;

    update public.workspace_retention_runs
    set
      status = 'executed',
      invoice_draft_executed_count = invoice_draft_deleted_count,
      validation_run_executed_count = validation_run_deleted_count,
      xml_report_executed_count = xml_report_deleted_count,
      activity_event_executed_count = activity_event_deleted_count,
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
          activity_event_deleted_count
        ) > 0 then 'warning'
        else 'info'
      end,
      'api',
      jsonb_build_object(
        'retentionMode', executed_run.retention_mode,
        'totalAffectedCount',
          executed_run.invoice_draft_affected_count +
          executed_run.validation_run_affected_count +
          executed_run.xml_report_affected_count +
          executed_run.activity_event_affected_count,
        'totalExecutedCount',
          invoice_draft_deleted_count +
          validation_run_deleted_count +
          xml_report_deleted_count +
          activity_event_deleted_count,
        'invoiceDrafts', jsonb_build_object(
          'retentionDays', executed_run.invoice_draft_retention_days,
          'cutoffDate', executed_run.invoice_draft_cutoff_date,
          'affectedCount', executed_run.invoice_draft_affected_count,
          'executedCount', invoice_draft_deleted_count
        ),
        'validationRuns', jsonb_build_object(
          'retentionDays', executed_run.validation_run_retention_days,
          'cutoffDate', executed_run.validation_run_cutoff_date,
          'affectedCount', executed_run.validation_run_affected_count,
          'executedCount', validation_run_deleted_count
        ),
        'xmlReadinessReports', jsonb_build_object(
          'retentionDays', executed_run.xml_report_retention_days,
          'cutoffDate', executed_run.xml_report_cutoff_date,
          'affectedCount', executed_run.xml_report_affected_count,
          'executedCount', xml_report_deleted_count
        ),
        'activityEvents', jsonb_build_object(
          'retentionDays', executed_run.activity_log_retention_days,
          'cutoffDate', executed_run.activity_log_cutoff_date,
          'affectedCount', executed_run.activity_event_affected_count,
          'executedCount', activity_event_deleted_count
        )
      )
    );

    return executed_run;

  exception
    when others then
      execution_error_message = left(sqlerrm, 1000);

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
          'retentionMode', target_run.retention_mode,
          'totalAffectedCount',
            target_run.invoice_draft_affected_count +
            target_run.validation_run_affected_count +
            target_run.xml_report_affected_count +
            target_run.activity_event_affected_count,
          'totalExecutedCount', 0
        )
      );

      return failed_run;
  end;
end;
$$;

revoke all on function public.execute_workspace_retention_run(uuid) from public;
grant execute on function public.execute_workspace_retention_run(uuid) to authenticated;
