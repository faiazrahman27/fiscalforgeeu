# Schematron Artifact Manifest

Invoice Lantern keeps a local Schematron artifact manifest as metadata for reviewed artifact preparation. It records the expected local artifact slots for Peppol BIS Billing-style and EN 16931 / TC434-style layers, the environment variables that configure them, the expected artifact version label when one has been reviewed, and the expected SHA-256 value when one has been deliberately recorded.

The manifest is not an execution layer. It does not parse Schematron rules, evaluate XPath, submit anything to an authority, or certify compliance. It is independent technical sandbox infrastructure for auditability, reproducibility, and future professional review.

## Local Artifact Slots

Each manifest record describes one local artifact slot:

- `peppol_bis_billing`
- `en16931_tc434`

Each slot records:

- The source register version and source layer it is aligned with.
- The root, path, and artifact-version environment variable names.
- The expected artifact version label, if reviewed.
- The expected SHA-256 value, if reviewed and recorded.
- Review status such as `expected_hash_missing`, `local_hash_matched`, `local_hash_mismatched`, `deprecated`, or `blocked`.
- Safety flags that remain false for raw XML return, file-content return, full local path return, remote fetching, artifact downloading, and artifact execution.

## Hash Verification

Manifest verification compares only already-safe diagnostics:

- The expected SHA-256 recorded in the manifest.
- The actual SHA-256 already produced by safe local artifact inspection.
- Safe labels such as a basename or a relative path under the configured root.
- Readable, usable, missing, unreadable, out-of-root, or not-configured status.

The verifier does not read artifact contents itself. Existing diagnostics may compute a SHA-256 by reading the configured local file, but the manifest layer only consumes that safe hash metadata.

Hash status values are metadata only:

- `not_applicable` when the slot is not configured.
- `expected_hash_missing` when no reviewed expected hash is recorded.
- `actual_hash_missing` when an expected hash exists but safe inspection did not provide a hash.
- `matched` when the safe local hash equals the expected hash.
- `mismatched` when both hashes exist and differ.

A hash match is not validation success. It only means the inspected local artifact hash matches the recorded expected hash.

## Safety Boundary

The manifest and verifier do not:

- Store or return raw XML.
- Return Schematron file contents.
- Return full absolute local filesystem paths.
- Fetch remote resources.
- Download artifacts.
- Execute Schematron.
- Add public API options for artifact execution or manifest mutation.
- Enable normal XML worker jobs to execute Schematron.

This preserves the platform boundary: Invoice Lantern is an independent, non-official technical sandbox. Manifest verification is hash verification metadata and reviewed artifact preparation only; professional review remains required before any future production execution path is considered.
