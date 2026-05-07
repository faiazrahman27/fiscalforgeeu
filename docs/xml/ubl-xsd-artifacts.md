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
