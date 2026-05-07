# Local UBL XSD and Schematron artefact setup

Invoice Lantern can run technical UBL XSD checks against local UBL Invoice and
CreditNote schema artefacts. It can also inspect local Peppol BIS Billing and
EN 16931 / TC434 Schematron artefact configuration as metadata-only diagnostics.

The UBL XSD diagnostics help developers and operators verify that the local XSD
validator can find and read configured schema files before XML validation jobs
are run.

The Schematron diagnostics added in Step 47 are registry diagnostics only. They
confirm whether local Schematron files are configured and readable. They do not
execute Schematron validation yet.

Step 48 wires those same safe Schematron artefact diagnostics into XML
validation job results when `schematron_peppol_placeholder` is requested. The
job result and placeholder check summary remain metadata-only: Schematron
validation is still not executed, Peppol and EN 16931 are not certified, and no
raw XML, Schematron file contents, or absolute local filesystem paths are
returned.

Step 49 adds the stable `schematron_contract_v1` Schematron finding/result
contract foundation for future rule-level findings. Optional future fields
include `ruleId`, `businessRuleId`, `schematronLayer`, `ruleLocation`,
`testExpression`, `assertionText`, and `diagnosticReference`. These fields are
sanitized and must not contain raw XML, local absolute paths, or file contents.
This is contract preparation only: Schematron validation is still not executed,
Schematron rules are not parsed or evaluated, and there is no certification,
compliance guarantee, legal/tax/accounting conclusion, or authority acceptance
claim.

Step 50 adds the `schematron_adapter_preflight_v1` Schematron execution adapter
preflight foundation. XML validation jobs can now report whether Schematron
artefacts are not configured, unreadable, or ready for future execution. This is
still metadata-only: it does not execute Schematron validation, parse
Schematron rules, evaluate XPath assertions, certify Peppol or EN 16931, prove
compliance, provide legal/tax/accounting conclusions, or indicate authority
acceptance. Even `ready_for_future_execution` means only that safe artefact
metadata is usable for a future engine boundary. It does not mean valid,
compliant, certified, or accepted. No raw XML, Schematron file contents, or full
absolute local filesystem paths are returned.

Step 51 adds the `schematron_policy_v1` Schematron execution policy layer. XML
validation jobs can now report the selected future engine metadata and whether
the server policy is `disabled`, `preflight_only`, or
`blocked_requested_execution`. The policy can be influenced by
`SCHEMATRON_EXECUTION_MODE`, `SCHEMATRON_ENGINE`, and
`SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION`, but in Step 51 these are policy and
metadata controls only. Execution-like values are blocked, `executionPermitted`
remains `false`, `validationExecutionEnabled` remains `false`, and no real
Schematron execution is available yet. This does not certify Peppol or EN
16931, prove compliance, provide legal/tax/accounting conclusions, or indicate
authority acceptance.

These diagnostics are configuration checks only. Invoice Lantern is an
independent, non-official EU e-invoice validation and ViDA-readiness sandbox.
This is not official EU software, not a tax authority system, not
Peppol-certified, not official filing, not legal, tax, or accounting advice, and
not a compliance guarantee.

## What This Uses

The local UBL XSD check uses:

- `xmllint-wasm` as the local validator backend.
- Local UBL Invoice XSD artefacts for UBL Invoice XML.
- Local UBL CreditNote XSD artefacts for UBL CreditNote XML.
- Local schema dependencies referenced by the configured XSD files.

The Schematron registry diagnostics use:

- Local Peppol BIS Billing Schematron artefact paths.
- Local EN 16931 / TC434 Schematron artefact paths.
- Metadata-only file inspection.
- SHA-256 hashes for readable configured artefact files.

The validator and diagnostics do not fetch remote schema or Schematron files.
All artefact files must already exist locally and be readable by the process
running the worker or API.

## What This Does Not Do

This setup does not add or provide:

- Peppol Schematron execution.
- EN 16931 / TC434 Schematron execution.
- Peppol certification.
- EN 16931 certification or business-rule certification.
- Official EU, tax authority, or filing validation.
- Legal, tax, or accounting compliance.
- A guarantee that an invoice will be accepted by any authority, network, or
  trading partner.

## UBL XSD Environment Variables

`UBL_XSD_ROOT_DIR`

: Optional but recommended. Points to the local root directory that contains the
  UBL XSD artefacts. When this is set, Invoice Lantern blocks configured schema
  paths and dependencies that resolve outside this root.

`UBL_INVOICE_XSD_PATH`

: Optional when `UBL_XSD_ROOT_DIR` and a derivable `UBL_XSD_ARTIFACT_VERSION`
  such as `2.1` are set. Otherwise set this to the local Invoice XSD file.

`UBL_CREDIT_NOTE_XSD_PATH`

: Optional when `UBL_XSD_ROOT_DIR` and a derivable `UBL_XSD_ARTIFACT_VERSION`
  such as `2.1` are set. Otherwise set this to the local CreditNote XSD file.

`UBL_XSD_ARTIFACT_VERSION`

: Optional metadata label for the local artefact set. When the value is a simple
  version such as `2.1`, Invoice Lantern can derive default paths under
  `xsd/maindoc`.

## Schematron Environment Variables

`PEPPOL_SCHEMATRON_ROOT_DIR`

: Optional but recommended. Points to the local root directory that contains the
  reviewed Schematron artefacts. When this is set, Invoice Lantern blocks
  configured Schematron paths that resolve outside this root.

`PEPPOL_BIS_SCHEMATRON_PATH`

: Optional for diagnostics, required later when Peppol BIS Billing Schematron
  execution is implemented. Set this to the local Peppol BIS Billing Schematron
  file.

`EN16931_SCHEMATRON_PATH`

: Optional for diagnostics, required later when EN 16931 / TC434 Schematron
  execution is implemented. Set this to the local EN 16931 / TC434 Schematron
  file.

`SCHEMATRON_ARTIFACT_VERSION`

: Optional metadata label for the local Schematron artefact set. Use a value
  that helps identify the downloaded/reviewed artefact version, release, or
  internal review batch.

`SCHEMATRON_EXECUTION_MODE`

: Optional policy metadata selector. Missing or blank means `preflight_only`.
  `disabled` records a disabled policy. `preflight_only` records metadata-only
  preflight. Execution-like values such as `enabled`, `execute`, `real`, or
  `production` are recorded as `blocked_requested_execution` and do not enable
  validation in Step 51.

`SCHEMATRON_ENGINE`

: Optional future engine metadata selector. Supported metadata values include
  `none`, `placeholder`, `xslt2`, `saxon`, `future_xslt2`, `schxslt`, and
  `future_schxslt`. Unknown values are classified as `unknown`. This does not
  load, parse, or run any engine in Step 51.

`SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION`

: Optional boolean-like policy metadata flag. `true`, `1`, and `yes` are treated
  as true; other values are false. In Step 51, true still does not permit
  execution and reports that experimental execution is not available.

## Recommended Local Structure

Keep downloaded UBL and Schematron artefacts outside source control unless the
artefact license and repository policy explicitly allow committing them.

Recommended local layout:

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

With this layout, `UBL_XSD_ROOT_DIR` should point at the `UBL-2.1` directory.
`PEPPOL_SCHEMATRON_ROOT_DIR` can point at the `schematron` directory.

## Windows PowerShell Examples

From the repository root, configure UBL XSD artefacts:

```powershell
$env:UBL_XSD_ROOT_DIR = "D:\invoice-lantern-local\ubl\UBL-2.1"
$env:UBL_XSD_ARTIFACT_VERSION = "2.1"

npm --prefix apps/xml-worker run xsd:diagnostics
```

Configure explicit UBL XSD paths if the files are not in the standard
`xsd\maindoc` location:

```powershell
$env:UBL_XSD_ROOT_DIR = "D:\invoice-lantern-local\ubl\custom-ubl"
$env:UBL_INVOICE_XSD_PATH = "D:\invoice-lantern-local\ubl\custom-ubl\xsd\maindoc\UBL-Invoice-2.1.xsd"
$env:UBL_CREDIT_NOTE_XSD_PATH = "D:\invoice-lantern-local\ubl\custom-ubl\xsd\maindoc\UBL-CreditNote-2.1.xsd"
$env:UBL_XSD_ARTIFACT_VERSION = "2.1-local"

npm --prefix apps/xml-worker run xsd:diagnostics
```

Configure Schematron diagnostics:

```powershell
$env:PEPPOL_SCHEMATRON_ROOT_DIR = "D:\invoice-lantern-local\schematron"
$env:PEPPOL_BIS_SCHEMATRON_PATH = "D:\invoice-lantern-local\schematron\peppol\PEPPOL-BIS-Billing.sch"
$env:EN16931_SCHEMATRON_PATH = "D:\invoice-lantern-local\schematron\tc434\EN16931-TC434.sch"
$env:SCHEMATRON_ARTIFACT_VERSION = "local-reviewed-2026-05"

npm --prefix apps/xml-worker run schematron:diagnostics
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

The UBL XSD diagnostics print metadata-only JSON including:

- Overall configured and usable booleans.
- Validator name and availability.
- Artefact version metadata.
- Checked timestamp.
- Invoice schema configured/readable/status/SHA-256 metadata.
- CreditNote schema configured/readable/status/SHA-256 metadata.
- Safe schema labels such as basenames or paths relative under
  `UBL_XSD_ROOT_DIR`.
- Dependency graph status and dependency count.
- A technical diagnostics disclaimer.

The Schematron diagnostics print metadata-only JSON including:

- Overall configured and usable booleans.
- Placeholder validator name.
- `validationExecutionEnabled: false`.
- Artefact version metadata.
- Checked timestamp.
- Peppol BIS Billing artefact configured/readable/status/SHA-256 metadata.
- EN 16931 / TC434 artefact configured/readable/status/SHA-256 metadata.
- Safe file labels such as basenames or paths relative under
  `PEPPOL_SCHEMATRON_ROOT_DIR`.
- A technical diagnostics disclaimer.

When `schematron_peppol_placeholder` is requested through XML validation jobs,
the result can also include `executionPreflight` with:

- `adapterVersion: "schematron_adapter_preflight_v1"`.
- `mode: "preflight_only"` for XML validation job summaries.
- `preflightStatus` / `status` values such as `not_configured`,
  `artifact_unreadable`, or `ready_for_future_execution`.
- `preflightReason` / `reason` values such as
  `schematron_artifacts_not_configured`,
  `schematron_artifacts_not_usable`, or
  `schematron_artifacts_ready_but_execution_not_enabled`.
- `validationExecutionEnabled: false`, `validationExecuted: false`, and
  `markedValid: false`.

The same placeholder result can also include `executionPolicy` with:

- `policyVersion: "schematron_policy_v1"`.
- `mode` / `policyMode` values such as `disabled`, `preflight_only`, or
  `blocked_requested_execution`.
- `engineId` values such as `none`, `placeholder`, `future_xslt2`,
  `future_schxslt`, or `unknown`.
- `reason` / `policyReason` values such as
  `schematron_execution_disabled_by_policy`,
  `schematron_execution_preflight_only`,
  `schematron_execution_requested_but_blocked`, or
  `schematron_experimental_execution_not_available`.
- `executionPermitted: false` and `validationExecutionEnabled: false`.

The diagnostics do not return raw XML, schema file contents, Schematron file
contents, secrets, or full absolute local filesystem paths.

## Troubleshooting

`not_configured`

: No artefact path could be resolved. Set the relevant root and explicit file
  path environment variables.

`missing`

: A configured or derived artefact path does not exist. Check the local download
  path and filename.

`unreadable`

: The configured path is not a readable file. Confirm file permissions and make
  sure the path points to a file, not a directory.

`out_of_root`

: A configured artefact path resolves outside the configured root. Keep reviewed
  artefacts under the configured root, or adjust the root to contain the reviewed
  local artefact files.

UBL dependency graph blocked

: The main XSD was readable, but one of its local dependencies could not be
  inspected safely. Review the reported blocked code and inspect the local
  artefact layout.

External UBL dependency blocked

: The XSD references an absolute, URL-based, or protocol-relative schema
  location. Invoice Lantern does not fetch remote schemas during diagnostics or
  validation. Use reviewed local artefacts with local relative schema references.

Schematron readable but validation disabled

: This is expected in Steps 47 through 51. The Schematron registry can inspect
  configured files, XML validation jobs can report safe diagnostics, the shared
  finding contract can describe future sanitized rule metadata, the Step 50
  preflight adapter can report `ready_for_future_execution`, and the Step 51
  policy layer can report engine/policy selection metadata, but they do not
  execute Schematron validation yet. Execution-like policy values are blocked.

Hash mismatch

: Step 47 diagnostics compute SHA-256 values for readable artefact files but do
  not compare them to pinned expected hashes. A hash mismatch is not expected
  from this step unless a future deployment policy adds expected hash checks.

## Security Notes

- Use local reviewed artefacts only.
- Remote schema fetching is blocked.
- Schematron execution is not enabled in Steps 47 through 51.
- Step 51 policy variables are metadata controls only and must not be used to
  configure production execution.
- Raw XML is not stored in Supabase, local XML validation job JSON storage, API
  request logs, worker output, result summaries, findings, or test snapshots.
- Diagnostics do not return schema file contents.
- Diagnostics do not return Schematron file contents.
- Diagnostics avoid full absolute local paths and use safe labels such as
  basenames or paths relative under the configured root directory.
- Do not commit downloaded artefacts unless the artefact license and repository
  policy allow it.

## Supabase

No Supabase migration is needed for Step 51. `xml_validation_jobs.result_summary`
and `xml_validation_jobs.findings` are JSONB and can already store the safe
Schematron finding contract, preflight metadata, and policy metadata. No raw XML
column is added and no schema change is required.
