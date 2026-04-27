create table if not exists public.workspace_activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null default '',
  entity_type text not null default '',
  entity_id text not null default '',
  entity_label text not null default '',
  severity text not null default 'info' check (severity in ('info', 'warning', 'error')),
  source text not null default 'api',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workspace_activity_events_org_created_idx
  on public.workspace_activity_events(organization_id, created_at desc);

create index if not exists workspace_activity_events_actor_idx
  on public.workspace_activity_events(organization_id, actor_user_id);

create index if not exists workspace_activity_events_type_idx
  on public.workspace_activity_events(organization_id, event_type);

create index if not exists workspace_activity_events_entity_idx
  on public.workspace_activity_events(organization_id, entity_type, entity_id);

alter table public.workspace_activity_events enable row level security;

drop policy if exists "Members can read workspace activity events"
  on public.workspace_activity_events;

create policy "Members can read workspace activity events"
  on public.workspace_activity_events
  for select
  using (public.is_org_member(organization_id));

drop policy if exists "Members can insert workspace activity events"
  on public.workspace_activity_events;

create policy "Members can insert workspace activity events"
  on public.workspace_activity_events
  for insert
  with check (public.is_org_member(organization_id));

grant select, insert
on table public.workspace_activity_events
to authenticated;
