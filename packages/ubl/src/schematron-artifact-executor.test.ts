import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { test } from "node:test";
import {
  buildSafeSchematronArtifactDiagnostics,
  buildSchematronExecutionPolicy,
  inspectSchematronEngineCandidate,
  runSchematronArtifactExecutor,
  runSchematronExecutionOrchestrator
} from "./index.js";
import type {
  SchematronArtifactConfigInput,
  SchematronLayer
} from "./index.js";

const SCH_NS = "http://purl.oclc.org/dsdl/schematron";
const invoiceXml = "<Invoice><ID>INV-SCH-001</ID></Invoice>";
const creditNoteXml = "<CreditNote><ID>CN-SCH-001</ID></CreditNote>";
const windowsPath = "D:\\private\\schematron\\rules.sch";
const unixPath = "/tmp/private/schematron/rules.sch";
const fileUrl = "file:///tmp/private/schematron/rules.sch";
const forbiddenClaimPattern =
  /\bPeppol certified\b|\bEN 16931 compliant\b|\baccepted by authority\b|\blegally valid\b|\bPeppol passed\b|\bEN 16931 passed\b/i;

function schema(body: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<schema xmlns="${SCH_NS}" queryBinding="xpath3">
  ${body}
</schema>`;
}

function rule(input: {
  context: string;
  assertions: string;
  id?: string;
}) {
  return `<pattern id="pattern-${input.id ?? "default"}">
  <rule context="${input.context}" id="rule-${input.id ?? "default"}">
    ${input.assertions}
  </rule>
</pattern>`;
}

async function writeArtifact(path: string, content: string) {
  await mkdir(dirname(path), {
    recursive: true
  });
  await writeFile(path, content, "utf8");
}

async function writeArtifactPair(input: {
  root: string;
  peppol: string;
  en16931?: string;
}) {
  const peppolPath = join(input.root, "rules", "peppol.sch");
  const en16931Path = join(input.root, "rules", "en16931.sch");

  await writeArtifact(peppolPath, input.peppol);
  await writeArtifact(en16931Path, input.en16931 ?? input.peppol);

  return {
    rootDir: input.root,
    peppolBisSchematronPath: peppolPath,
    en16931SchematronPath: en16931Path,
    artifactVersion: "test-only-step-8"
  } satisfies SchematronArtifactConfigInput;
}

async function executionInputs(config: SchematronArtifactConfigInput) {
  const [diagnostics, engineCandidate] = await Promise.all([
    buildSafeSchematronArtifactDiagnostics(config),
    inspectSchematronEngineCandidate({
      engineId: "xpath_engine"
    })
  ]);

  return {
    policy: buildSchematronExecutionPolicy({
      requestedMode: "execute",
      requestedEngine: "xpath_engine",
      allowExperimentalExecution: true
    }),
    engineCandidate,
    artifactDiagnostics: diagnostics
  };
}

async function runExecutor(input: {
  root: string;
  xml?: string;
  layer?: Exclude<SchematronLayer, "unknown">;
  peppol: string;
  en16931?: string;
  maxResults?: number;
}) {
  const config = await writeArtifactPair({
    root: input.root,
    peppol: input.peppol,
    ...(input.en16931 ? { en16931: input.en16931 } : {})
  });
  const shared = await executionInputs(config);

  return runSchematronArtifactExecutor({
    xml: input.xml ?? invoiceXml,
    layer: input.layer ?? "peppol_bis_billing",
    artifactConfig: config,
    ...shared,
    ...(input.maxResults !== undefined ? { maxResults: input.maxResults } : {})
  });
}

function assertNoUnsafeOutput(output: unknown, tempRoot?: string) {
  const serialized = JSON.stringify(output);

  assert.equal(serialized.includes(invoiceXml), false);
  assert.equal(serialized.includes(creditNoteXml), false);
  assert.equal(serialized.includes("<Invoice"), false);
  assert.equal(serialized.includes("<CreditNote"), false);
  assert.equal(serialized.includes(windowsPath), false);
  assert.equal(serialized.includes(unixPath), false);
  assert.equal(serialized.includes(fileUrl), false);
  if (tempRoot) {
    assert.equal(serialized.includes(tempRoot), false);
    assert.equal(serialized.includes(basename(tempRoot)), false);
  }
  assert.doesNotMatch(serialized, /(?:^|[^A-Za-z])[A-Za-z]:[\\/][^"\\s]+/);
  assert.doesNotMatch(serialized, /\/tmp\/private\/[A-Za-z0-9/_.-]+/);
  assert.doesNotMatch(serialized, /file:\/\/\//i);
  assert.doesNotMatch(serialized, forbiddenClaimPattern);
}

test("executor maps a failed local Schematron assert through the Peppol layer", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-sch-exec-"));

  try {
    const result = await runExecutor({
      root: tempRoot,
      peppol: schema(
        rule({
          id: "peppol-fail",
          context: "/Invoice",
          assertions:
            '<assert id="PEPPOL-BR-FAIL" flag="fatal" test="normalize-space(ID) = \'EXPECTED\'">BR-CO-10 identifier must match the expected value.</assert>'
        })
      )
    });
    const finding = result.findings[0];

    assert.equal(result.status, "failed");
    assert.equal(result.validationExecutionEnabled, true);
    assert.equal(result.validationExecuted, true);
    assert.equal(result.markedValid, false);
    assert.equal(result.checkType, "schematron_peppol");
    assert.equal(finding?.code, "PEPPOL_SCHEMATRON_RULE_FAILED");
    assert.equal(finding?.checkType, "schematron_peppol");
    assert.equal(finding?.status, "failed");
    assert.equal(finding?.schematronLayer, "peppol_bis_billing");
    assert.equal(finding?.businessRuleId, "PEPPOL-BR-FAIL");
    assert.equal(finding?.ruleLocation, "/Invoice");
    assert.equal(finding?.testExpression, "normalize-space(ID) = 'EXPECTED'");
    assertNoUnsafeOutput(result, tempRoot);
  } finally {
    await rm(tempRoot, {
      recursive: true,
      force: true
    });
  }
});

test("executor maps successful reports as warnings or info without failed asserts", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-sch-report-"));

  try {
    const result = await runExecutor({
      root: tempRoot,
      peppol: schema(
        rule({
          id: "peppol-report",
          context: "/Invoice",
          assertions:
            '<report id="PEPPOL-REPORT-WARNING" flag="warning" role="warning" test="normalize-space(ID) = \'INV-SCH-001\'">A Peppol-style report warning was emitted.</report><report id="PEPPOL-REPORT-INFO" flag="info" role="info" test="true()">A Peppol-style report info item was emitted.</report>'
        })
      )
    });

    assert.equal(result.status, "executed");
    assert.equal(result.validationExecuted, true);
    assert.equal(result.markedValid, true);
    assert.equal(result.findings.length, 2);
    assert.deepEqual(
      result.findings.map((finding) => [finding.code, finding.severity]),
      [
        ["SCHEMATRON_REPORT_WARNING", "warning"],
        ["SCHEMATRON_REPORT_WARNING", "info"]
      ]
    );
    assertNoUnsafeOutput(result, tempRoot);
  } finally {
    await rm(tempRoot, {
      recursive: true,
      force: true
    });
  }
});

test("executor returns a technical passed result when all supported asserts pass", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-sch-pass-"));

  try {
    const result = await runExecutor({
      root: tempRoot,
      peppol: schema(
        rule({
          id: "peppol-pass",
          context: "/Invoice",
          assertions:
            '<assert id="PEPPOL-BR-PASS" test="normalize-space(ID) = \'INV-SCH-001\'">Identifier exists.</assert>'
        })
      )
    });

    assert.equal(result.status, "executed");
    assert.equal(result.validationExecutionEnabled, true);
    assert.equal(result.validationExecuted, true);
    assert.equal(result.markedValid, true);
    assert.deepEqual(result.findings, []);
    assert.equal(result.safeSummary.parsedArtifact?.assertionCount, 1);
    assertNoUnsafeOutput(result, tempRoot);
  } finally {
    await rm(tempRoot, {
      recursive: true,
      force: true
    });
  }
});

test("executor selects Peppol and EN 16931 local artifacts independently", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-sch-layers-"));

  try {
    const peppol = schema(
      rule({
        id: "peppol-layer",
        context: "/Invoice",
        assertions:
          '<assert id="PEPPOL-LAYER-RULE" test="false()">Peppol-style assertion failed.</assert>'
      })
    );
    const en16931 = schema(
      rule({
        id: "en-layer",
        context: "/CreditNote",
        assertions:
          '<assert id="EN16931-LAYER-RULE" test="false()">BR-EN-10 failed for this credit note.</assert>'
      })
    );
    const peppolResult = await runExecutor({
      root: tempRoot,
      peppol,
      en16931
    });
    const en16931Result = await runExecutor({
      root: tempRoot,
      layer: "en16931_tc434",
      xml: creditNoteXml,
      peppol,
      en16931
    });

    assert.equal(peppolResult.checkType, "schematron_peppol");
    assert.equal(
      peppolResult.findings[0]?.code,
      "PEPPOL_SCHEMATRON_RULE_FAILED"
    );
    assert.equal(en16931Result.checkType, "schematron_en16931");
    assert.equal(
      en16931Result.findings[0]?.code,
      "EN16931_SCHEMATRON_RULE_FAILED"
    );
    assert.equal(en16931Result.findings[0]?.schematronLayer, "en16931_tc434");
    assertNoUnsafeOutput(peppolResult, tempRoot);
    assertNoUnsafeOutput(en16931Result, tempRoot);
  } finally {
    await rm(tempRoot, {
      recursive: true,
      force: true
    });
  }
});

test("executor returns not_configured without marking valid when artifact config is absent", async () => {
  const shared = await executionInputs({});
  const result = await runSchematronArtifactExecutor({
    xml: invoiceXml,
    layer: "peppol_bis_billing",
    ...shared
  });

  assert.equal(result.status, "not_configured");
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.markedValid, false);
  assert.equal(result.findings[0]?.code, "SCHEMATRON_ARTIFACT_NOT_CONFIGURED");
  assertNoUnsafeOutput(result);
});

test("executor rejects unsupported Schematron constructs without partial success", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-sch-unsup-"));

  try {
    const result = await runExecutor({
      root: tempRoot,
      peppol: schema(
        '<let name="unsupported" value="true()"/>' +
          rule({
            id: "unsupported-let",
            context: "/Invoice",
            assertions:
              '<assert id="PEPPOL-UNSUPPORTED" test="true()">Unsupported construct should block execution.</assert>'
          })
      )
    });

    assert.equal(result.status, "unsupported");
    assert.equal(result.validationExecutionEnabled, true);
    assert.equal(result.validationExecuted, false);
    assert.equal(result.markedValid, false);
    assert.equal(result.reason, "schematron_artifact_let_unsupported");
    assert.equal(result.findings[0]?.status, "unsupported");
    assertNoUnsafeOutput(result, tempRoot);
  } finally {
    await rm(tempRoot, {
      recursive: true,
      force: true
    });
  }
});

test("executor rejects unsafe XML before local Schematron execution", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-sch-unsafe-"));

  try {
    const result = await runExecutor({
      root: tempRoot,
      xml: `<?xml version="1.0"?><!DOCTYPE Invoice [<!ENTITY xxe SYSTEM "${fileUrl}">]><Invoice><ID>&xxe;</ID></Invoice>`,
      peppol: schema(
        rule({
          id: "unsafe-xml",
          context: "/Invoice",
          assertions:
            '<assert id="PEPPOL-UNSAFE" test="true()">Should not execute.</assert>'
        })
      )
    });

    assert.equal(result.status, "unsafe_input");
    assert.equal(result.validationExecutionEnabled, true);
    assert.equal(result.validationExecuted, false);
    assert.equal(result.markedValid, false);
    assert.equal(result.findings[0]?.status, "unsafe_input");
    assertNoUnsafeOutput(result, tempRoot);
  } finally {
    await rm(tempRoot, {
      recursive: true,
      force: true
    });
  }
});

test("executor rejects external document XPath functions safely", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-sch-docfn-"));

  try {
    const result = await runExecutor({
      root: tempRoot,
      peppol: schema(
        rule({
          id: "doc-function",
          context: "/Invoice",
          assertions:
            '<assert id="PEPPOL-DOC-FN" test="doc(\'file:///tmp/private/invoice.xml\')">External document loading must not run.</assert>'
        })
      )
    });

    assert.equal(result.status, "unsupported");
    assert.equal(result.validationExecuted, false);
    assert.equal(
      result.reason,
      "schematron_xpath_expression_external_reference_blocked"
    );
    assertNoUnsafeOutput(result, tempRoot);
  } finally {
    await rm(tempRoot, {
      recursive: true,
      force: true
    });
  }
});

test("executor blocks remote and out-of-root artifact configuration", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-sch-paths-"));
  const shared = await executionInputs({
    rootDir: tempRoot,
    peppolBisSchematronPath: "https://example.test/PEPPOL.sch",
    en16931SchematronPath: join(tempRoot, "rules", "en16931.sch")
  });

  try {
    const remoteResult = await runSchematronArtifactExecutor({
      xml: invoiceXml,
      layer: "peppol_bis_billing",
      artifactConfig: {
        rootDir: tempRoot,
        peppolBisSchematronPath: "https://example.test/PEPPOL.sch",
        en16931SchematronPath: join(tempRoot, "rules", "en16931.sch")
      },
      ...shared
    });
    const outsideRootResult = await runSchematronArtifactExecutor({
      xml: invoiceXml,
      layer: "peppol_bis_billing",
      artifactConfig: {
        rootDir: tempRoot,
        peppolBisSchematronPath: join(dirname(tempRoot), "outside.sch")
      },
      ...shared
    });

    assert.equal(remoteResult.status, "artifact_unreadable");
    assert.equal(remoteResult.validationExecuted, false);
    assert.equal(remoteResult.markedValid, false);
    assert.equal(outsideRootResult.status, "artifact_unreadable");
    assert.equal(outsideRootResult.validationExecuted, false);
    assert.equal(outsideRootResult.markedValid, false);
    assertNoUnsafeOutput(remoteResult, tempRoot);
    assertNoUnsafeOutput(outsideRootResult, tempRoot);
  } finally {
    await rm(tempRoot, {
      recursive: true,
      force: true
    });
  }
});

test("executor sanitizes XML fragments, local paths, and assurance claims", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-sch-sanitize-"));

  try {
    const result = await runExecutor({
      root: tempRoot,
      peppol: schema(
        rule({
          id: "sanitize",
          context: "/Invoice",
          assertions: `<assert id="PEPPOL-SANITIZE" test="false()">&lt;Invoice&gt;&lt;ID&gt;SECRET&lt;/ID&gt;&lt;/Invoice&gt; ${windowsPath} ${unixPath} ${fileUrl} certified compliant accepted by authority legally valid Peppol passed EN 16931 passed</assert>`
        })
      )
    });
    const serialized = JSON.stringify(result);

    assert.equal(result.status, "failed");
    assert.equal(serialized.includes("[xml-fragment]"), true);
    assert.equal(serialized.includes("[local-path]"), true);
    assert.equal(serialized.includes("[local-file-reference]"), true);
    assert.equal(serialized.includes("[assurance-claim]"), true);
    assertNoUnsafeOutput(result, tempRoot);
  } finally {
    await rm(tempRoot, {
      recursive: true,
      force: true
    });
  }
});

test("executor caps mapped result count without marking truncated failures valid", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-sch-cap-"));

  try {
    const result = await runExecutor({
      root: tempRoot,
      xml: "<Invoice><Line/><Line/><Line/></Invoice>",
      maxResults: 1,
      peppol: schema(
        rule({
          id: "cap",
          context: "/Invoice/Line",
          assertions:
            '<assert id="PEPPOL-CAP" test="false()">Each line fails this test-only assertion.</assert>'
        })
      )
    });

    assert.equal(result.status, "failed");
    assert.equal(result.validationExecuted, true);
    assert.equal(result.markedValid, false);
    assert.equal(result.findings.length, 1);
    assert.equal(result.safeSummary.findingCount, 1);
    assertNoUnsafeOutput(result, tempRoot);
  } finally {
    await rm(tempRoot, {
      recursive: true,
      force: true
    });
  }
});

test("orchestrator execute mode evaluates both configured layers", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-sch-orch-"));

  try {
    const config = await writeArtifactPair({
      root: tempRoot,
      peppol: schema(
        rule({
          id: "peppol-orch",
          context: "/Invoice",
          assertions:
            '<assert id="PEPPOL-ORCH" test="normalize-space(ID) = \'INV-SCH-001\'">Peppol-style ID assertion.</assert>'
        })
      ),
      en16931: schema(
        rule({
          id: "en-orch",
          context: "/Invoice",
          assertions:
            '<assert id="EN16931-ORCH" test="normalize-space(ID) = \'INV-SCH-001\'">EN 16931-style ID assertion.</assert>'
        })
      )
    });
    const shared = await executionInputs(config);
    const result = await runSchematronExecutionOrchestrator({
      xml: invoiceXml,
      mode: "execute",
      layers: "both",
      artifactConfig: config,
      ...shared
    });

    assert.equal(result.status, "executed");
    assert.deepEqual(result.selectedLayers, [
      "peppol_bis_billing",
      "en16931_tc434"
    ]);
    assert.equal(result.validationExecutionEnabled, true);
    assert.equal(result.validationExecuted, true);
    assert.equal(result.markedValid, true);
    assert.equal(result.layerSummaries.length, 2);
    assert.deepEqual(
      result.layerSummaries.map((summary) => [
        summary.layer,
        summary.status,
        summary.markedValid
      ]),
      [
        ["peppol_bis_billing", "executed", true],
        ["en16931_tc434", "executed", true]
      ]
    );
    assertNoUnsafeOutput(result, tempRoot);
  } finally {
    await rm(tempRoot, {
      recursive: true,
      force: true
    });
  }
});
