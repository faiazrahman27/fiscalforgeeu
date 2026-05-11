/*
 * Harden API key and API request persistence constraints.
 *
 * This migration keeps 025 intact and adds production-grade database guards:
 * - API key scopes must be non-empty.
 * - Every stored scope must be from the supported Invoice Lantern scope list.
 * - Key prefixes must be globally unique, not only unique per organization.
 * - API request log text fields get bounded lengths.
 */

alter table public.api_keys
drop constraint if exists api_keys_scopes_supported_chk;

alter table public.api_keys
add constraint api_keys_scopes_supported_chk
check (
  cardinality(scopes) between 1 and 32
  and scopes <@ array[
    'invoices:validate',
    'invoices:export_ubl',
    'invoices:parse_ubl',
    'invoices:import_ubl',
    'xml:validation_jobs',
    'vat:validate_format',
    'transactions:simulate_vida',
    'validation_runs:read',
    'rules:read'
  ]::text[]
);

create unique index if not exists api_keys_key_prefix_unique_idx
on public.api_keys (key_prefix);

alter table public.api_requests
drop constraint if exists api_requests_user_agent_length_chk;

alter table public.api_requests
add constraint api_requests_user_agent_length_chk
check (
  user_agent is null
  or char_length(user_agent) <= 512
);

alter table public.api_requests
drop constraint if exists api_requests_error_code_length_chk;

alter table public.api_requests
add constraint api_requests_error_code_length_chk
check (
  error_code is null
  or char_length(trim(error_code)) between 1 and 120
);
