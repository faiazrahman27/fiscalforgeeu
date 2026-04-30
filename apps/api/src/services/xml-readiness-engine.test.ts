import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectXmlReadiness } from "./xml-readiness-engine.js";

test("rejects XML DTD and ENTITY constructs before parsing readiness data", () => {
  const inspection = inspectXmlReadiness(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Invoice [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <ID>&xxe;</ID>
</Invoice>`);

  assert.equal(inspection.report.technicalStatus, "failed");
  assert.equal(
    inspection.report.findings.some(
      (finding) =>
        finding.code === "XML_SECURITY_POLICY_FAILED" &&
        finding.severity === "fatal"
    ),
    true
  );
});
