# Monitoring, Security, And Incident Readiness

Invoice Lantern exposes safe readiness surfaces for operational review. These
surfaces support engineering and security operations; they are not uptime
promises, security certifications, legal/privacy determinations, official
filing evidence, tax/accounting advice, or compliance guarantees.

## API Surfaces

- `GET /health`: minimal public health. No environment name, secrets, paths, or
  provider details.
- `GET /ready`: minimal public readiness. Safe high-level checks only.
- `GET /api/v1/health`: same minimal health under the versioned API prefix.
- `GET /api/v1/health/ready`: same minimal readiness under the versioned API
  prefix.
- `GET /api/v1/workspace/security/readiness`: signed-user owner/admin/developer
  readiness detail for workspace operators. Organization API keys are rejected.

Detailed readiness reports safe configured/unconfigured state only. It must not
return database URLs, service-role keys, signing keys, provider credentials,
platform-admin emails, absolute paths, raw XML, raw SOAP, API key values,
webhook secrets, stack traces, or private artefact paths.

## Metrics Inventory

The readiness model tracks the metric inventory that a deployment should wire
to a reviewed monitoring provider:

- `validation_runs_total`
- `validation_errors_by_rule`
- `ubl_exports_total`
- `xml_uploads_total`
- `xml_rejected_total`
- `xsd_validation_jobs_total`
- `schematron_jobs_total`
- `vies_checks_total`
- `vida_simulations_total`
- `api_requests_total`
- `api_errors_total`
- `rate_limit_blocks`
- `auth_failures_total`
- `webhook_delivery_total`
- `webhook_delivery_failures`
- `webhook_retry_total`
- `country_pack_usage`
- `validation_worker_timeouts`
- `retention_runs_total`
- `deletion_runs_total`
- `privacy_requests_total`
- `legal_acceptances_total`
- `admin_rule_changes_total`
- `suspicious_activity_events_total`

Metrics should be aggregate or minimized. They should use rule codes, statuses,
durations, counts, versions, and safe hashes where needed. They must not store
raw invoice payloads, raw XML/SOAP bodies, API key secrets, webhook signing
secrets, VIES credentials, service-role keys, database URLs, or raw stack
traces.

## Alerting Checklist

- API error-rate spike
- auth failures or repeated missing-scope failures
- rate-limit blocks by organization or API key prefix
- XML unsafe-input rejections
- XML worker timeout/failure spike
- VIES external-service unavailable spike
- webhook delivery failures and retry exhaustion
- platform-admin publish/deprecate/archive events
- privacy export/deletion/retention run failures
- legal acceptance failures for required documents
- suspicious security events or blocked object access

## Security Readiness Checklist

- RBAC and tenant isolation reviewed.
- API keys hashed, scoped, rate-limited, shown once, and never stored in browser
  storage.
- XML protections block DTDs, entities, remote fetching, oversized payloads, and
  unsafe paths.
- VIES is explicit, disabled by default, rate-limited, and does not store raw
  SOAP.
- Webhooks enforce SSRF protections, signing, secret encryption, bounded
  retries, and safe logs.
- PWA cache excludes authenticated workspace/API data and sensitive workflows.
- Legal/privacy acceptance workflows remain versioned and professional-review
  aware.
- Export, deletion, retention, and privacy requests remain owner/admin scoped.
- Platform-admin writes require backend-only allow-list authorization.
- Production environment disables local JSON storage and development API keys.

## Incident Integration

Incident readiness uses the existing `security_events` and workspace activity
foundations for safe evidence. Incident artifacts should contain:

- timestamps
- safe event types
- organization IDs where tenant-owned
- API path/method/status metadata
- rule codes, job IDs, hashes, or delivery IDs where useful
- containment actions and reviewer notes

Incident artifacts must not contain secrets, raw XML, raw SOAP, full API keys,
webhook secrets, service-role keys, VIES credentials, database URLs, raw IP
addresses unless a reviewed policy requires them, or full user agents unless a
reviewed policy requires them.

## Monitoring Provider Placeholders

`MONITORING_PROVIDER`, `SECURITY_CONTACT_EMAIL`, and
`INCIDENT_CONTACT_EMAIL` are optional placeholders. Readiness responses expose
only configured/unconfigured booleans. They do not activate third-party
tracking, analytics, cookies, or provider calls.

Adding Sentry or another provider should be a later explicit, environment-gated
integration with reviewed data minimization and DSN/token handling.
