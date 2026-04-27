grant usage on schema public to authenticated;

grant select, insert, update
on table public.profiles
to authenticated;

grant select, insert, update, delete
on table public.organizations
to authenticated;

grant select, insert, update, delete
on table public.organization_memberships
to authenticated;

grant select, insert, update, delete
on table public.invoice_drafts
to authenticated;

grant select, insert, update, delete
on table public.validation_runs
to authenticated;

grant select, insert, update, delete
on table public.xml_readiness_reports
to authenticated;

grant select, insert
on table public.audit_events
to authenticated;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin_or_owner(uuid) to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;
grant execute on function public.organization_has_no_members(uuid) to authenticated;
grant execute on function public.bootstrap_personal_workspace() to authenticated;
