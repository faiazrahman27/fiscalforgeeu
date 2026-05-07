# Local UBL XSD artefact setup

Invoice Lantern can run technical UBL XSD checks against local UBL Invoice and
CreditNote schema artefacts. This helps developers and operators verify that the
local validator can find and read the configured schema files before XML
validation jobs are run.

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

The validator does not fetch remote schema files. All schema files must already
exist locally and be readable by the process running the worker or API.

## What This Does Not Do

This setup does not add or provide:

- Peppol Schematron validation.
- EN 16931 certification or business-rule certification.
- Official EU, tax authority, or filing validation.
- Legal, tax, or accounting compliance.
- A guarantee that an invoice will be accepted by any authority, network, or
  trading partner.

## Environment Variables

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

## Recommended Local Structure

Keep downloaded UBL artefacts outside source control unless the artefact license
and repository policy explicitly allow committing them.

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
```

With this layout, `UBL_XSD_ROOT_DIR` should point at the `UBL-2.1` directory.

## Windows PowerShell Example

From the repository root:

```powershell
$env:UBL_XSD_ROOT_DIR = "D:\invoice-lantern-local\ubl\UBL-2.1"
$env:UBL_XSD_ARTIFACT_VERSION = "2.1"

npm --prefix apps/xml-worker run xsd:diagnostics
```

If the main document files are not in the standard `xsd\maindoc` location, set
the file paths explicitly:

```powershell
$env:UBL_XSD_ROOT_DIR = "D:\invoice-lantern-local\ubl\custom-ubl"
$env:UBL_INVOICE_XSD_PATH = "D:\invoice-lantern-local\ubl\custom-ubl\xsd\maindoc\UBL-Invoice-2.1.xsd"
$env:UBL_CREDIT_NOTE_XSD_PATH = "D:\invoice-lantern-local\ubl\custom-ubl\xsd\maindoc\UBL-CreditNote-2.1.xsd"
$env:UBL_XSD_ARTIFACT_VERSION = "2.1-local"

npm --prefix apps/xml-worker run xsd:diagnostics
```

For one command without persisting environment variables in the shell:

```powershell
$env:UBL_XSD_ROOT_DIR = "D:\invoice-lantern-local\ubl\UBL-2.1"; $env:UBL_XSD_ARTIFACT_VERSION = "2.1"; npm --prefix apps/xml-worker run xsd:diagnostics
```

## Diagnostics

Run:

```powershell
npm --prefix apps/xml-worker run xsd:diagnostics
```

The command prints metadata-only JSON. It includes:

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

The diagnostics do not return raw XML, schema file contents, secrets, or full
absolute local filesystem paths.

## Troubleshooting

`not_configured`

: No schema path could be resolved. Set `UBL_XSD_ROOT_DIR` with
  `UBL_XSD_ARTIFACT_VERSION`, or set `UBL_INVOICE_XSD_PATH` and
  `UBL_CREDIT_NOTE_XSD_PATH` explicitly.

`missing`

: A schema path was configured or derived, but the file does not exist. Check the
  local download path and the UBL version in the filename.

`unreadable`

: The configured path is not a readable file. Confirm file permissions and make
  sure the path points to an XSD file, not a directory.

Dependency graph blocked

: The main XSD was readable, but one of its local dependencies could not be
  prepared safely. Review the reported blocked code and inspect the local
  artefact layout.

Out-of-root dependency

: A schema dependency resolves outside `UBL_XSD_ROOT_DIR`. Keep the full local
  UBL artefact tree under the configured root, or adjust the root to contain all
  reviewed local dependencies.

External dependency blocked

: The XSD references an absolute, URL-based, or protocol-relative schema
  location. Invoice Lantern does not fetch remote schemas during diagnostics or
  validation. Use reviewed local artefacts with local relative schema references.

Hash mismatch

: Step 46 diagnostics compute SHA-256 values for readable schema files but do not
  compare them to a pinned expected hash. A hash mismatch is not expected from
  this step unless a future deployment policy adds expected hash checks.

## Security Notes

- Use local artefacts only.
- Remote schema fetching is blocked.
- Raw XML is not stored in Supabase, local XML validation job JSON storage, API
  request logs, worker output, result summaries, findings, or test snapshots.
- Diagnostics do not return schema file contents.
- Diagnostics avoid full absolute local paths and use safe labels such as
  basenames or paths relative under `UBL_XSD_ROOT_DIR`.
- Do not commit downloaded artefacts unless the artefact license and repository
  policy allow it.

## Supabase

No Supabase migration is needed for Step 46. Do not run a new migration on
Supabase.
