# Incident Response

This policy describes Invoice Lantern incident readiness for operational,
security, privacy, XML-safety, API-key, webhook, VIES, admin-rule, and PWA/cache
events. It is an engineering policy draft and requires professional
security/legal/privacy review before production reliance. It is not legal
advice, privacy advice, security certification, breach notification advice,
official filing, or a compliance guarantee.

## Lifecycle

1. Detect: identify signals from application logs, security events, API request
   logs, XML worker failures, webhook delivery failures, auth failures, rate
   limits, privacy workflow failures, and provider alerts.
2. Classify severity: distinguish operational incidents, security incidents,
   suspected data exposure, data breach assessment candidates, XML safety
   events, API-key misuse, webhook receiver issues, platform-admin rule changes,
   and external-service outages.
3. Contain: revoke or rotate API keys, rotate webhook secrets, disable unsafe
   jobs, block endpoint traffic, pause risky workflows, disable VIES, suspend
   platform-admin writes, or temporarily disable PWA caching if needed.
4. Investigate: collect minimized evidence without secrets, raw XML, raw SOAP,
   credentials, private local paths, or raw stack traces.
5. Notify if required: run legal/privacy breach assessment before any external,
   regulator, customer, processor, or subprocessor notification.
6. Fix: patch code/configuration, add regression tests, preserve tenant
   isolation and authorization boundaries, and update docs.
7. Document: record timeline, impact, affected systems, containment, evidence,
   communications, and decisions.
8. Post-incident review: review detection quality, time to contain, missed
   alerts, control gaps, test gaps, and follow-up ownership.

## Severity Model

- Severity 1: confirmed or likely sensitive data exposure, credential exposure,
  cross-tenant access, service-role exposure, webhook secret exposure, or
  production auth/RLS bypass.
- Severity 2: major outage, XML worker unsafe behavior, repeated API-key abuse,
  VIES misconfiguration, or privacy/deletion/export workflow failure.
- Severity 3: degraded validation, webhook delivery failures, rate-limit
  misconfiguration, monitoring gap, or non-sensitive PWA/cache issue.
- Severity 4: documentation, readiness, alerting, or operational hygiene issue.

Severity labels do not decide legal/privacy notification duties. Those require
professional review.

## Data Breach Assessment Workflow

For a suspected personal-data incident:

1. Identify affected organizations, users, records, and time window.
2. Determine data categories using the privacy data map.
3. Confirm whether raw XML/SOAP, invoice data, VAT identifiers, API logs,
   webhook logs, legal acceptances, privacy requests, or credentials were
   exposed.
4. Preserve minimized evidence and hashes; avoid copying raw payloads unless a
   reviewed evidence process requires it.
5. Assess risk with legal/privacy reviewers.
6. Decide whether notifications are required and document the rationale.
7. Track remediation and follow-up controls.

## Evidence Rules

Allowed evidence:

- timestamps
- safe event types
- organization IDs and record IDs
- API route, method, status, and error code
- rule code, country-pack version, worker check type, and job status
- XML hashes and sizes
- webhook delivery IDs and status classes
- API key prefix and key ID, never the full key or hash
- redacted reviewer notes

Forbidden in incident artifacts unless a separate reviewed secure evidence
process is used:

- service-role keys
- database URLs
- API signing secrets
- webhook signing secrets
- email provider keys
- VIES credentials
- full API keys or key hashes
- raw XML or SOAP bodies
- unredacted stack traces
- absolute local filesystem paths
- raw IP addresses or full user agents without a reviewed retention basis

## Roles And Responsibilities

- Incident lead: coordinates lifecycle, timeline, containment, and follow-up.
- Engineering owner: investigates code, infrastructure, XML worker, API, PWA,
  webhook, or validation behavior.
- Security reviewer: reviews severity, evidence, containment, and credential
  rotation.
- Privacy/legal reviewer: assesses breach notification, privacy request impact,
  legal document updates, and external communication.
- Communications owner: prepares customer or public messages only after
  review.

Production deployments must replace placeholders with named operational owners.

## Contact Placeholders

Configure reviewed contacts through server-side deployment configuration:

- `SECURITY_CONTACT_EMAIL`
- `INCIDENT_CONTACT_EMAIL`
- optional provider-specific alert routing outside this repository

Readiness endpoints expose only whether these contacts are configured.
