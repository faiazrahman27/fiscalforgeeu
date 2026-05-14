import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getCookieTrackingStance,
  getPrivacyDataMap,
  getSubprocessorList
} from "./privacy-data-map-service.js";

function getDataMapRecord(datasetKey: string) {
  const record = getPrivacyDataMap().records.find(
    (candidate) => candidate.datasetKey === datasetKey
  );

  assert.ok(record, `Expected privacy data map record ${datasetKey}`);

  return record;
}

test("privacy data map covers key datasets with safe raw payload and legal-review boundaries", () => {
  for (const datasetKey of [
    "validation_reports",
    "xml_metadata",
    "api_logs",
    "webhook_logs",
    "vies_evidence",
    "vida_simulations",
    "legal_acceptances",
    "activity_security_audit"
  ]) {
    const record = getDataMapRecord(datasetKey);

    assert.equal(record.legalReviewRequired, true);
    assert.equal(record.rawPayloadStored, false);
    assert.match(record.riskNote, /not|must|require|review/i);
  }

  assert.match(getDataMapRecord("api_logs").riskNote, /API key hashes/i);
  assert.match(getDataMapRecord("webhook_logs").riskNote, /Signing secrets/i);
  assert.match(getDataMapRecord("vies_evidence").userFacingDescription, /without raw SOAP/i);
  assert.match(getDataMapRecord("xml_metadata").riskNote, /Raw XML/i);

  const serialized = JSON.stringify(getPrivacyDataMap());

  assert.match(serialized, /GDPR-aware privacy-support controls/i);
  assert.match(serialized, /not a GDPR compliance guarantee/i);
  assert.doesNotMatch(
    serialized,
    /\bGDPR compliant\b|\bguaranteed GDPR\b|\bofficial filing\b|\bauthority acceptance\b/i
  );
});

test("subprocessor list is review-required and uses known configured states only", () => {
  const subprocessors = getSubprocessorList();
  const allowedStatuses = new Set([
    "configured",
    "not_configured",
    "review_required"
  ]);

  assert.ok(subprocessors.records.length > 0);
  assert.match(subprocessors.disclaimer, /professional review/i);

  for (const record of subprocessors.records) {
    assert.equal(record.legalReviewRequired, true);
    assert.equal(allowedStatuses.has(record.status), true);
    assert.doesNotMatch(
      JSON.stringify(record),
      /\blegally approved\b|\bGDPR compliant\b|\bcompliance guarantee\b/i
    );
  }
});

test("cookie tracking stance remains essential-only without analytics tracking", () => {
  const stance = getCookieTrackingStance();

  assert.equal(stance.record.stance, "essential_only");
  assert.equal(stance.record.essentialCookiesUsed, true);
  assert.equal(stance.record.nonEssentialCookiesUsed, false);
  assert.equal(stance.record.analyticsConfigured, false);
  assert.equal(stance.record.legalReviewRequired, true);
  assert.match(stance.disclaimer, /not legal advice/i);
});
