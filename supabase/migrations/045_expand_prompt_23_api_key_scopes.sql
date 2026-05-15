/*
 * Invoice Lantern
 * Migration 045: expand API key scope constraint for Prompt 23.
 *
 * Additive only.
 *
 * This migration updates the database-level api_keys.scopes constraint so it
 * matches the source-controlled API scope registry used by the backend.
 *
 * Scope boundary:
 * - These scopes authorize sandbox/developer API access only.
 * - They do not grant signed-user workspace permissions.
 * - They do not bypass RBAC, RLS, rate limits, request logging, validation,
 *   legal acceptance boundaries, XML safety checks, or workspace object scope.
 *
 * Prompt 23 legal boundary:
 * - Country-pack, transaction-classification, reverse-charge, learning scenario,
 *   and ViDA-readiness outputs are independent educational technical simulation
 *   contexts only.
 * - They are not legal, tax, accounting, VAT-return, filing, authority,
 *   official ViDA, Peppol, EN 16931, CII, or compliance determinations.
 */

begin;

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
    'invoices:export_cii',
    'invoices:parse_cii',
    'invoices:import_cii',
    'xml:validation_jobs',
    'vat:validate_format',
    'vat:check_vies',
    'transactions:classify',
    'transactions:simulate_vida',
    'learning_scenarios:read',
    'validation_runs:read',
    'rules:read'
  ]::text[]
);

comment on constraint api_keys_scopes_supported_chk on public.api_keys is
'Supported Invoice Lantern organization API-key scopes. Prompt 23 country-pack, transaction, learning scenario, reverse-charge, and ViDA-readiness scopes authorize sandbox/developer API access only and do not create legal, tax, accounting, filing, authority, or compliance determinations.';

commit;
