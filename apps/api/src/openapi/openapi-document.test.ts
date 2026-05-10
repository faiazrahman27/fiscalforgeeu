import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../app.js";
import { openApiDocument } from "./openapi-document.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(
  record: Record<string, unknown>,
  key: string
): Record<string, unknown> {
  const value = record[key];

  assert.equal(isRecord(value), true, `${key} should be an object`);

  return value as Record<string, unknown>;
}

function getOpenApiDocument(value: unknown) {
  assert.equal(isRecord(value), true);

  return value as Record<string, unknown>;
}

function getPaths(document: Record<string, unknown>) {
  return readRecord(document, "paths");
}

test("GET /api/v1/openapi.json returns the active OpenAPI document", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/openapi.json"
  });

  assert.equal(response.statusCode, 200);
  assert.match(String(response.headers["cache-control"]), /max-age=300/);

  const document = getOpenApiDocument(response.json());

  assert.equal(document.openapi, "3.1.0");

  const info = readRecord(document, "info");

  assert.equal(info.title, "Invoice Lantern Developer API");
  assert.match(String(info.description), /non-official/i);
  assert.match(String(info.description), /not official filing/i);
});

test("OpenAPI includes X-API-Key auth and signed-in workspace auth", () => {
  const document = getOpenApiDocument(openApiDocument);
  const components = readRecord(document, "components");
  const securitySchemes = readRecord(components, "securitySchemes");
  const apiKeyAuth = readRecord(securitySchemes, "ApiKeyAuth");
  const bearerAuth = readRecord(securitySchemes, "SupabaseBearerAuth");

  assert.equal(apiKeyAuth.type, "apiKey");
  assert.equal(apiKeyAuth.in, "header");
  assert.equal(apiKeyAuth.name, "X-API-Key");
  assert.equal(bearerAuth.type, "http");
  assert.equal(bearerAuth.scheme, "bearer");
});

test("OpenAPI documents active endpoints and leaves planned endpoints inactive", () => {
  const document = getOpenApiDocument(openApiDocument);
  const paths = getPaths(document);

  for (const path of [
    "/api-keys",
    "/api-keys/{id}/revoke",
    "/api-requests",
    "/api-requests/summary",
    "/api-usage/policies",
    "/api-usage/current",
    "/invoices/validate",
    "/invoices/export/ubl",
    "/invoices/parse/ubl",
    "/xml/validation-jobs",
    "/xml/validation-jobs/{id}",
    "/vat/validate-format",
    "/validation/rules",
    "/validation-runs/{id}",
    "/validation-runs/{id}/report.pdf"
  ]) {
    assert.ok(paths[path], `Expected active path ${path}`);
  }

  const documentedPathNames = Object.keys(paths).join("\n").toLowerCase();

  assert.equal(paths["/invoices/import/ubl"], undefined);
  assert.doesNotMatch(documentedPathNames, /vies/);
  assert.doesNotMatch(documentedPathNames, /webhook/);
  assert.doesNotMatch(documentedPathNames, /country/);
  assert.doesNotMatch(documentedPathNames, /vida/);
});

test("OpenAPI documents XML validation jobs with UBL XSD as configuration-gated", () => {
  const document = getOpenApiDocument(openApiDocument);
  const paths = getPaths(document);
  const xmlValidationJobs = readRecord(paths, "/xml/validation-jobs");
  const post = readRecord(xmlValidationJobs, "post");
  const responses = readRecord(post, "responses");
  const components = readRecord(document, "components");
  const schemas = readRecord(components, "schemas");
  const createRequest = JSON.stringify(
    readRecord(schemas, "XmlValidationJobCreateRequest")
  );
  const artifactInfoSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobArtifactInfo")
  );
  const schemaArtifactSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobSchemaArtifact")
  );
  const dependencyGraphSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobDependencyGraph")
  );
  const schematronDiagnosticsSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobSchematronArtifactDiagnostics")
  );
  const schematronArtifactProvenanceSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobSchematronArtifactProvenance")
  );
  const schematronPreflightSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobSchematronExecutionPreflight")
  );
  const schematronPolicySchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobSchematronExecutionPolicy")
  );
  const schematronEngineCandidateSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobSchematronEngineCandidate")
  );
  const schematronXPathEngineSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobSchematronXPathEngineFoundation")
  );
  const schematronResultMapperSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobSchematronResultMappingContract")
  );
  const peppolBisExecutionPathSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobPeppolBisExecutionPathFoundation")
  );
  const en16931ExecutionPathSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobEn16931ExecutionPathFoundation")
  );
  const schematronExecutionOrchestratorSchema = JSON.stringify(
    readRecord(
      schemas,
      "XmlValidationJobSchematronExecutionOrchestratorFoundation"
    )
  );
  const xmlWorkerSchematronOrchestrationSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobXmlWorkerSchematronOrchestration")
  );
  const schematronArtifactSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobSchematronArtifactFileDiagnostics")
  );
  const findingSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobFinding")
  );
  const xmlValidationJobSchema = readRecord(schemas, "XmlValidationJob");
  const jobResultSummaryExample = JSON.stringify(
    readRecord(
      readRecord(xmlValidationJobSchema, "properties"),
      "resultSummary"
    ).example
  ) ?? "";
  const jobSchema = JSON.stringify(xmlValidationJobSchema);
  const serializedPost = JSON.stringify(post);

  assert.ok(responses["200"], "Expected XML validation job success response");
  assert.match(serializedPost, /xsd_ubl/);
  assert.match(serializedPost, /not_configured/i);
  assert.match(serializedPost, /passed or failed only after a real local XSD validation operation executes/i);
  assert.match(
    serializedPost,
    /error for controlled validator\/runtime or schema dependency failures/i
  );
  assert.match(serializedPost, /local UBL XSD artefacts/i);
  assert.match(serializedPost, /mapped Invoice Lantern findings/i);
  assert.match(serializedPost, /UBL_XSD_ELEMENT_INVALID/);
  assert.match(serializedPost, /UBL_XSD_REQUIRED_ELEMENT_MISSING/);
  assert.match(serializedPost, /UBL_XSD_VALUE_INVALID/);
  assert.match(serializedPost, /UBL_XSD_ROOT_DIR/);
  assert.match(serializedPost, /UBL_INVOICE_XSD_PATH/);
  assert.match(serializedPost, /UBL_CREDIT_NOTE_XSD_PATH/);
  assert.match(serializedPost, /UBL_XSD_ARTIFACT_VERSION/);
  assert.match(serializedPost, /Schematron artifact diagnostics/i);
  assert.match(serializedPost, /schematron_adapter_preflight_v1/);
  assert.match(serializedPost, /executionPreflight/);
  assert.match(serializedPost, /executionPolicy/);
  assert.match(serializedPost, /engineCandidate/);
  assert.match(serializedPost, /schematron_policy_v1/);
  assert.match(serializedPost, /schematron_engine_candidate_v1/);
  assert.match(serializedPost, /schematron_xpath_engine_v1/);
  assert.match(serializedPost, /xpath_engine/);
  assert.match(serializedPost, /schematron_local_execution_prototype_v1/);
  assert.match(serializedPost, /internal test-only/);
  assert.match(
    serializedPost,
    /not exposed as a public XML validation job check/
  );
  assert.match(serializedPost, /schematron_result_mapper_v1/);
  assert.match(serializedPost, /peppol_bis_execution_path_v1/);
  assert.match(serializedPost, /en16931_execution_path_v1/);
  assert.match(serializedPost, /schematron_execution_orchestrator_v1/);
  assert.match(serializedPost, /xml_worker_schematron_orchestrator_v1/);
  assert.match(serializedPost, /schematron_artifact_source_register_v1/);
  assert.match(serializedPost, /artifactProvenance/);
  assert.match(serializedPost, /sourceRegisterVersion/);
  assert.match(serializedPost, /reviewStatus/);
  assert.match(serializedPost, /workerSchematronOrchestratorVersion/);
  assert.match(serializedPost, /schematronOrchestration/);
  assert.match(serializedPost, /package-level\/internal test-only/i);
  assert.match(
    serializedPost,
    /Normal public API and worker XML validation jobs still do not execute production Schematron/i
  );
  assert.match(
    serializedPost,
    /do not call peppol_bis_execution_path_v1 or en16931_execution_path_v1 as public checks/
  );
  assert.match(
    serializedPost,
    /xml_worker_schematron_orchestrator_v1 inside the XML worker as a default-safe bridge/
  );
  assert.match(serializedPost, /Step 59 exposes worker orchestration fields/);
  assert.match(serializedPost, /not official validation/);
  assert.match(serializedPost, /orchestrationMode/);
  assert.match(serializedPost, /selectedLayers/);
  assert.match(serializedPost, /layerSummaries/);
  assert.match(
    serializedPost,
    /future mapping layer for sanitized SVRL-style failed assertions and successful reports/
  );
  assert.match(
    serializedPost,
    /do not produce real mapped Schematron findings from production execution/
  );
  assert.match(
    serializedPost,
    /Normal public API and worker XML validation jobs still do not execute production Schematron/i
  );
  assert.match(serializedPost, /SCHEMATRON_EXECUTION_MODE/);
  assert.match(serializedPost, /SCHEMATRON_ENGINE/);
  assert.match(serializedPost, /SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION/);
  assert.match(serializedPost, /blocked_requested_execution/);
  assert.match(serializedPost, /schematron_execution_requested_but_blocked/);
  assert.match(serializedPost, /executionPermitted/);
  assert.match(serializedPost, /engineCandidateVersion/);
  assert.match(serializedPost, /engineAvailabilityStatus/);
  assert.match(serializedPost, /engineExecutionSupported/);
  assert.match(serializedPost, /placeholder_only/);
  assert.match(serializedPost, /not_selected/);
  assert.match(serializedPost, /unavailable/);
  assert.match(serializedPost, /policy metadata/);
  assert.match(serializedPost, /Engine candidate metadata does not enable validation/);
  assert.match(serializedPost, /ready_for_future_execution/);
  assert.match(serializedPost, /schematron_execution_disabled/);
  assert.match(serializedPost, /schematron_execution_engine_not_implemented/);
  assert.match(serializedPost, /validationExecutionEnabled/);
  assert.match(serializedPost, /PEPPOL_SCHEMATRON_ROOT_DIR/);
  assert.match(serializedPost, /PEPPOL_BIS_SCHEMATRON_PATH/);
  assert.match(serializedPost, /EN16931_SCHEMATRON_PATH/);
  assert.match(serializedPost, /SCHEMATRON_ARTIFACT_VERSION/);
  assert.match(serializedPost, /Schematron execution is not implemented/i);
  assert.match(serializedPost, /no certification/i);
  assert.match(serializedPost, /no authority acceptance/i);
  assert.match(serializedPost, /no legal\/tax\/accounting compliance validation/i);
  assert.match(createRequest, /"xsd_ubl"/);
  assert.doesNotMatch(createRequest, /xsd_ubl_placeholder/);
  assert.match(artifactInfoSchema, /validatorName/);
  assert.match(artifactInfoSchema, /validatorAvailable/);
  assert.match(artifactInfoSchema, /artifactVersion/);
  assert.match(artifactInfoSchema, /invoiceXsdPath/);
  assert.match(artifactInfoSchema, /creditNoteXsdPath/);
  assert.match(artifactInfoSchema, /invoiceSchema/);
  assert.match(artifactInfoSchema, /creditNoteSchema/);
  assert.match(schemaArtifactSchema, /sha256/);
  assert.match(schemaArtifactSchema, /available/);
  assert.match(schemaArtifactSchema, /missing/);
  assert.match(schemaArtifactSchema, /unreadable/);
  assert.match(schemaArtifactSchema, /out_of_root/);
  assert.match(artifactInfoSchema, /dependencyGraph/);
  assert.match(dependencyGraphSchema, /dependencyCount/);
  assert.match(dependencyGraphSchema, /external_reference_blocked/);
  assert.match(artifactInfoSchema, /checkedAt/);
  assert.match(schematronDiagnosticsSchema, /schematron_artifacts/);
  assert.match(schematronDiagnosticsSchema, /validationExecutionEnabled/);
  assert.match(schematronDiagnosticsSchema, /validatorAvailable/);
  assert.match(schematronDiagnosticsSchema, /readyArtifactCount/);
  assert.match(schematronDiagnosticsSchema, /peppolBisArtifact/);
  assert.match(schematronDiagnosticsSchema, /en16931Artifact/);
  assert.match(schematronDiagnosticsSchema, /sourceRegisterVersion/);
  assert.match(schematronDiagnosticsSchema, /sourceRegisterSummary/);
  assert.match(schematronDiagnosticsSchema, /schematron_artifact_source_register_v1/);
  assert.match(schematronArtifactProvenanceSchema, /artifactSlotId/);
  assert.match(schematronArtifactProvenanceSchema, /reviewStatus/);
  assert.match(schematronArtifactProvenanceSchema, /configuredEnvVars/);
  assert.match(schematronArtifactProvenanceSchema, /expectedSha256/);
  assert.match(schematronArtifactProvenanceSchema, /safeLabel/);
  assert.match(schematronArtifactProvenanceSchema, /rawXmlReturned/);
  assert.match(
    schematronArtifactProvenanceSchema,
    /schematronFileContentsReturned/
  );
  assert.match(
    schematronArtifactProvenanceSchema,
    /fullAbsoluteLocalPathsReturned/
  );
  assert.match(schematronArtifactProvenanceSchema, /remoteFetching/);
  assert.match(schematronPreflightSchema, /schematron_execution_preflight/);
  assert.match(schematronPreflightSchema, /schematron_adapter_preflight_v1/);
  assert.match(schematronPreflightSchema, /preflight_only/);
  assert.match(schematronPreflightSchema, /ready_for_future_execution/);
  assert.match(schematronPreflightSchema, /unsupported/);
  assert.match(schematronPreflightSchema, /schematron_execution_disabled/);
  assert.match(
    schematronPreflightSchema,
    /schematron_execution_engine_not_implemented/
  );
  assert.match(schematronPreflightSchema, /does not execute validation/);
  assert.match(schematronPolicySchema, /schematron_execution_policy/);
  assert.match(schematronPolicySchema, /schematron_policy_v1/);
  assert.match(schematronPolicySchema, /disabled/);
  assert.match(schematronPolicySchema, /preflight_only/);
  assert.match(schematronPolicySchema, /blocked_requested_execution/);
  assert.match(schematronPolicySchema, /none/);
  assert.match(schematronPolicySchema, /placeholder/);
  assert.match(schematronPolicySchema, /future_xslt2/);
  assert.match(schematronPolicySchema, /future_schxslt/);
  assert.match(schematronPolicySchema, /xpath_engine/);
  assert.match(schematronPolicySchema, /internal_test_candidate/);
  assert.match(schematronPolicySchema, /unknown/);
  assert.match(schematronPolicySchema, /executionPermitted/);
  assert.match(schematronPolicySchema, /validationExecutionEnabled/);
  assert.match(schematronPolicySchema, /schematron_execution_preflight_only/);
  assert.match(
    schematronPolicySchema,
    /schematron_execution_disabled_by_policy/
  );
  assert.match(
    schematronPolicySchema,
    /schematron_execution_requested_but_blocked/
  );
  assert.match(
    schematronPolicySchema,
    /schematron_experimental_execution_not_available/
  );
  assert.match(schematronPolicySchema, /SCHEMATRON_EXECUTION_MODE/);
  assert.match(schematronPolicySchema, /SCHEMATRON_ENGINE/);
  assert.match(
    schematronPolicySchema,
    /SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION/
  );
  assert.match(schematronPolicySchema, /does not enable validation/);
  assert.match(schematronPolicySchema, /Execution-like values are blocked/i);
  assert.match(
    schematronPolicySchema,
    /schematron_local_execution_prototype_v1/
  );
  assert.match(schematronPolicySchema, /not a public policy mode/);
  assert.match(schematronEngineCandidateSchema, /schematron_engine_candidate/);
  assert.match(
    schematronEngineCandidateSchema,
    /schematron_engine_candidate_v1/
  );
  assert.match(schematronEngineCandidateSchema, /engineCandidateVersion/);
  assert.match(schematronEngineCandidateSchema, /availabilityStatus/);
  assert.match(schematronEngineCandidateSchema, /executionSupported/);
  assert.match(schematronEngineCandidateSchema, /executionEnabledByDefault/);
  assert.match(schematronEngineCandidateSchema, /packageName/);
  assert.match(schematronEngineCandidateSchema, /packageVersion/);
  assert.match(schematronEngineCandidateSchema, /none/);
  assert.match(schematronEngineCandidateSchema, /placeholder/);
  assert.match(schematronEngineCandidateSchema, /future_xslt2/);
  assert.match(schematronEngineCandidateSchema, /future_schxslt/);
  assert.match(schematronEngineCandidateSchema, /xpath_engine/);
  assert.match(schematronEngineCandidateSchema, /internal_test_candidate/);
  assert.match(schematronEngineCandidateSchema, /not_selected/);
  assert.match(schematronEngineCandidateSchema, /placeholder_only/);
  assert.match(schematronEngineCandidateSchema, /available/);
  assert.match(schematronEngineCandidateSchema, /unavailable/);
  assert.match(schematronEngineCandidateSchema, /unsupported/);
  assert.match(schematronEngineCandidateSchema, /schematron_xslt2_engine_not_installed/);
  assert.match(
    schematronEngineCandidateSchema,
    /schematron_schxslt_engine_not_installed/
  );
  assert.match(
    schematronEngineCandidateSchema,
    /schematron_internal_test_candidate_available/
  );
  assert.match(schematronEngineCandidateSchema, /fontoxpath/);
  assert.match(schematronEngineCandidateSchema, /slimdom/);
  assert.match(
    schematronEngineCandidateSchema,
    /schematron_xpath_fontoxpath_not_installed/
  );
  assert.match(
    schematronEngineCandidateSchema,
    /schematron_xpath_slimdom_not_installed/
  );
  assert.match(
    schematronEngineCandidateSchema,
    /schematron_xpath_engine_candidate_available_execution_disabled_by_default/
  );
  assert.match(schematronEngineCandidateSchema, /xml_dom_execution/);
  assert.match(schematronEngineCandidateSchema, /xpath_assertion_execution/);
  assert.match(
    schematronEngineCandidateSchema,
    /schematron_local_execution_prototype_v1/
  );
  assert.match(
    schematronEngineCandidateSchema,
    /schematron_xpath_engine_v1/
  );
  assert.match(schematronEngineCandidateSchema, /internal test-only execution/);
  assert.match(
    schematronEngineCandidateSchema,
    /does not enable normal API or worker XML validation jobs/
  );
  assert.match(schematronXPathEngineSchema, /schematron_xpath_engine_v1/);
  assert.match(schematronXPathEngineSchema, /xpath_engine/);
  assert.match(schematronXPathEngineSchema, /internal\/test-only foundation/);
  assert.match(
    schematronXPathEngineSchema,
    /explicitly provided, sanitized XPath assertion definitions/
  );
  assert.match(
    schematronXPathEngineSchema,
    /guarded package-level calls only/
  );
  assert.match(
    schematronXPathEngineSchema,
    /normal public API or XML worker validation jobs/
  );
  assert.match(schematronXPathEngineSchema, /not official validation/);
  assert.match(schematronXPathEngineSchema, /no Peppol certification/);
  assert.match(
    schematronXPathEngineSchema,
    /no EN 16931 compliance guarantee/
  );
  assert.match(
    schematronXPathEngineSchema,
    /no legal\/tax\/accounting compliance guarantee/
  );
  assert.match(schematronXPathEngineSchema, /no authority acceptance/);
  assert.match(schematronXPathEngineSchema, /rawXmlReturned/);
  assert.match(
    schematronXPathEngineSchema,
    /schematronFileContentsReturned/
  );
  assert.match(
    schematronXPathEngineSchema,
    /fullAbsoluteLocalPathsReturned/
  );
  assert.match(schematronXPathEngineSchema, /remoteFetching/);
  assert.match(schematronXPathEngineSchema, /extensionFunctions/);
  assert.match(schematronXPathEngineSchema, /normalWorkerExecutionEnabled/);
  assert.match(schematronResultMapperSchema, /schematron_result_mapper_v1/);
  assert.match(schematronResultMapperSchema, /schematron_result_mapping/);
  assert.match(schematronResultMapperSchema, /normalJobExecutionEnabled/);
  assert.match(schematronResultMapperSchema, /validationExecuted/);
  assert.match(schematronResultMapperSchema, /SCHEMATRON_ASSERTION_FAILED/);
  assert.match(schematronResultMapperSchema, /SCHEMATRON_REPORT_WARNING/);
  assert.match(schematronResultMapperSchema, /PEPPOL_SCHEMATRON_RULE_FAILED/);
  assert.match(schematronResultMapperSchema, /EN16931_SCHEMATRON_RULE_FAILED/);
  assert.match(schematronResultMapperSchema, /ruleId/);
  assert.match(schematronResultMapperSchema, /businessRuleId/);
  assert.match(schematronResultMapperSchema, /schematronLayer/);
  assert.match(schematronResultMapperSchema, /ruleLocation/);
  assert.match(schematronResultMapperSchema, /testExpression/);
  assert.match(schematronResultMapperSchema, /assertionText/);
  assert.match(schematronResultMapperSchema, /diagnosticReference/);
  assert.match(schematronResultMapperSchema, /rawXmlReturned/);
  assert.match(schematronResultMapperSchema, /schematronFileContentsReturned/);
  assert.match(schematronResultMapperSchema, /fullAbsoluteLocalPathsReturned/);
  assert.match(schematronResultMapperSchema, /remoteFetching/);
  assert.match(
    schematronResultMapperSchema,
    /Normal API and worker XML validation jobs do not call this mapper/
  );
  assert.match(peppolBisExecutionPathSchema, /peppol_bis_execution_path_v1/);
  assert.match(peppolBisExecutionPathSchema, /peppol_bis_billing/);
  assert.match(peppolBisExecutionPathSchema, /normalJobExecutionEnabled/);
  assert.match(peppolBisExecutionPathSchema, /normalJobValidationExecuted/);
  assert.match(peppolBisExecutionPathSchema, /internal_test_only/);
  assert.match(peppolBisExecutionPathSchema, /blocked_by_policy/);
  assert.match(peppolBisExecutionPathSchema, /engine_unavailable/);
  assert.match(peppolBisExecutionPathSchema, /ready_for_future_execution/);
  assert.match(peppolBisExecutionPathSchema, /unsafe_input/);
  assert.match(peppolBisExecutionPathSchema, /PEPPOL_SCHEMATRON_RULE_FAILED/);
  assert.match(peppolBisExecutionPathSchema, /SCHEMATRON_REPORT_WARNING/);
  assert.match(peppolBisExecutionPathSchema, /rawXmlReturned/);
  assert.match(
    peppolBisExecutionPathSchema,
    /schematronFileContentsReturned/
  );
  assert.match(
    peppolBisExecutionPathSchema,
    /fullAbsoluteLocalPathsReturned/
  );
  assert.match(peppolBisExecutionPathSchema, /remoteFetching/);
  assert.match(peppolBisExecutionPathSchema, /javaOrSystemDependencyRequired/);
  assert.match(
    peppolBisExecutionPathSchema,
    /normalApiWorkerExecutionEnabled/
  );
  assert.match(en16931ExecutionPathSchema, /en16931_execution_path_v1/);
  assert.match(en16931ExecutionPathSchema, /en16931_tc434/);
  assert.match(en16931ExecutionPathSchema, /normalJobExecutionEnabled/);
  assert.match(en16931ExecutionPathSchema, /normalJobValidationExecuted/);
  assert.match(en16931ExecutionPathSchema, /internal_test_only/);
  assert.match(en16931ExecutionPathSchema, /blocked_by_policy/);
  assert.match(en16931ExecutionPathSchema, /engine_unavailable/);
  assert.match(en16931ExecutionPathSchema, /ready_for_future_execution/);
  assert.match(en16931ExecutionPathSchema, /unsafe_input/);
  assert.match(en16931ExecutionPathSchema, /EN16931_SCHEMATRON_RULE_FAILED/);
  assert.match(en16931ExecutionPathSchema, /SCHEMATRON_REPORT_WARNING/);
  assert.match(en16931ExecutionPathSchema, /rawXmlReturned/);
  assert.match(
    en16931ExecutionPathSchema,
    /schematronFileContentsReturned/
  );
  assert.match(
    en16931ExecutionPathSchema,
    /fullAbsoluteLocalPathsReturned/
  );
  assert.match(en16931ExecutionPathSchema, /remoteFetching/);
  assert.match(en16931ExecutionPathSchema, /javaOrSystemDependencyRequired/);
  assert.match(
    en16931ExecutionPathSchema,
    /normalApiWorkerExecutionEnabled/
  );
  assert.match(
    schematronExecutionOrchestratorSchema,
    /schematron_execution_orchestrator_v1/
  );
  assert.match(
    schematronExecutionOrchestratorSchema,
    /schematron_execution_orchestrator/
  );
  assert.match(schematronExecutionOrchestratorSchema, /peppol_bis_billing/);
  assert.match(schematronExecutionOrchestratorSchema, /en16931_tc434/);
  assert.match(
    schematronExecutionOrchestratorSchema,
    /normalJobExecutionEnabled/
  );
  assert.match(
    schematronExecutionOrchestratorSchema,
    /normalJobValidationExecuted/
  );
  assert.match(schematronExecutionOrchestratorSchema, /internal_test_only/);
  assert.match(schematronExecutionOrchestratorSchema, /layerSummaryFields/);
  assert.match(schematronExecutionOrchestratorSchema, /findingCount/);
  assert.match(schematronExecutionOrchestratorSchema, /fatalCount/);
  assert.match(schematronExecutionOrchestratorSchema, /warningCount/);
  assert.match(schematronExecutionOrchestratorSchema, /infoCount/);
  assert.match(schematronExecutionOrchestratorSchema, /partial/);
  assert.match(
    schematronExecutionOrchestratorSchema,
    /PEPPOL_SCHEMATRON_RULE_FAILED/
  );
  assert.match(
    schematronExecutionOrchestratorSchema,
    /EN16931_SCHEMATRON_RULE_FAILED/
  );
  assert.match(
    schematronExecutionOrchestratorSchema,
    /SCHEMATRON_REPORT_WARNING/
  );
  assert.match(schematronExecutionOrchestratorSchema, /rawXmlReturned/);
  assert.match(
    schematronExecutionOrchestratorSchema,
    /schematronFileContentsReturned/
  );
  assert.match(
    schematronExecutionOrchestratorSchema,
    /fullAbsoluteLocalPathsReturned/
  );
  assert.match(schematronExecutionOrchestratorSchema, /remoteFetching/);
  assert.match(
    schematronExecutionOrchestratorSchema,
    /javaOrSystemDependencyRequired/
  );
  assert.match(
    schematronExecutionOrchestratorSchema,
    /normalApiWorkerExecutionEnabled/
  );
  assert.match(
    xmlWorkerSchematronOrchestrationSchema,
    /xml_worker_schematron_orchestrator_v1/
  );
  assert.match(
    xmlWorkerSchematronOrchestrationSchema,
    /xml_worker_schematron_orchestration/
  );
  assert.match(
    xmlWorkerSchematronOrchestrationSchema,
    /schematron_execution_orchestrator_v1/
  );
  assert.match(xmlWorkerSchematronOrchestrationSchema, /preflight_only/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /internal_test_only/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /not public\/default/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /unsafe_input/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /engine_unavailable/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /findingCount/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /fatalCount/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /warningCount/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /infoCount/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /selectedLayers/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /layerSummaries/);
  assert.match(
    xmlWorkerSchematronOrchestrationSchema,
    /not official validation/
  );
  assert.match(xmlWorkerSchematronOrchestrationSchema, /raw XML/);
  assert.match(
    xmlWorkerSchematronOrchestrationSchema,
    /Schematron file contents/
  );
  assert.match(
    xmlWorkerSchematronOrchestrationSchema,
    /full absolute local filesystem paths/
  );
  assert.match(xmlWorkerSchematronOrchestrationSchema, /remote fetch/);
  assert.match(
    xmlWorkerSchematronOrchestrationSchema,
    /Java\/system dependency/
  );
  assert.match(schematronArtifactSchema, /relativePathUnderRoot/);
  assert.match(schematronArtifactSchema, /basename/);
  assert.match(schematronArtifactSchema, /sha256/);
  assert.match(schematronArtifactSchema, /artifactProvenance/);
  assert.match(schematronArtifactSchema, /sourceLabels/);
  assert.match(schematronArtifactSchema, /documentationUrls/);
  assert.match(schematronArtifactSchema, /provenanceDisclaimer/);
  assert.match(schematronArtifactSchema, /full absolute local filesystem paths/);
  assert.match(findingSchema, /not_configured/);
  assert.match(findingSchema, /passed/);
  assert.match(findingSchema, /failed/);
  assert.match(findingSchema, /error/);
  assert.match(findingSchema, /not_implemented/);
  assert.match(findingSchema, /technicalMessage/);
  assert.match(findingSchema, /technicalCode/);
  assert.match(findingSchema, /xmlLine/);
  assert.match(findingSchema, /schematronLayer/);
  assert.match(findingSchema, /ruleId/);
  assert.match(findingSchema, /businessRuleId/);
  assert.match(findingSchema, /ruleLocation/);
  assert.match(findingSchema, /testExpression/);
  assert.match(findingSchema, /assertionText/);
  assert.match(findingSchema, /diagnosticReference/);
  assert.match(findingSchema, /SCHEMATRON_EXECUTION_NOT_ENABLED/);
  assert.match(findingSchema, /SCHEMATRON_ASSERTION_FAILED/);
  assert.match(findingSchema, /SCHEMATRON_REPORT_WARNING/);
  assert.match(findingSchema, /PEPPOL_SCHEMATRON_RULE_FAILED/);
  assert.match(findingSchema, /EN16931_SCHEMATRON_RULE_FAILED/);
  assert.match(findingSchema, /schematron_local_execution_prototype_v1/);
  assert.match(findingSchema, /schematron_result_mapper_v1/);
  assert.match(findingSchema, /peppol_bis_execution_path_v1/);
  assert.match(findingSchema, /en16931_execution_path_v1/);
  assert.match(findingSchema, /schematron_execution_orchestrator_v1/);
  assert.match(findingSchema, /package-level internal test-only calls/);
  assert.match(findingSchema, /never raw XML/);
  assert.match(findingSchema, /PEPPOL_SCHEMATRON_VALIDATION_NOT_ENABLED/);
  assert.match(jobSchema, /xsd_ubl/);
  assert.match(jobSchema, /artifactInfo/);
  assert.match(jobSchema, /schematron_artifacts/);
  assert.match(jobSchema, /schematron_artifact_source_register_v1/);
  assert.match(jobSchema, /validationExecutionEnabled/);
  assert.match(jobSchema, /adapterVersion/);
  assert.match(jobSchema, /executionPreflight/);
  assert.match(jobSchema, /executionPolicy/);
  assert.match(jobSchema, /engineCandidate/);
  assert.match(jobSchema, /preflightStatus/);
  assert.match(jobSchema, /preflightReason/);
  assert.match(jobSchema, /policyVersion/);
  assert.match(jobSchema, /policyMode/);
  assert.match(jobSchema, /policyReason/);
  assert.match(jobSchema, /engineId/);
  assert.match(jobSchema, /engineCandidateVersion/);
  assert.match(jobSchema, /engineAvailabilityStatus/);
  assert.match(jobSchema, /engineExecutionSupported/);
  assert.match(jobSchema, /schematronOrchestration/);
  assert.match(jobSchema, /workerSchematronOrchestratorVersion/);
  assert.match(jobSchema, /orchestrationMode/);
  assert.match(jobSchema, /orchestrationStatus/);
  assert.match(jobSchema, /orchestrationReason/);
  assert.match(jobSchema, /selectedLayers/);
  assert.match(jobSchema, /layerSummaries/);
  assert.match(jobSchema, /executionPermitted/);
  assert.match(jobSchema, /findingContractVersion/);
  assert.match(jobSchema, /schematron_contract_v1/);
  assert.match(jobSchema, /supportedFutureFindingCodes/);
  assert.match(serializedPost, /findingContractVersion/);
  assert.match(serializedPost, /schematronLayer/);
  assert.match(serializedPost, /ruleId/);
  assert.match(serializedPost, /businessRuleId/);
  assert.doesNotMatch(jobSchema, /xsd_ubl_placeholder/);
  assert.doesNotMatch(
    serializedPost,
    /\bSchematron passed\b|\bPeppol certified\b|\bEN 16931 compliant\b|\bauthority accepted\b|\baccepted by authority\b|\bproves compliance\b|\bproves Peppol\b|\bproves EN 16931\b/i
  );
  assert.doesNotMatch(
    jobResultSummaryExample,
    /\bSchematron passed\b|\bPeppol certified\b|\bEN 16931 compliant\b|\bauthority accepted\b|\baccepted by authority\b|\bproves compliance\b|\bproves Peppol\b|\bproves EN 16931\b|\bPeppol passed\b|\bEN 16931 passed\b/i
  );
});

test("OpenAPI reflects the current core validation rule version", () => {
  const serialized = JSON.stringify(openApiDocument);

  assert.match(serialized, /2026\.05\.1/);
  assert.doesNotMatch(serialized, /2026\.04\.1/);
});

test("OpenAPI includes common errors and rate-limit headers", () => {
  const document = getOpenApiDocument(openApiDocument);
  const paths = getPaths(document);
  const invoiceValidate = readRecord(paths, "/invoices/validate");
  const post = readRecord(invoiceValidate, "post");
  const responses = readRecord(post, "responses");

  for (const statusCode of ["400", "401", "403", "404", "429", "500"]) {
    assert.ok(responses[statusCode], `Expected response ${statusCode}`);
  }

  const serialized = JSON.stringify(openApiDocument);

  assert.match(serialized, /X-RateLimit-Limit/);
  assert.match(serialized, /X-RateLimit-Remaining/);
  assert.match(serialized, /X-RateLimit-Reset/);
  assert.match(serialized, /Retry-After/);
  assert.match(serialized, /RATE_LIMIT_EXCEEDED/);
  assert.match(serialized, /INSUFFICIENT_SCOPE/);
  assert.match(serialized, /xml:validation_jobs/);
  assert.match(serialized, /UBL XSD checks are configuration-gated/);
  assert.match(serialized, /not_configured/);
  assert.match(
    serialized,
    /does not certify legal, tax, accounting, Peppol, EN 16931, or authority acceptance/
  );
});

test("OpenAPI avoids sensitive key fields and only documents one-time create secret", () => {
  const document = getOpenApiDocument(openApiDocument);
  const paths = getPaths(document);
  const apiKeys = readRecord(paths, "/api-keys");
  const listApiKeys = JSON.stringify(readRecord(apiKeys, "get"));
  const createApiKey = JSON.stringify(readRecord(apiKeys, "post"));
  const serialized = JSON.stringify(openApiDocument);

  assert.equal(listApiKeys.includes("\"secret\""), false);
  assert.equal(createApiKey.includes("\"secret\""), true);
  assert.doesNotMatch(serialized, /key_hash/i);
  assert.doesNotMatch(serialized, /keyHash/);
  assert.doesNotMatch(serialized, /API_KEY_HASH_SECRET/);
  assert.doesNotMatch(serialized, /INVOICE_LANTERN_DEV_API_KEY/);
  assert.doesNotMatch(serialized, /DEV_API_KEY/);
});
