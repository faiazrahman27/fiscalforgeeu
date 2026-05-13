# Schematron Artifact Review Intake

Invoice Lantern uses Schematron artifact review intake as internal package-level process metadata for preparing reviewed expected hash recording. It sits between the source register and the manifest so future maintainers can record what was reviewed before manually adding an expected SHA-256 value to the manifest.

This process is not a public API feature, not artifact execution, not authority submission, not filing, not legal/tax/accounting advice, and not a compliance guarantee. Invoice Lantern remains an independent, non-official EU e-invoice validation and ViDA-readiness sandbox.

## What It Records

The intake module records safe metadata only:

- The reviewed artifact layer, currently `peppol_bis_billing` or `en16931_tc434`.
- The artifact slot ID expected by the source register and manifest.
- The source register record selected for review.
- The manifest record selected for review.
- The expected artifact version label, when supplied.
- The expected SHA-256 value, when supplied and sanitized.
- Optional reviewer label, timestamp, and notes after safe text checks.
- Checklist completion states for source, provenance, safety, and legal-boundary confirmations.
- Warnings and blockers that decide whether the hash is eligible for later manual manifest recording.

The intake result always keeps execution disabled. `eligibleForExecution` is always `false`, and artifact execution flags remain `false`.

## Relationship To The Source Register

The source register describes the intended local Schematron artifact slots and safe public provenance metadata. Intake checks that the selected layer has a source register record and that the requested artifact slot ID matches that record.

The source register may list public HTTPS source and documentation metadata, but intake does not fetch those URLs. Reviewers must confirm that source and documentation metadata were reviewed outside this automated process.

## Relationship To The Manifest

The manifest records expected local artifact slots and, only after review, expected SHA-256 values. Intake checks that the selected layer has a manifest record and that the requested artifact slot ID matches it.

Intake never modifies manifest constants. A passing intake result only means the supplied metadata is eligible to be manually copied into the manifest later by a maintainer. The optional suggestion helper returns process metadata for that manual step and still states that separate professional review is required.

## Expected Hash Recording

Expected hashes must not be invented. They should be recorded only after a maintainer has reviewed the source metadata, reviewed documentation metadata, compared the local artifact hash, and completed the safety checklist.

If no expected SHA-256 value is supplied, or if the value fails the strict 64-character hexadecimal sanitizer, the intake result is blocked. A recorded expected hash means only that a hash value passed the internal intake process. Hash recording is not validation success.

## Safety Boundary

The intake process does not:

- Store or return raw XML.
- Return Schematron file contents.
- Return full absolute local filesystem paths.
- Fetch remote resources.
- Download artifacts.
- Execute Schematron.
- Add public API request options.
- Enable normal XML worker jobs to execute Schematron.
- Mutate the source register or manifest.

Reviewer labels, notes, timestamps, artifact version labels, and expected hashes are sanitized so unsafe URLs, file paths, credential-like text, XML-like text, and malformed hash values are rejected or omitted.

## Legal Boundary

The reviewed-artifact intake process is technical checklist metadata only. It does not represent official validation, does not certify compliance, does not provide legal/tax/accounting advice, does not submit to any authority, and does not predict authority acceptance.

This foundation prepares reviewed artifact integration while preserving the platform boundary: guarded execution is possible only through the explicit Step 8 policy, local artifact, engine, and XML safety gates. Professional review remains required, and any execution result is a technical sandbox result only, not official validation or a legal/tax/accounting/compliance conclusion.
