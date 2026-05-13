# Local UBL XSD and Schematron Artefact Setup

Invoice Lantern can run independent technical XML checks against reviewed local
artefacts. UBL XSD validation uses local UBL Invoice and CreditNote schemas.
Schematron execution uses local Peppol BIS Billing-style and EN 16931 /
TC434-style Schematron artefacts only when the guarded execution policy is
explicitly enabled.

These checks are standards-based technical sandbox checks. They are not official
validation, Peppol certification, EN 16931 certification, legal, tax, or
accounting advice, official filing, authority acceptance, or a compliance
guarantee.

## UBL XSD

The `xsd_ubl` XML validation job check calls the local `xmllint-wasm` adapter
from `packages/ubl` when local artefacts are configured.

Configuration:

- `UBL_XSD_ROOT_DIR`
- `UBL_INVOICE_XSD_PATH`
- `UBL_CREDIT_NOTE_XSD_PATH`
- `UBL_XSD_ARTIFACT_VERSION`

The XSD path stays local/offline. Invoice Lantern does not download artefacts,
fetch remote schemas, follow remote schema references, or return schema file
contents. Missing, unreadable, out-of-root, or unsafe schema dependency cases
return `not_configured` or `error` with `validationExecuted: false` or
`markedValid: false` as appropriate.

## Schematron

The real Schematron checks are:

- `schematron_peppol`
- `schematron_en16931`

The deprecated `schematron_peppol_placeholder` request remains available as a
safe preflight/metadata alias for backwards compatibility.

Configuration:

- `PEPPOL_SCHEMATRON_ROOT_DIR`
- `PEPPOL_BIS_SCHEMATRON_PATH`
- `EN16931_SCHEMATRON_PATH`
- `SCHEMATRON_ARTIFACT_VERSION`
- `SCHEMATRON_EXECUTION_MODE`
- `SCHEMATRON_ENGINE`
- `SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION`

Blank or missing Schematron configuration keeps execution disabled or
preflight-only. It returns `validationExecuted: false` and
`markedValid: false`.

Guarded local execution can start only when:

- `SCHEMATRON_EXECUTION_MODE=execute`
- `SCHEMATRON_ENGINE=xpath_engine`
- `SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION=true`, `1`, or `yes`
- the requested local artefact is readable and inside
  `PEPPOL_SCHEMATRON_ROOT_DIR`
- no remote fetching, local file loading, extension functions, or unsupported
  constructs are needed
- XML safety checks pass

The executor uses `fontoxpath` and `slimdom` through the package-level guarded
XPath engine. It supports `sch:schema`, `sch:ns`, `sch:pattern`,
`sch:rule context`, `sch:assert test`, `sch:report test`, `id`, `flag`, `role`,
simple text-only diagnostics, and Invoice/CreditNote XML roots.

Unsupported constructs such as includes, extends, phases, abstract
patterns/rules, `let`, unsupported query bindings, XSLT-only constructs,
external `document()` loading, dynamic evaluation, local file reads, and network
reads fail safely with `unsupported`, `unsafe_input`, `not_configured`, or
`error`. Unsupported features are reported explicitly and are not silently
ignored.

## Result Semantics

Schematron findings are mapped through `schematron_result_mapper_v1` into the
sanitized `schematron_contract_v1` finding shape. Results can include safe
codes, severity, status, check type, layer, rule identifiers, business rule
identifiers when identifiable, safe locations, sanitized XPath test
expressions, sanitized assertion/report text, source labels, and technical
legal confidence.

`markedValid: true` can appear only for the technical check when execution
actually ran, the supported artefact was fully evaluated, no failed assertions
were produced, and no fatal/error findings occurred. It does not mean legal,
tax, accounting, Peppol, EN 16931, filing, authority, or compliance approval.

Raw XML, Schematron file contents, schema file contents, secrets, remote fetch
output, and full absolute local filesystem paths are not returned in diagnostics,
job summaries, findings, logs, or test snapshots.

## Local Layout

Keep downloaded artefacts outside source control unless the artefact license and
repository policy explicitly allow committing them.

```text
local-artifacts/
  ubl/
    UBL-2.1/
      xsd/
        maindoc/
          UBL-Invoice-2.1.xsd
          UBL-CreditNote-2.1.xsd
        common/
          ...
  schematron/
    peppol/
      PEPPOL-BIS-Billing.sch
    tc434/
      EN16931-TC434.sch
```

## Diagnostics Commands

Run UBL XSD diagnostics:

```powershell
npm --prefix apps/xml-worker run xsd:diagnostics
```

Run Schematron artefact diagnostics:

```powershell
npm --prefix apps/xml-worker run schematron:diagnostics
```

These diagnostics inspect safe local metadata only. They do not return raw XML
or artefact contents.

## Supabase

No Supabase migration is needed for the guarded Schematron execution layer. API
and worker results fit the existing `xml_validation_jobs.result_summary` and
`xml_validation_jobs.findings` JSONB fields. Tenant isolation, RLS assumptions,
workspace role checks, and API-key scope checks remain unchanged.
