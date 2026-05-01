grant usage on schema public to service_role;

/*
 * Server-only API-key verification needs to read key_hash and update private
 * usage metadata. Keep the service-role grants column-scoped; user-facing API
 * key management continues to use authenticated, RLS-scoped clients and
 * metadata-only selects.
 */
grant select (
  id,
  organization_id,
  name,
  key_prefix,
  key_hash,
  environment,
  scopes,
  status,
  expires_at,
  last_used_at,
  last_used_ip,
  created_by,
  revoked_by,
  revoked_at,
  created_at,
  updated_at
)
on table public.api_keys
to service_role;

grant insert (
  organization_id,
  name,
  key_prefix,
  key_hash,
  environment,
  scopes,
  status,
  expires_at,
  created_by
)
on table public.api_keys
to service_role;

grant update (
  status,
  last_used_at,
  last_used_ip,
  revoked_by,
  revoked_at
)
on table public.api_keys
to service_role;

grant select, insert
on table public.api_requests
to service_role;

/*
 * Published validation-rule catalog reads are served by the API process.
 * The route still returns only catalog metadata, not database internals.
 */
grant select
on table public.validation_rule_sets
to service_role;

grant select
on table public.validation_rules
to service_role;

grant select
on table public.validation_rule_sources
to service_role;

/*
 * Organization API-key flows need server-side access to implemented resources
 * after API-key scope and organization metadata have been verified.
 */
grant select (
  id,
  organization_id,
  created_by,
  invoice_number,
  buyer_name,
  seller_name,
  profile,
  issue_date,
  seller_country,
  buyer_country,
  technical_status,
  standard_status,
  country_simulation_status,
  vida_readiness_status,
  confidence,
  currency,
  findings_count,
  payable_amount,
  totals,
  findings,
  disclaimer,
  created_at,
  updated_at
)
on table public.validation_runs
to service_role;

grant select, insert, update
on table public.xml_validation_jobs
to service_role;
