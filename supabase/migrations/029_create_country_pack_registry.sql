create table if not exists public.country_pack_registry (
    id uuid primary key default gen_random_uuid(),

    country_code text not null,
    country_name text not null,

    pack_version text not null,
    lifecycle_status text not null default 'draft'
        check (
            lifecycle_status in (
                'draft',
                'internal_review',
                'published',
                'deprecated',
                'archived'
            )
        ),

    legal_confidence text not null default 'technical'
        check (
            legal_confidence in (
                'technical',
                'standard_based',
                'official_source_derived',
                'educational_simulation',
                'professional_review_required'
            )
        ),

    source_count integer not null default 0
        check (source_count >= 0),

    rule_count integer not null default 0
        check (rule_count >= 0),

    supports_vat_rules boolean not null default false,
    supports_invoice_rules boolean not null default false,
    supports_peppol_rules boolean not null default false,
    supports_vi_da_readiness boolean not null default false,

    summary text not null default '',
    disclaimer text not null default '',

    published_at timestamptz,
    deprecated_at timestamptz,

    created_by uuid references auth.users(id) on delete set null,
    updated_by uuid references auth.users(id) on delete set null,

    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),

    constraint country_pack_registry_country_code_format
        check (country_code ~ '^[A-Z]{2}$'),

    constraint country_pack_registry_unique_version
        unique (country_code, pack_version)
);

create index if not exists country_pack_registry_country_code_idx
    on public.country_pack_registry(country_code);

create index if not exists country_pack_registry_lifecycle_status_idx
    on public.country_pack_registry(lifecycle_status);

create index if not exists country_pack_registry_published_at_idx
    on public.country_pack_registry(published_at desc);

alter table public.country_pack_registry enable row level security;

create policy "Workspace members can read country pack registry"
    on public.country_pack_registry
    for select
    to authenticated
    using (true);

create policy "Admins can manage country pack registry"
    on public.country_pack_registry
    for all
    to authenticated
    using (
        exists (
            select 1
            from public.organization_memberships membership
            where membership.user_id = auth.uid()
              and membership.role in ('owner', 'admin')
        )
    )
    with check (
        exists (
            select 1
            from public.organization_memberships membership
            where membership.user_id = auth.uid()
              and membership.role in ('owner', 'admin')
        )
    );

create or replace function public.set_country_pack_registry_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists trg_country_pack_registry_updated_at
    on public.country_pack_registry;

create trigger trg_country_pack_registry_updated_at
before update on public.country_pack_registry
for each row
execute function public.set_country_pack_registry_updated_at();

insert into public.country_pack_registry (
    country_code,
    country_name,
    pack_version,
    lifecycle_status,
    legal_confidence,
    source_count,
    rule_count,
    supports_vat_rules,
    supports_invoice_rules,
    supports_peppol_rules,
    supports_vi_da_readiness,
    summary,
    disclaimer,
    published_at
)
values
(
    'EU',
    'European Union Core',
    '2026.1',
    'published',
    'technical',
    0,
    0,
    true,
    true,
    true,
    true,
    'Core technical sandbox registry entry for EU-wide Invoice Lantern validation readiness.',
    'Country packs are independent technical readiness resources and do not represent official legal, tax authority, Peppol, or ViDA certification.',
    timezone('utc', now())
)
on conflict do nothing;
