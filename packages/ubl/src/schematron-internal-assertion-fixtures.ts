import {
  sanitizeSchematronText,
  type SchematronFindingLegalConfidence,
  type SchematronFindingSeverity,
  type SchematronLayer
} from "./schematron-finding-contract.js";
import {
  SCHEMATRON_XPATH_ENGINE_ID,
  SCHEMATRON_XPATH_ENGINE_VERSION,
  type SchematronXPathAssertionInput,
  type SchematronXPathEngineSafetyMetadata
} from "./schematron-xpath-engine.js";

export const SCHEMATRON_INTERNAL_ASSERTION_FIXTURE_SET_VERSION =
  "schematron_internal_assertion_fixtures_v1";

export type SchematronInternalAssertionFixtureLayer = Extract<
  SchematronLayer,
  "peppol_bis_billing" | "en16931_tc434"
>;

export type SchematronInternalAssertionFixture = {
  fixtureId: string;
  fixtureVersion: typeof SCHEMATRON_INTERNAL_ASSERTION_FIXTURE_SET_VERSION;
  layer: SchematronInternalAssertionFixtureLayer;
  ruleId: string;
  businessRuleId: string;
  contextXPath: string;
  testExpression: string;
  assertionText: string;
  severity: SchematronFindingSeverity;
  sourceKind: "internal_engine_fixture";
  sourceLabels: readonly string[];
  legalConfidence: SchematronFindingLegalConfidence;
  publicRuleClaimed: false;
  officialValidationClaimed: false;
};

export type SchematronInternalAssertionFixtureSelectionInput = {
  layer?: SchematronInternalAssertionFixtureLayer | "both";
  layers?: readonly SchematronInternalAssertionFixtureLayer[];
  fixtureIds?: readonly string[];
  maxFixtures?: number;
};

export type SchematronInternalAssertionFixtureSafetyMetadata = Pick<
  SchematronXPathEngineSafetyMetadata,
  | "rawXmlReturned"
  | "schematronFileContentsReturned"
  | "fullAbsoluteLocalPathsReturned"
  | "remoteFetching"
  | "localFileLoading"
  | "externalDocumentLoading"
  | "normalPublicApiExecutionEnabled"
  | "normalWorkerExecutionEnabled"
> & {
  arbitraryPublicXPathExecution: false;
  publicRuleClaimed: false;
  officialValidationClaimed: false;
};

export type SchematronInternalAssertionFixtureSummary = {
  diagnosticKind: "schematron_internal_assertion_fixtures";
  fixtureSetVersion: typeof SCHEMATRON_INTERNAL_ASSERTION_FIXTURE_SET_VERSION;
  engineVersion: typeof SCHEMATRON_XPATH_ENGINE_VERSION;
  engineId: typeof SCHEMATRON_XPATH_ENGINE_ID;
  sourceKind: "internal_engine_fixture";
  selectedLayers: SchematronInternalAssertionFixtureLayer[];
  availableFixtureCount: number;
  selectedFixtureCount: number;
  selectedFixtureIds: string[];
  maxFixtureCount: number;
  bounded: true;
  legalConfidence: SchematronFindingLegalConfidence;
  publicRuleClaimed: false;
  officialValidationClaimed: false;
  safetyMetadata: SchematronInternalAssertionFixtureSafetyMetadata;
  reason: string;
};

const MAX_INTERNAL_ASSERTION_FIXTURE_COUNT = 25;

const FIXTURE_SAFETY_METADATA: SchematronInternalAssertionFixtureSafetyMetadata =
  {
    rawXmlReturned: false,
    schematronFileContentsReturned: false,
    fullAbsoluteLocalPathsReturned: false,
    remoteFetching: false,
    localFileLoading: false,
    externalDocumentLoading: false,
    normalPublicApiExecutionEnabled: false,
    normalWorkerExecutionEnabled: false,
    arbitraryPublicXPathExecution: false,
    publicRuleClaimed: false,
    officialValidationClaimed: false
  };

const INTERNAL_ASSERTION_FIXTURES = [
  {
    fixtureId: "IL_INTERNAL_EN16931_DOCUMENT_ID_PRESENT",
    fixtureVersion: SCHEMATRON_INTERNAL_ASSERTION_FIXTURE_SET_VERSION,
    layer: "en16931_tc434",
    ruleId: "IL-EN16931-FIXTURE-001",
    businessRuleId: "IL-EN16931-BR-FIXTURE-001",
    contextXPath: "/ubl:Invoice",
    testExpression: "normalize-space(cbc:ID) != ''",
    assertionText:
      "Internal EN 16931-style fixture assertion. Package-level internal/test-only fixture.",
    severity: "fatal",
    sourceKind: "internal_engine_fixture",
    sourceLabels: [
      "Invoice Lantern internal fixture",
      "EN 16931-style fixture",
      SCHEMATRON_INTERNAL_ASSERTION_FIXTURE_SET_VERSION
    ],
    legalConfidence: "technical",
    publicRuleClaimed: false,
    officialValidationClaimed: false
  },
  {
    fixtureId: "IL_INTERNAL_EN16931_ISSUE_DATE_PRESENT",
    fixtureVersion: SCHEMATRON_INTERNAL_ASSERTION_FIXTURE_SET_VERSION,
    layer: "en16931_tc434",
    ruleId: "IL-EN16931-FIXTURE-002",
    businessRuleId: "IL-EN16931-BR-FIXTURE-002",
    contextXPath: "/ubl:Invoice",
    testExpression: "normalize-space(cbc:IssueDate) != ''",
    assertionText:
      "Internal EN 16931-style fixture assertion. Engine harness fixture.",
    severity: "fatal",
    sourceKind: "internal_engine_fixture",
    sourceLabels: [
      "Invoice Lantern internal fixture",
      "EN 16931-style fixture",
      SCHEMATRON_INTERNAL_ASSERTION_FIXTURE_SET_VERSION
    ],
    legalConfidence: "technical",
    publicRuleClaimed: false,
    officialValidationClaimed: false
  },
  {
    fixtureId: "IL_INTERNAL_EN16931_CURRENCY_PRESENT",
    fixtureVersion: SCHEMATRON_INTERNAL_ASSERTION_FIXTURE_SET_VERSION,
    layer: "en16931_tc434",
    ruleId: "IL-EN16931-FIXTURE-003",
    businessRuleId: "IL-EN16931-BR-FIXTURE-003",
    contextXPath: "/ubl:Invoice",
    testExpression: "normalize-space(cbc:DocumentCurrencyCode) != ''",
    assertionText:
      "Internal EN 16931-style fixture assertion. Engine harness fixture.",
    severity: "fatal",
    sourceKind: "internal_engine_fixture",
    sourceLabels: [
      "Invoice Lantern internal fixture",
      "EN 16931-style fixture",
      SCHEMATRON_INTERNAL_ASSERTION_FIXTURE_SET_VERSION
    ],
    legalConfidence: "technical",
    publicRuleClaimed: false,
    officialValidationClaimed: false
  },
  {
    fixtureId: "IL_INTERNAL_EN16931_INVOICE_LINE_PRESENT",
    fixtureVersion: SCHEMATRON_INTERNAL_ASSERTION_FIXTURE_SET_VERSION,
    layer: "en16931_tc434",
    ruleId: "IL-EN16931-FIXTURE-004",
    businessRuleId: "IL-EN16931-BR-FIXTURE-004",
    contextXPath: "/ubl:Invoice",
    testExpression: "count(cac:InvoiceLine) > 0",
    assertionText:
      "Internal EN 16931-style fixture assertion. Engine harness fixture.",
    severity: "fatal",
    sourceKind: "internal_engine_fixture",
    sourceLabels: [
      "Invoice Lantern internal fixture",
      "EN 16931-style fixture",
      SCHEMATRON_INTERNAL_ASSERTION_FIXTURE_SET_VERSION
    ],
    legalConfidence: "technical",
    publicRuleClaimed: false,
    officialValidationClaimed: false
  },
  {
    fixtureId: "IL_INTERNAL_PEPPOL_CUSTOMIZATION_ID_PRESENT",
    fixtureVersion: SCHEMATRON_INTERNAL_ASSERTION_FIXTURE_SET_VERSION,
    layer: "peppol_bis_billing",
    ruleId: "IL-PEPPOL-FIXTURE-001",
    businessRuleId: "IL-PEPPOL-BR-FIXTURE-001",
    contextXPath: "/ubl:Invoice",
    testExpression: "normalize-space(cbc:CustomizationID) != ''",
    assertionText:
      "Internal Peppol-style fixture assertion. Package-level internal/test-only fixture.",
    severity: "fatal",
    sourceKind: "internal_engine_fixture",
    sourceLabels: [
      "Invoice Lantern internal fixture",
      "Peppol-style fixture",
      SCHEMATRON_INTERNAL_ASSERTION_FIXTURE_SET_VERSION
    ],
    legalConfidence: "technical",
    publicRuleClaimed: false,
    officialValidationClaimed: false
  },
  {
    fixtureId: "IL_INTERNAL_PEPPOL_PROFILE_ID_PRESENT",
    fixtureVersion: SCHEMATRON_INTERNAL_ASSERTION_FIXTURE_SET_VERSION,
    layer: "peppol_bis_billing",
    ruleId: "IL-PEPPOL-FIXTURE-002",
    businessRuleId: "IL-PEPPOL-BR-FIXTURE-002",
    contextXPath: "/ubl:Invoice",
    testExpression: "normalize-space(cbc:ProfileID) != ''",
    assertionText:
      "Internal Peppol-style fixture assertion. Engine harness fixture.",
    severity: "fatal",
    sourceKind: "internal_engine_fixture",
    sourceLabels: [
      "Invoice Lantern internal fixture",
      "Peppol-style fixture",
      SCHEMATRON_INTERNAL_ASSERTION_FIXTURE_SET_VERSION
    ],
    legalConfidence: "technical",
    publicRuleClaimed: false,
    officialValidationClaimed: false
  }
] as const satisfies readonly SchematronInternalAssertionFixture[];

function cloneFixture(
  fixture: SchematronInternalAssertionFixture
): SchematronInternalAssertionFixture {
  return {
    ...fixture,
    sourceLabels: [...fixture.sourceLabels]
  };
}

function normalizeMaxFixtures(value: number | undefined) {
  if (value === undefined) {
    return MAX_INTERNAL_ASSERTION_FIXTURE_COUNT;
  }

  if (!Number.isFinite(value)) {
    return MAX_INTERNAL_ASSERTION_FIXTURE_COUNT;
  }

  return Math.max(
    0,
    Math.min(Math.floor(value), MAX_INTERNAL_ASSERTION_FIXTURE_COUNT)
  );
}

function normalizeLayerList(
  input: SchematronInternalAssertionFixtureSelectionInput
): SchematronInternalAssertionFixtureLayer[] {
  const explicitLayers = Array.isArray(input.layers) ? input.layers : [];
  const selected = new Set<SchematronInternalAssertionFixtureLayer>();

  if (input.layer === "peppol_bis_billing" || input.layer === "en16931_tc434") {
    selected.add(input.layer);
  }

  if (input.layer === "both" || input.layer === undefined) {
    selected.add("peppol_bis_billing");
    selected.add("en16931_tc434");
  }

  for (const layer of explicitLayers) {
    if (layer === "peppol_bis_billing" || layer === "en16931_tc434") {
      selected.add(layer);
    }
  }

  return [...selected];
}

function normalizeFixtureIdSet(
  fixtureIds: readonly string[] | undefined
): Set<string> | null {
  if (!Array.isArray(fixtureIds)) {
    return null;
  }

  const ids = fixtureIds
    .map((fixtureId) => sanitizeSchematronText(fixtureId, 120))
    .filter((fixtureId) => fixtureId.length > 0);

  return ids.length > 0 ? new Set(ids) : new Set<string>();
}

export function listInternalSchematronAssertionFixtures(): SchematronInternalAssertionFixture[] {
  return INTERNAL_ASSERTION_FIXTURES.map((fixture) => cloneFixture(fixture));
}

export function selectInternalSchematronAssertionFixtures(
  input: SchematronInternalAssertionFixtureSelectionInput = {}
): SchematronInternalAssertionFixture[] {
  const layers = new Set(normalizeLayerList(input));
  const fixtureIds = normalizeFixtureIdSet(input.fixtureIds);
  const maxFixtures = normalizeMaxFixtures(input.maxFixtures);

  return INTERNAL_ASSERTION_FIXTURES.filter((fixture) => {
    if (!layers.has(fixture.layer)) {
      return false;
    }

    if (fixtureIds && !fixtureIds.has(fixture.fixtureId)) {
      return false;
    }

    return true;
  })
    .slice(0, maxFixtures)
    .map((fixture) => cloneFixture(fixture));
}

export function getInternalSchematronAssertionFixturesForLayer(
  layer: SchematronInternalAssertionFixtureLayer
): SchematronInternalAssertionFixture[] {
  return selectInternalSchematronAssertionFixtures({
    layer
  });
}

export function convertInternalFixtureToXPathAssertion(
  fixture: SchematronInternalAssertionFixture
): SchematronXPathAssertionInput {
  const ruleId =
    sanitizeSchematronText(fixture.ruleId, 120) ||
    "IL-INTERNAL-FIXTURE-ASSERTION";
  const businessRuleId = sanitizeSchematronText(fixture.businessRuleId, 120);
  const diagnosticReference = sanitizeSchematronText(
    `${fixture.fixtureId}; ${fixture.fixtureVersion}`,
    240
  );
  const sourceLabels = fixture.sourceLabels
    .map((label) => sanitizeSchematronText(label, 120))
    .filter((label) => label.length > 0);

  return {
    ruleId,
    ...(businessRuleId ? { businessRuleId } : {}),
    schematronLayer: fixture.layer,
    contextXPath: sanitizeSchematronText(fixture.contextXPath, 500),
    testExpression: sanitizeSchematronText(fixture.testExpression, 700),
    assertionText: sanitizeSchematronText(fixture.assertionText, 700),
    severity: fixture.severity,
    ...(diagnosticReference ? { diagnosticReference } : {}),
    ...(sourceLabels.length > 0 ? { sourceLabels } : {})
  };
}

export function buildInternalAssertionFixtureSummary(
  input: SchematronInternalAssertionFixtureSelectionInput = {}
): SchematronInternalAssertionFixtureSummary {
  const selectedFixtures = selectInternalSchematronAssertionFixtures(input);
  const selectedLayers = [
    ...new Set(selectedFixtures.map((fixture) => fixture.layer))
  ];

  return {
    diagnosticKind: "schematron_internal_assertion_fixtures",
    fixtureSetVersion: SCHEMATRON_INTERNAL_ASSERTION_FIXTURE_SET_VERSION,
    engineVersion: SCHEMATRON_XPATH_ENGINE_VERSION,
    engineId: SCHEMATRON_XPATH_ENGINE_ID,
    sourceKind: "internal_engine_fixture",
    selectedLayers,
    availableFixtureCount: INTERNAL_ASSERTION_FIXTURES.length,
    selectedFixtureCount: selectedFixtures.length,
    selectedFixtureIds: selectedFixtures.map((fixture) => fixture.fixtureId),
    maxFixtureCount: normalizeMaxFixtures(input.maxFixtures),
    bounded: true,
    legalConfidence: "technical",
    publicRuleClaimed: false,
    officialValidationClaimed: false,
    safetyMetadata: FIXTURE_SAFETY_METADATA,
    reason: "schematron_internal_assertion_fixtures_selected"
  };
}
