drop policy if exists "Workspace members can update privacy requests"
on public.workspace_privacy_requests;

create policy "Workspace members can update privacy requests"
on public.workspace_privacy_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = workspace_privacy_requests.organization_id
      and membership.user_id = auth.uid()
  )
)
with check (
  (
    reviewer_user_id is null
    or reviewer_user_id = auth.uid()
  )
  and exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = workspace_privacy_requests.organization_id
      and membership.user_id = auth.uid()
  )
);

grant update (
  status,
  reviewer_user_id,
  review_note,
  completed_at
) on public.workspace_privacy_requests to authenticated;
