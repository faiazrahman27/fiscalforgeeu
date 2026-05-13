-- Invoice Lantern
-- Migration 036: production invoice lifecycle event history.
--
-- This migration is additive. It records internal workspace invoice status
-- transitions without changing the existing production invoice statuses or
-- implying official filing, authority acceptance, Peppol delivery, legal
-- validity, tax compliance, or accounting compliance.

begin;

create table if not exists public.invoice_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null,
  from_status text
    check (
      from_status is null
      or from_status in (
        'draft',
        'ready_for_review',
        'validated',
        'issued',
        'archived',
        'voided'
      )
    ),
  to_status text not null
    check (
      to_status in (
        'draft',
        'ready_for_review',
        'validated',
        'issued',
        'archived',
        'voided'
      )
    ),
  reason text check (reason is null or char_length(trim(reason)) between 1 and 1000),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_api_key_id uuid references public.api_keys(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint invoice_lifecycle_events_invoice_org_fk
    foreign key (invoice_id, organization_id)
    references public.invoices(id, organization_id) on delete cascade
);

create index if not exists invoice_lifecycle_events_org_invoice_created_desc_idx
on public.invoice_lifecycle_events (organization_id, invoice_id, created_at desc);

create index if not exists invoice_lifecycle_events_organization_created_desc_idx
on public.invoice_lifecycle_events (organization_id, created_at desc);

create index if not exists invoice_lifecycle_events_invoice_id_idx
on public.invoice_lifecycle_events (invoice_id);

alter table public.invoice_lifecycle_events enable row level security;

drop policy if exists "Workspace members can read invoice lifecycle events"
on public.invoice_lifecycle_events;

create policy "Workspace members can read invoice lifecycle events"
on public.invoice_lifecycle_events
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Invoice editors can create invoice lifecycle events"
on public.invoice_lifecycle_events;

create policy "Invoice editors can create invoice lifecycle events"
on public.invoice_lifecycle_events
for insert
to authenticated
with check (
  public.can_create_invoice(organization_id)
  and (actor_user_id is null or actor_user_id = auth.uid())
  and exists (
    select 1
    from public.invoices invoice
    where invoice.id = invoice_lifecycle_events.invoice_id
      and invoice.organization_id = invoice_lifecycle_events.organization_id
  )
);

grant select, insert
on table public.invoice_lifecycle_events
to authenticated;

grant select, insert, update, delete
on table public.invoice_lifecycle_events
to service_role;

comment on table public.invoice_lifecycle_events is
'Workspace-scoped history of internal production invoice lifecycle state changes. The issued state is internal only and does not mean official filing, authority acceptance, Peppol delivery, certified compliance, legal advice, tax advice, or accounting advice.';

commit;
