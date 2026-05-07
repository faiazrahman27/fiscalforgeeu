import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  buildSafeSchematronArtifactDiagnostics,
  buildSafeUblXsdArtifactDiagnostics
} from "./xsd-artifact-registry.js";

const schemaContentSentinel = "SCHEMA-CONTENT-SENTINEL-STEP-46";
const schematronContentSentinel = "SCHEMATRON-CONTENT-SENTINEL-STEP-47";
const rawXmlSentinel = "<Invoice><ID>RAW-XML-SENTINEL-STEP-47</ID></Invoice>";

function collectStringValues(value: unknown, strings: string[] = []) {
  if (typeof value === "string") {
    strings.push(value);
    return strings;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringValues(item, strings);
    }

    return strings;
  }

  if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectStringValues(item, strings);
    }
  }

  return strings;
}

function assertNoDiagnosticStringContains(value: unknown, forbidden: string) {
  for (const diagnosticValue of collectStringValues(value)) {
    assert.equal(
      diagnosticValue.includes(forbidden),
      false,
      `Unexpected diagnostics leak: ${diagnosticValue}`
    );
  }
}

async function writeTestOnlyInvoiceXsdFixture(tempRoot: string) {
  const maindocPath = join(tempRoot, "xsd", "maindoc");
  const commonPath = join(tempRoot, "xsd", "common");
  const invoiceXsdPath = join(maindocPath, "UBL-Invoice-2.1.xsd");
  const baseXsdPath = join(commonPath, "Invoice-Test-Only-Base.xsd");

  await mkdir(maindocPath, {
    recursive: true
  });
  await mkdir(commonPath, {
    recursive: true
  });
  await writeFile(
    invoiceXsdPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:annotation>
    <xs:documentation>${schemaContentSentinel}</xs:documentation>
  </xs:annotation>
  <xs:include schemaLocation="../common/Invoice-Test-Only-Base.xsd"/>
  <xs:element name="Invoice" type="InvoiceType"/>
</xs:schema>`,
    "utf8"
  );
  await writeFile(
    baseXsdPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="InvoiceType">
    <xs:sequence>
      <xs:element name="ID" type="xs:string"/>
    </xs:sequence>
  </xs:complexType>
</xs:schema>`,
    "utf8"
  );

  return {
    invoiceXsdPath,
    baseXsdPath
  };
}

async function writeTestOnlySchematronFixture(tempRoot: string) {
  const peppolPath = join(
    tempRoot,
    "schematron",
    "peppol",
    "PEPPOL-BIS-Billing-Test-Only.sch"
  );
  const en16931Path = join(
    tempRoot,
    "schematron",
    "tc434",
    "EN16931-TC434-Test-Only.sch"
  );

  await mkdir(join(tempRoot, "schematron", "peppol"), {
    recursive: true
  });
  await mkdir(join(tempRoot, "schematron", "tc434"), {
    recursive: true
  });
  await writeFile(
    peppolPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<schema xmlns="http://purl.oclc.org/dsdl/schematron">
  <title>${schematronContentSentinel}</title>
  <pattern id="peppol-test-only">
    <rule context="Invoice">
      <assert test="cbc:ID">Test-only Peppol rule.</assert>
    </rule>
  </pattern>
</schema>`,
    "utf8"
  );
  await writeFile(
    en16931Path,
    `<?xml version="1.0" encoding="UTF-8"?>
<schema xmlns="http://purl.oclc.org/dsdl/schematron">
  <title>${schematronContentSentinel}</title>
  <pattern id="en16931-test-only">
    <rule context="Invoice">
      <assert test="cbc:IssueDate">Test-only EN 16931 rule.</assert>
    </rule>
  </pattern>
</schema>`,
    "utf8"
  );

  return {
    peppolPath,
    en16931Path
  };
}

test("safe UBL XSD diagnostics report no configured artefacts", async () => {
  const diagnostics = await buildSafeUblXsdArtifactDiagnostics(undefined);

  assert.equal(diagnostics.diagnosticKind, "ubl_xsd_artifacts");
  assert.equal(diagnostics.configured, false);
  assert.equal(diagnostics.usable, false);
  assert.equal(diagnostics.readySchemaCount, 0);
  assert.equal(diagnostics.requiredSchemaCount, 2);
  assert.equal(diagnostics.allRequiredSchemasReadable, false);
  assert.equal(diagnostics.validatorName, "xmllint-wasm");
  assert.equal(typeof diagnostics.validatorAvailable, "boolean");
  assert.equal(diagnostics.artifactVersion, null);
  assert.match(diagnostics.checkedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(diagnostics.invoiceSchema.configured, false);
  assert.equal(diagnostics.invoiceSchema.status, "not_configured");
  assert.equal(diagnostics.invoiceSchema.readable, false);
  assert.equal(diagnostics.invoiceSchema.sha256, null);
  assert.equal(diagnostics.invoiceSchema.label, null);
  assert.equal(diagnostics.creditNoteSchema.status, "not_configured");
  assert.equal(diagnostics.dependencyGraph.inspected, false);
  assert.equal(diagnostics.dependencyGraph.status, "not_inspected");
  assert.match(diagnostics.disclaimer, /not official validation/i);
  assert.match(diagnostics.disclaimer, /not.*compliance guarantee/i);
  assertNoDiagnosticStringContains(diagnostics, rawXmlSentinel);
});

test("safe UBL XSD diagnostics report readable Invoice metadata only", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-xsd-diag-"));

  try {
    const { invoiceXsdPath, baseXsdPath } =
      await writeTestOnlyInvoiceXsdFixture(tempRoot);
    const diagnostics = await buildSafeUblXsdArtifactDiagnostics({
      rootDir: tempRoot,
      invoiceXsdPath,
      artifactVersion: "test-only"
    });

    assert.equal(diagnostics.configured, true);
    assert.equal(diagnostics.usable, true);
    assert.equal(diagnostics.readySchemaCount, 1);
    assert.equal(diagnostics.allRequiredSchemasReadable, false);
    assert.equal(diagnostics.artifactVersion, "test-only");
    assert.equal(diagnostics.invoiceSchema.configured, true);
    assert.equal(diagnostics.invoiceSchema.status, "available");
    assert.equal(diagnostics.invoiceSchema.readable, true);
    assert.equal(diagnostics.invoiceSchema.usable, true);
    assert.match(diagnostics.invoiceSchema.sha256 ?? "", /^[a-f0-9]{64}$/);
    assert.equal(
      diagnostics.invoiceSchema.label,
      "xsd/maindoc/UBL-Invoice-2.1.xsd"
    );
    assert.equal(diagnostics.invoiceSchema.basename, "UBL-Invoice-2.1.xsd");
    assert.equal(
      diagnostics.invoiceSchema.relativePathUnderRoot,
      "xsd/maindoc/UBL-Invoice-2.1.xsd"
    );
    assert.equal(diagnostics.creditNoteSchema.status, "not_configured");
    assert.equal(diagnostics.dependencyGraph.inspected, true);
    assert.equal(diagnostics.dependencyGraph.status, "ready");
    assert.equal(diagnostics.dependencyGraph.dependencyCount, 1);
    assert.equal(diagnostics.dependencyGraph.inspectedSchemaCount, 1);
    assertNoDiagnosticStringContains(diagnostics, schemaContentSentinel);
    assertNoDiagnosticStringContains(diagnostics, rawXmlSentinel);
    assertNoDiagnosticStringContains(diagnostics, tempRoot);
    assertNoDiagnosticStringContains(diagnostics, invoiceXsdPath);
    assertNoDiagnosticStringContains(diagnostics, baseXsdPath);
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("safe UBL XSD diagnostics report missing configured files safely", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-xsd-diag-"));
  const missingInvoiceXsdPath = join(
    tempRoot,
    "xsd",
    "maindoc",
    "UBL-Invoice-2.1.xsd"
  );

  try {
    const diagnostics = await buildSafeUblXsdArtifactDiagnostics({
      rootDir: tempRoot,
      invoiceXsdPath: missingInvoiceXsdPath,
      artifactVersion: "test-only"
    });

    assert.equal(diagnostics.configured, true);
    assert.equal(diagnostics.usable, false);
    assert.equal(diagnostics.invoiceSchema.configured, true);
    assert.equal(diagnostics.invoiceSchema.status, "missing");
    assert.equal(diagnostics.invoiceSchema.readable, false);
    assert.equal(diagnostics.invoiceSchema.usable, false);
    assert.equal(diagnostics.invoiceSchema.sha256, null);
    assert.equal(
      diagnostics.invoiceSchema.relativePathUnderRoot,
      "xsd/maindoc/UBL-Invoice-2.1.xsd"
    );
    assert.equal(diagnostics.dependencyGraph.inspected, false);
    assert.equal(diagnostics.dependencyGraph.status, "not_inspected");
    assertNoDiagnosticStringContains(diagnostics, tempRoot);
    assertNoDiagnosticStringContains(diagnostics, missingInvoiceXsdPath);
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("safe UBL XSD diagnostics use basename-only labels without a root", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-xsd-diag-"));

  try {
    const { invoiceXsdPath } = await writeTestOnlyInvoiceXsdFixture(tempRoot);
    const diagnostics = await buildSafeUblXsdArtifactDiagnostics({
      invoiceXsdPath,
      artifactVersion: "test-only"
    });

    assert.equal(diagnostics.invoiceSchema.status, "available");
    assert.equal(diagnostics.invoiceSchema.label, "UBL-Invoice-2.1.xsd");
    assert.equal(diagnostics.invoiceSchema.basename, "UBL-Invoice-2.1.xsd");
    assert.equal("relativePathUnderRoot" in diagnostics.invoiceSchema, false);
    assertNoDiagnosticStringContains(diagnostics, tempRoot);
    assertNoDiagnosticStringContains(diagnostics, invoiceXsdPath);
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("safe UBL XSD diagnostics report blocked external dependencies without leaking schema contents", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-xsd-diag-"));
  const maindocPath = join(tempRoot, "xsd", "maindoc");
  const invoiceXsdPath = join(maindocPath, "UBL-Invoice-2.1.xsd");
  const externalSchemaLocation = "https://schemas.example.invalid/ubl-secret.xsd";

  try {
    await mkdir(maindocPath, {
      recursive: true
    });
    await writeFile(
      invoiceXsdPath,
      `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:annotation>
    <xs:documentation>${schemaContentSentinel}</xs:documentation>
  </xs:annotation>
  <xs:include schemaLocation="${externalSchemaLocation}"/>
  <xs:element name="Invoice" type="xs:string"/>
</xs:schema>`,
      "utf8"
    );

    const diagnostics = await buildSafeUblXsdArtifactDiagnostics({
      rootDir: tempRoot,
      invoiceXsdPath,
      artifactVersion: "test-only"
    });

    assert.equal(diagnostics.invoiceSchema.status, "available");
    assert.equal(diagnostics.dependencyGraph.inspected, true);
    assert.equal(
      diagnostics.dependencyGraph.status,
      "external_reference_blocked"
    );
    assert.equal(
      diagnostics.dependencyGraph.blockedCode,
      "external_schema_location_not_supported"
    );
    assert.equal(diagnostics.dependencyGraph.blockedDocumentType, "invoice");
    assertNoDiagnosticStringContains(diagnostics, schemaContentSentinel);
    assertNoDiagnosticStringContains(diagnostics, externalSchemaLocation);
    assertNoDiagnosticStringContains(diagnostics, tempRoot);
    assertNoDiagnosticStringContains(diagnostics, invoiceXsdPath);
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("safe Schematron diagnostics report no configured artefacts", async () => {
  const diagnostics = await buildSafeSchematronArtifactDiagnostics(undefined);

  assert.equal(diagnostics.diagnosticKind, "schematron_artifacts");
  assert.equal(diagnostics.configured, false);
  assert.equal(diagnostics.usable, false);
  assert.equal(diagnostics.readyArtifactCount, 0);
  assert.equal(diagnostics.requiredArtifactCount, 2);
  assert.equal(diagnostics.allRequiredArtifactsReadable, false);
  assert.equal(diagnostics.validatorName, "schematron-placeholder");
  assert.equal(diagnostics.validatorAvailable, false);
  assert.equal(diagnostics.validationExecutionEnabled, false);
  assert.equal(diagnostics.artifactVersion, null);
  assert.match(diagnostics.checkedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(diagnostics.peppolBisArtifact.artifactKind, "peppol_bis_billing");
  assert.equal(diagnostics.peppolBisArtifact.configured, false);
  assert.equal(diagnostics.peppolBisArtifact.status, "not_configured");
  assert.equal(diagnostics.peppolBisArtifact.readable, false);
  assert.equal(diagnostics.peppolBisArtifact.sha256, null);
  assert.equal(diagnostics.peppolBisArtifact.label, null);
  assert.equal(diagnostics.en16931Artifact.artifactKind, "en16931_tc434");
  assert.equal(diagnostics.en16931Artifact.status, "not_configured");
  assert.match(diagnostics.disclaimer, /do not execute Schematron validation/i);
  assert.match(diagnostics.disclaimer, /not official validation/i);
  assert.match(diagnostics.disclaimer, /not.*compliance guarantee/i);
  assertNoDiagnosticStringContains(diagnostics, rawXmlSentinel);
});

test("safe Schematron diagnostics report readable Peppol and EN 16931 metadata only", async () => {
  const tempRoot = await mkdtemp(
    join(tmpdir(), "invoice-lantern-sch-diag-")
  );

  try {
    const { peppolPath, en16931Path } =
      await writeTestOnlySchematronFixture(tempRoot);
    const diagnostics = await buildSafeSchematronArtifactDiagnostics({
      rootDir: tempRoot,
      peppolBisSchematronPath: peppolPath,
      en16931SchematronPath: en16931Path,
      artifactVersion: "test-only"
    });

    assert.equal(diagnostics.configured, true);
    assert.equal(diagnostics.usable, true);
    assert.equal(diagnostics.readyArtifactCount, 2);
    assert.equal(diagnostics.requiredArtifactCount, 2);
    assert.equal(diagnostics.allRequiredArtifactsReadable, true);
    assert.equal(diagnostics.validatorName, "schematron-placeholder");
    assert.equal(diagnostics.validatorAvailable, false);
    assert.equal(diagnostics.validationExecutionEnabled, false);
    assert.equal(diagnostics.artifactVersion, "test-only");
    assert.equal(diagnostics.peppolBisArtifact.configured, true);
    assert.equal(diagnostics.peppolBisArtifact.status, "available");
    assert.equal(diagnostics.peppolBisArtifact.readable, true);
    assert.equal(diagnostics.peppolBisArtifact.usable, true);
    assert.match(diagnostics.peppolBisArtifact.sha256 ?? "", /^[a-f0-9]{64}$/);
    assert.equal(
      diagnostics.peppolBisArtifact.label,
      "schematron/peppol/PEPPOL-BIS-Billing-Test-Only.sch"
    );
    assert.equal(
      diagnostics.peppolBisArtifact.basename,
      "PEPPOL-BIS-Billing-Test-Only.sch"
    );
    assert.equal(
      diagnostics.peppolBisArtifact.relativePathUnderRoot,
      "schematron/peppol/PEPPOL-BIS-Billing-Test-Only.sch"
    );
    assert.equal(diagnostics.en16931Artifact.configured, true);
    assert.equal(diagnostics.en16931Artifact.status, "available");
    assert.equal(diagnostics.en16931Artifact.readable, true);
    assert.match(diagnostics.en16931Artifact.sha256 ?? "", /^[a-f0-9]{64}$/);
    assert.equal(
      diagnostics.en16931Artifact.label,
      "schematron/tc434/EN16931-TC434-Test-Only.sch"
    );
    assertNoDiagnosticStringContains(diagnostics, schematronContentSentinel);
    assertNoDiagnosticStringContains(diagnostics, rawXmlSentinel);
    assertNoDiagnosticStringContains(diagnostics, tempRoot);
    assertNoDiagnosticStringContains(diagnostics, peppolPath);
    assertNoDiagnosticStringContains(diagnostics, en16931Path);
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("safe Schematron diagnostics report missing configured files safely", async () => {
  const tempRoot = await mkdtemp(
    join(tmpdir(), "invoice-lantern-sch-diag-")
  );
  const missingPeppolPath = join(
    tempRoot,
    "schematron",
    "peppol",
    "PEPPOL-BIS-Billing-Test-Only.sch"
  );

  try {
    const diagnostics = await buildSafeSchematronArtifactDiagnostics({
      rootDir: tempRoot,
      peppolBisSchematronPath: missingPeppolPath,
      artifactVersion: "test-only"
    });

    assert.equal(diagnostics.configured, true);
    assert.equal(diagnostics.usable, false);
    assert.equal(diagnostics.readyArtifactCount, 0);
    assert.equal(diagnostics.peppolBisArtifact.configured, true);
    assert.equal(diagnostics.peppolBisArtifact.status, "missing");
    assert.equal(diagnostics.peppolBisArtifact.readable, false);
    assert.equal(diagnostics.peppolBisArtifact.usable, false);
    assert.equal(diagnostics.peppolBisArtifact.sha256, null);
    assert.equal(
      diagnostics.peppolBisArtifact.relativePathUnderRoot,
      "schematron/peppol/PEPPOL-BIS-Billing-Test-Only.sch"
    );
    assert.equal(diagnostics.en16931Artifact.status, "not_configured");
    assertNoDiagnosticStringContains(diagnostics, tempRoot);
    assertNoDiagnosticStringContains(diagnostics, missingPeppolPath);
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("safe Schematron diagnostics use basename-only labels without a root", async () => {
  const tempRoot = await mkdtemp(
    join(tmpdir(), "invoice-lantern-sch-diag-")
  );

  try {
    const { peppolPath } = await writeTestOnlySchematronFixture(tempRoot);
    const diagnostics = await buildSafeSchematronArtifactDiagnostics({
      peppolBisSchematronPath: peppolPath,
      artifactVersion: "test-only"
    });

    assert.equal(diagnostics.peppolBisArtifact.status, "available");
    assert.equal(
      diagnostics.peppolBisArtifact.label,
      "PEPPOL-BIS-Billing-Test-Only.sch"
    );
    assert.equal(
      diagnostics.peppolBisArtifact.basename,
      "PEPPOL-BIS-Billing-Test-Only.sch"
    );
    assert.equal("relativePathUnderRoot" in diagnostics.peppolBisArtifact, false);
    assertNoDiagnosticStringContains(diagnostics, schematronContentSentinel);
    assertNoDiagnosticStringContains(diagnostics, tempRoot);
    assertNoDiagnosticStringContains(diagnostics, peppolPath);
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});
