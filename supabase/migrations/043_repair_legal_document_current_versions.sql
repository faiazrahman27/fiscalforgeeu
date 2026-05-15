-- Invoice Lantern
-- Migration 043: repair and harden legal document current-version links.
--
-- This migration preserves history. It does not delete legal documents,
-- versions, or acceptance records. It repairs published legal documents whose
-- current_version_id is null or points to a non-published/missing version.
--
-- Reason:
-- Legal acceptance failed when a published legal document had
-- current_version_id = null, causing the API to query legal_document_versions
-- with an invalid UUID value.

begin;

with latest_published_versions as (
  select
    version.id,
    version.legal_document_id,
    row_number() over (
      partition by version.legal_document_id
      order by
        version.published_at desc nulls last,
        version.effective_from desc nulls last,
        version.created_at desc,
        version.id desc
    ) as rank
  from public.legal_document_versions version
  where version.status = 'published'
),
repairable_documents as (
  select
    document.id as legal_document_id,
    document.current_version_id as previous_current_version_id,
    latest.id as repaired_current_version_id
  from public.legal_documents document
  join latest_published_versions latest
    on latest.legal_document_id = document.id
   and latest.rank = 1
  left join public.legal_document_versions current_version
    on current_version.id = document.current_version_id
   and current_version.legal_document_id = document.id
   and current_version.status = 'published'
  where document.status = 'published'
    and (
      document.current_version_id is null
      or current_version.id is null
    )
),
updated_documents as (
  update public.legal_documents document
  set current_version_id = repairable.repaired_current_version_id
  from repairable_documents repairable
  where document.id = repairable.legal_document_id
  returning
    document.id as legal_document_id,
    repairable.previous_current_version_id,
    document.current_version_id as repaired_current_version_id
)
insert into public.legal_document_lifecycle_events (
  legal_document_id,
  legal_document_version_id,
  event_type,
  metadata
)
select
  updated.legal_document_id,
  updated.repaired_current_version_id,
  'document.updated',
  jsonb_build_object(
    'migration', '043_repair_legal_document_current_versions',
    'reason', 'Repair missing or invalid current_version_id for published legal documents.',
    'previousCurrentVersionId', updated.previous_current_version_id,
    'repairedCurrentVersionId', updated.repaired_current_version_id,
    'preservesHistory', true,
    'legalAdviceCreated', false,
    'officialComplianceCreated', false
  )
from updated_documents updated;

-- Optional defensive helper:
-- If a future published legal document loses current_version_id, this function
-- can repair it deterministically from the latest published version.
create or replace function public.repair_legal_document_current_version(
  target_legal_document_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  repaired_version_id uuid;
begin
  select version.id
  into repaired_version_id
  from public.legal_document_versions version
  where version.legal_document_id = target_legal_document_id
    and version.status = 'published'
  order by
    version.published_at desc nulls last,
    version.effective_from desc nulls last,
    version.created_at desc,
    version.id desc
  limit 1;

  if repaired_version_id is null then
    return null;
  end if;

  update public.legal_documents document
  set current_version_id = repaired_version_id
  where document.id = target_legal_document_id
    and document.status = 'published'
    and (
      document.current_version_id is null
      or not exists (
        select 1
        from public.legal_document_versions current_version
        where current_version.id = document.current_version_id
          and current_version.legal_document_id = document.id
          and current_version.status = 'published'
      )
    );

  return repaired_version_id;
end;
$$;

grant execute on function public.repair_legal_document_current_version(uuid) to service_role;

commit;
