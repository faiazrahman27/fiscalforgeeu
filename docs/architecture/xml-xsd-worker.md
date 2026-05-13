# XML XSD Worker Path

Invoice Lantern's `xsd_ubl` check is an independent, local, technical UBL XSD
validation path for XML validation jobs. It is standards-based and
source-linked through configured local artefacts, but it is not official
validation, Peppol certification, EN 16931 certification, legal, tax, or
accounting advice, official filing, authority acceptance, or a compliance
guarantee.

## Configuration

Configure reviewed local UBL XSD artefacts with server-side environment
variables:

- `UBL_XSD_ROOT_DIR`: local root directory that contains the reviewed UBL XSD
  artefacts and dependencies.
- `UBL_INVOICE_XSD_PATH`: local `UBL-Invoice-2.1.xsd` path, if it cannot be
  derived from `UBL_XSD_ROOT_DIR` and the artefact version.
- `UBL_CREDIT_NOTE_XSD_PATH`: local `UBL-CreditNote-2.1.xsd` path, if it
  cannot be derived from `UBL_XSD_ROOT_DIR` and the artefact version.
- `UBL_XSD_ARTIFACT_VERSION`: human-readable local artefact version, for
  example `2.1` or an internal reviewed package label.

The worker and API never download UBL artefacts and never fetch remote schemas.
Operators must place reviewed schema files on local server storage before
enabling the check.

## Execution

When an XML validation job requests `xsd_ubl`, the API inline path and XML
worker path call the shared `validateUblXsd` adapter from `packages/ubl`.

Configured behavior:

- The adapter selects Invoice or CreditNote from the detected XML root.
- The selected XSD path must be readable and inside `UBL_XSD_ROOT_DIR` when a
  root is configured.
- Schema dependencies are resolved locally only.
- Absolute paths, URL schema locations, protocol-relative schema locations, and
  dependencies outside the configured artefact root are blocked.
- `xmllint-wasm` runs against the local schema set when the configuration and
  dependency graph are safe.
- Results include `validationExecuted`, `markedValid`, artefact version/path
  summaries, safe mapped findings, and a legal-safe disclaimer.

Not configured behavior:

- Missing or unreadable required XSD paths return `status: "not_configured"`.
- `validationExecuted` is `false`.
- `markedValid` is `false`.
- The job records a warning finding and safe artefact diagnostics.
- `not_configured` is never treated as schema success.

Failed validation behavior:

- `validationExecuted` is `true`.
- `markedValid` is `false`.
- Raw validator output is mapped into bounded structured findings.
- Findings may include safe line numbers and sanitized technical messages, but
  they must not include raw XML, full XSD contents, secrets, or local absolute
  filesystem details.

Passed validation behavior:

- `validationExecuted` is `true`.
- `markedValid` is `true` only for the technical `xsd_ubl` check.
- The result may say local technical UBL XSD validation passed.
- It must not say legal, tax, accounting, Peppol, EN 16931, official filing, or
  authority acceptance passed.

## XML Safety

The API and worker preserve the XML safety gate before execution:

- no DTD or `DOCTYPE`;
- no entity declarations or XXE;
- no `SYSTEM` or `PUBLIC` external identifiers;
- no XML stylesheet processing instructions;
- configured max body size;
- configured max nesting;
- no remote schema fetching.

The adapter also performs its own XML safety inspection before invoking the XSD
backend, so direct package callers cannot bypass the safety boundary.

## Storage And Logging

Validation jobs store metadata, hashes, sizes, check results, summaries, and
findings. They do not permanently store raw XML. Async jobs use transient XML
payload storage with TTL, hash verification, size verification, and cleanup.
Hash mismatch, size mismatch, missing payload, expired payload, unsafe XML, and
worker timeouts fail safely without raw XML in responses or logs.

Tenant-owned job records remain scoped by `organization_id`. API requests must
pass authentication or the scoped `xml:validation_jobs` API key permission, plus
the existing workspace role/RBAC checks.

## Schematron Boundary

XML worker jobs can also request `schematron_peppol` and
`schematron_en16931`. Those checks use the shared guarded local Schematron
execution path from `packages/ubl` only when execution is explicitly configured
with reviewed local artefacts, `SCHEMATRON_EXECUTION_MODE=execute`,
`SCHEMATRON_ENGINE=xpath_engine`, and
`SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION=true` or another true-like value.

Blank/default configuration remains disabled or preflight-only:
`validationExecuted` is `false` and `markedValid` is `false`. Missing,
unreadable, out-of-root, remote, unsupported, unsafe, timeout, and error cases
fail safely and are not marked valid.

The deprecated `schematron_peppol_placeholder` request remains a safe
preflight/metadata alias. The Step 8 executor is not the Step 9 EN
16931/Peppol-style rule catalog or business-rule intelligence layer, and it
does not provide certification, legal/tax/accounting conclusions, official
filing, authority acceptance, or a compliance guarantee.
