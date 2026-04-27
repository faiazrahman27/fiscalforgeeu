create table if not exists public.invoice_draft_parties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_draft_id uuid not null references public.invoice_drafts(id) on delete cascade,
  party_role text not null check (party_role in ('seller', 'buyer')),
  name text not null default '',
  country text not null default '',
  vat_id text not null default '',
  city text not null default '',
  postal_code text not null default '',
  street text not null default '',
  electronic_address text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_draft_id, party_role)
);

create table if not exists public.invoice_draft_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_draft_id uuid not null references public.invoice_drafts(id) on delete cascade,
  source_line_id text not null default '',
  line_position integer not null check (line_position >= 1),
  description text not null default '',
  quantity numeric(18, 6) not null default 0,
  unit_code text not null default '',
  unit_price numeric(18, 6) not null default 0,
  vat_category text not null default '',
  vat_rate numeric(9, 4) not null default 0,
  net_amount numeric(18, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_draft_id, line_position)
);

create table if not exists public.invoice_draft_tax_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_draft_id uuid not null references public.invoice_drafts(id) on delete cascade,
  vat_category text not null default '',
  vat_rate numeric(9, 4) not null default 0,
  taxable_amount numeric(18, 2) not null default 0,
  tax_amount numeric(18, 2) not null default 0,
  currency text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_draft_id, vat_category, vat_rate)
);

create index if not exists invoice_draft_parties_org_idx
  on public.invoice_draft_parties(organization_id);

create index if not exists invoice_draft_parties_draft_idx
  on public.invoice_draft_parties(invoice_draft_id);

create index if not exists invoice_draft_parties_role_idx
  on public.invoice_draft_parties(organization_id, party_role);

create index if not exists invoice_draft_lines_org_idx
  on public.invoice_draft_lines(organization_id);

create index if not exists invoice_draft_lines_draft_idx
  on public.invoice_draft_lines(invoice_draft_id);

create index if not exists invoice_draft_lines_vat_idx
  on public.invoice_draft_lines(organization_id, vat_category, vat_rate);

create index if not exists invoice_draft_tax_summaries_org_idx
  on public.invoice_draft_tax_summaries(organization_id);

create index if not exists invoice_draft_tax_summaries_draft_idx
  on public.invoice_draft_tax_summaries(invoice_draft_id);

create index if not exists invoice_draft_tax_summaries_vat_idx
  on public.invoice_draft_tax_summaries(organization_id, vat_category, vat_rate);

alter table public.invoice_draft_parties enable row level security;
alter table public.invoice_draft_lines enable row level security;
alter table public.invoice_draft_tax_summaries enable row level security;

drop policy if exists "Members can read invoice draft parties"
  on public.invoice_draft_parties;

create policy "Members can read invoice draft parties"
  on public.invoice_draft_parties
  for select
  using (public.is_org_member(organization_id));

drop policy if exists "Members can insert invoice draft parties"
  on public.invoice_draft_parties;

create policy "Members can insert invoice draft parties"
  on public.invoice_draft_parties
  for insert
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can update invoice draft parties"
  on public.invoice_draft_parties;

create policy "Members can update invoice draft parties"
  on public.invoice_draft_parties
  for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can delete invoice draft parties"
  on public.invoice_draft_parties;

create policy "Members can delete invoice draft parties"
  on public.invoice_draft_parties
  for delete
  using (public.is_org_member(organization_id));

drop policy if exists "Members can read invoice draft lines"
  on public.invoice_draft_lines;

create policy "Members can read invoice draft lines"
  on public.invoice_draft_lines
  for select
  using (public.is_org_member(organization_id));

drop policy if exists "Members can insert invoice draft lines"
  on public.invoice_draft_lines;

create policy "Members can insert invoice draft lines"
  on public.invoice_draft_lines
  for insert
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can update invoice draft lines"
  on public.invoice_draft_lines;

create policy "Members can update invoice draft lines"
  on public.invoice_draft_lines
  for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can delete invoice draft lines"
  on public.invoice_draft_lines;

create policy "Members can delete invoice draft lines"
  on public.invoice_draft_lines
  for delete
  using (public.is_org_member(organization_id));

drop policy if exists "Members can read invoice draft tax summaries"
  on public.invoice_draft_tax_summaries;

create policy "Members can read invoice draft tax summaries"
  on public.invoice_draft_tax_summaries
  for select
  using (public.is_org_member(organization_id));

drop policy if exists "Members can insert invoice draft tax summaries"
  on public.invoice_draft_tax_summaries;

create policy "Members can insert invoice draft tax summaries"
  on public.invoice_draft_tax_summaries
  for insert
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can update invoice draft tax summaries"
  on public.invoice_draft_tax_summaries;

create policy "Members can update invoice draft tax summaries"
  on public.invoice_draft_tax_summaries
  for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can delete invoice draft tax summaries"
  on public.invoice_draft_tax_summaries;

create policy "Members can delete invoice draft tax summaries"
  on public.invoice_draft_tax_summaries
  for delete
  using (public.is_org_member(organization_id));

grant select, insert, update, delete
on table public.invoice_draft_parties
to authenticated;

grant select, insert, update, delete
on table public.invoice_draft_lines
to authenticated;

grant select, insert, update, delete
on table public.invoice_draft_tax_summaries
to authenticated;
