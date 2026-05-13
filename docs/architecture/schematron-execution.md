# Schematron Execution

Invoice Lantern supports guarded local Schematron execution for XML validation
jobs when an operator explicitly enables it with reviewed local artefacts. This
is an independent technical sandbox check only. It is not official validation,
not Peppol certification, not EN 16931 certification, not legal, tax, or
accounting advice, not official filing, not authority acceptance, and not a
compliance guarantee.

## Configuration Gate

Schematron execution is disabled by default. Blank or missing configuration
returns `not_configured`, `disabled`, or `preflight_only` style metadata with
`validationExecuted: false` and `markedValid: false`.

Execution can start only when all of these are true:

- `SCHEMATRON_EXECUTION_MODE=execute`
- `SCHEMATRON_ENGINE=xpath_engine`
- `SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION=true`, `1`, or `yes`
- `PEPPOL_SCHEMATRON_ROOT_DIR` points to the reviewed local artefact root
- the requested layer path is configured, readable, and inside that root
- the path is local, not a URL or protocol path
- XML safety checks pass
- the Schematron artefact uses only the supported subset

The layer path variables are:

- `PEPPOL_BIS_SCHEMATRON_PATH` for the Peppol BIS Billing-style layer
- `EN16931_SCHEMATRON_PATH` for the EN 16931 / TC434-style layer
- `SCHEMATRON_ARTIFACT_VERSION` for a safe local artefact version label

## Supported Subset

The Step 8 executor uses the existing `fontoxpath` plus `slimdom` foundation.
It reads local Schematron files offline and supports this guarded ISO
Schematron subset:

- namespace `http://purl.oclc.org/dsdl/schematron`
- `sch:schema`
- `sch:ns` prefix mappings
- `sch:pattern`
- `sch:rule context`
- `sch:assert test`
- `sch:report test`
- `id`, `flag`, and `role` attributes
- simple text-only diagnostics
- Invoice and CreditNote XML roots
- Peppol BIS Billing-style and EN 16931 / TC434-style layer selection

Failed assertions and successful reports are mapped through
`schematron_result_mapper_v1` into sanitized `schematron_contract_v1` findings.
Findings can include stable codes, severity, status, layer, rule identifiers,
business rule identifiers when identifiable, safe locations, sanitized test
expressions, sanitized assertion/report text, source labels, and technical legal
confidence. Raw XML and full Schematron contents are never returned.

## Safe Failures

Unsupported or unsafe inputs fail closed. They do not mark the document valid.
The executor returns `unsupported`, `unsafe_input`, `not_configured`, or `error`
with safe findings and summaries.

Blocked inputs include:

- missing or unreadable artefacts
- artefacts outside the configured root
- remote URLs or protocol paths
- DTDs, entities, XXE indicators, external identifiers, and XML stylesheets
- Schematron includes, extends, phases, abstract patterns/rules, `let`, and
  unsupported query bindings
- XSLT-only or foreign constructs that affect execution
- XPath `document()` or external loading functions
- extension functions, dynamic evaluation, local file reads, and network reads

Unsupported constructs are reported explicitly. They are not silently ignored.
If an artefact cannot be fully evaluated with the supported subset,
`validationExecuted` remains false and `markedValid` remains false.

## Result Semantics

`markedValid: true` can appear only for the technical Schematron check when:

- execution actually ran;
- the selected artefact was fully evaluated by the supported engine path;
- no failed assertions were produced; and
- no fatal/error findings occurred.

This means only that Invoice Lantern's guarded local technical Schematron check
did not find a failed assertion for that configured artefact. It is not a legal,
tax, accounting, Peppol, EN 16931, filing, authority, or compliance conclusion.

The deprecated `schematron_peppol_placeholder` check remains a safe preflight
metadata alias. Real execution checks are `schematron_peppol` and
`schematron_en16931`.

## API And Worker Integration

The API inline XML validation path and XML worker path both call the shared
package-level execution orchestrator. XSD validation remains separate and
unchanged.

XML validation job summaries and findings persist safe Schematron status,
`validationExecuted`, `markedValid`, artefact labels, layer info, policy info,
engine info, and mapped findings. Summaries do not include raw XML, Schematron
file contents, secrets, full absolute local paths, remote fetch output, or
official/compliance wording.
