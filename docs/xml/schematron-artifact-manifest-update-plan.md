# Schematron Artifact Manifest Update Plan

Invoice Lantern uses this document to describe the internal maintainer-only dry-run process for planning Schematron artifact manifest hash recording.

This process is package-level metadata infrastructure only. It does not execute Schematron, does not download artifacts, does not write files automatically, does not mutate manifest constants automatically, and does not expose any public API behavior.

## Purpose

The manifest update-plan layer helps maintainers review whether a completed Schematron artifact review intake result is eligible for a manual manifest hash update.

It produces a deterministic dry-run plan showing:

- the target manifest record
- whether the matching manifest record exists
- whether the review intake is eligible
- which manifest fields would change
- whether a manual patch object can be safely prepared
- blockers that prevent a manifest update
- safety and legal warnings that must remain visible

The plan is designed to support controlled review before maintainers manually update manifest constants.

## What this is not

This is not:

- Schematron execution
- public XML validation
- production Peppol validation
- production EN 16931 validation
- automatic manifest mutation
- artifact downloading
- remote artifact fetching
- official validation
- Peppol certification
- legal advice
- tax advice
- accounting advice
- authority filing
- authority acceptance
- a compliance guarantee

A recorded expected SHA-256 hash only means that maintainers intentionally recorded a reviewed hash value in the manifest. It does not mean any invoice, XML file, or transaction has passed validation.

## Version

The update-plan module version is:

```ts
SCHEMATRON_ARTIFACT_MANIFEST_UPDATE_PLAN_VERSION =
  "schematron_artifact_manifest_update_plan_v1";
