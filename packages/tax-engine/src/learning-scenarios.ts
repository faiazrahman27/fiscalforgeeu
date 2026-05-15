import {
  classifyTransaction,
  TRANSACTION_SIMULATION_DISCLAIMER,
  type TransactionClassifierInput,
  type TransactionClassifierResult,
  type TransactionSimulationFinding
} from "./index.js";

export const LEARNING_SCENARIO_DISCLAIMER =
  "Invoice Lantern learning scenarios are educational templates for technical simulation only. They are not production invoices, not legal advice, not tax advice, not accounting advice, not VAT-return or filing instructions, and not authority or compliance determinations.";

export type LearningScenarioAudience =
  | "freelancer"
  | "sme"
  | "accountant"
  | "student"
  | "developer";

export type LearningScenario = {
  scenarioId: string;
  title: string;
  audience: LearningScenarioAudience;
  description: string;
  learningGoals: string[];
  transactionInput: TransactionClassifierInput;
  expectedFindings: string[];
  legalSafeExplanation: string;
  countryPackContext: {
    sellerCountryPackStatus: string;
    buyerCountryPackStatus: string;
    sourceRefs: string[];
  };
  sourceRefs: string[];
  disclaimer: string;
  notForProductionUse: true;
};

export type LearningScenarioSummary = Omit<
  LearningScenario,
  "transactionInput"
> & {
  transactionClassHint: string;
};

export type LearningScenarioPreviewResult = {
  scenario: LearningScenario;
  transactionSimulation: TransactionClassifierResult;
  matchedExpectedFindings: string[];
  missingExpectedFindings: string[];
  legalSafeExplanation: string;
  disclaimer: string;
  notForProductionUse: true;
};

const COMMON_SOURCE_REFS = [
  "invoice-lantern-country-pack-legal-notice",
  "eu-vat-country-specific-information",
  "eu-vies-vat-information-exchange-system"
];

const PROFESSIONAL_REVIEW_COUNTRY_PACK_CONTEXT = {
  sellerCountryPackStatus: "professional_review_required",
  buyerCountryPackStatus: "professional_review_required",
  sourceRefs: ["invoice-lantern-country-pack-legal-notice"]
};

const BETA_COUNTRY_PACK_CONTEXT = {
  sellerCountryPackStatus: "beta",
  buyerCountryPackStatus: "beta",
  sourceRefs: ["invoice-lantern-country-pack-legal-notice"]
};

const SCENARIOS: LearningScenario[] = [
  {
    scenarioId: "intra-eu-b2b-services",
    title: "Intra-EU B2B services readiness context",
    audience: "freelancer",
    description:
      "A fictional German seller provides services to a fictional Hungarian business buyer. The scenario demonstrates cross-border B2B classification and possible reverse-charge review wording.",
    learningGoals: [
      "Recognize an intra-EU B2B services context.",
      "Keep possible reverse-charge context separate from a final VAT treatment conclusion.",
      "Separate local VAT format evidence from VIES evidence."
    ],
    transactionInput: {
      sellerCountry: "DE",
      buyerCountry: "HU",
      buyerType: "business",
      transactionType: "services",
      invoiceDate: "2030-07-01",
      currency: "EUR",
      amount: "1000.00",
      buyerViesStatus: "not_checked",
      sellerViesStatus: "not_checked",
      countryPackStatuses: {
        DE: "professional_review_required",
        HU: "professional_review_required"
      },
      countryPackVersions: {
        DE: "scenario-educational",
        HU: "scenario-educational"
      },
      structuredInvoiceSignals: {
        hasCanonicalInvoice: true,
        hasUblXml: true,
        hasCiiXml: false,
        xsdUblStatus: "passed",
        schematronPeppolStatus: "not_checked",
        schematronEn16931Status: "not_checked"
      }
    },
    expectedFindings: [
      "POSSIBLE_INTRA_EU_B2B_REVERSE_CHARGE_CONTEXT",
      "VAT_TREATMENT_PROFESSIONAL_REVIEW_REQUIRED",
      "BUYER_VIES_EVIDENCE_NOT_CHECKED",
      "SELLER_VIES_EVIDENCE_NOT_CHECKED"
    ],
    legalSafeExplanation:
      "The scenario appears relevant for cross-border EU B2B review, but Invoice Lantern does not determine whether reverse charge applies.",
    countryPackContext: PROFESSIONAL_REVIEW_COUNTRY_PACK_CONTEXT,
    sourceRefs: COMMON_SOURCE_REFS,
    disclaimer: LEARNING_SCENARIO_DISCLAIMER,
    notForProductionUse: true
  },
  {
    scenarioId: "intra-eu-b2b-goods",
    title: "Intra-EU B2B goods readiness context",
    audience: "sme",
    description:
      "A fictional Hungarian seller ships goods to a fictional German business buyer. The scenario demonstrates goods-specific classification without issuing a tax conclusion.",
    learningGoals: [
      "Classify a cross-border EU B2B goods context.",
      "Understand that country-pack status can require professional review.",
      "Avoid treating technical classification as VAT-return guidance."
    ],
    transactionInput: {
      sellerCountry: "HU",
      buyerCountry: "DE",
      buyerType: "business",
      transactionType: "goods",
      currency: "EUR",
      amount: "2500.00",
      buyerViesStatus: "not_checked",
      sellerViesStatus: "not_checked",
      countryPackStatuses: {
        HU: "professional_review_required",
        DE: "professional_review_required"
      }
    },
    expectedFindings: [
      "POSSIBLE_INTRA_EU_B2B_REVERSE_CHARGE_CONTEXT",
      "VAT_TREATMENT_PROFESSIONAL_REVIEW_REQUIRED"
    ],
    legalSafeExplanation:
      "The goods transaction is classified as intra-EU B2B context, but any VAT treatment remains professional-review required.",
    countryPackContext: PROFESSIONAL_REVIEW_COUNTRY_PACK_CONTEXT,
    sourceRefs: COMMON_SOURCE_REFS,
    disclaimer: LEARNING_SCENARIO_DISCLAIMER,
    notForProductionUse: true
  },
  {
    scenarioId: "domestic-invoice",
    title: "Domestic invoice country-pack review context",
    audience: "accountant",
    description:
      "A fictional Hungarian seller invoices a fictional Hungarian business buyer. The scenario demonstrates domestic classification and country-pack review boundaries.",
    learningGoals: [
      "Classify domestic EU invoice context.",
      "Understand that domestic e-invoicing context depends on country-specific review.",
      "Avoid presenting national requirements as reviewed when sources are not verified."
    ],
    transactionInput: {
      sellerCountry: "HU",
      buyerCountry: "HU",
      buyerType: "business",
      transactionType: "services",
      currency: "HUF",
      amount: "50000",
      countryPackStatuses: {
        HU: "professional_review_required"
      }
    },
    expectedFindings: [
      "SELLER_COUNTRY_PACK_REVIEW_REQUIRED",
      "BUYER_COUNTRY_PACK_REVIEW_REQUIRED"
    ],
    legalSafeExplanation:
      "The scenario is domestic, so it is not an intra-EU B2B reverse-charge context. Country-specific review may still be required.",
    countryPackContext: PROFESSIONAL_REVIEW_COUNTRY_PACK_CONTEXT,
    sourceRefs: ["invoice-lantern-country-pack-legal-notice"],
    disclaimer: LEARNING_SCENARIO_DISCLAIMER,
    notForProductionUse: true
  },
  {
    scenarioId: "b2c-service",
    title: "Cross-border B2C service context",
    audience: "student",
    description:
      "A fictional German seller provides services to a fictional French consumer. The scenario demonstrates B2C separation from B2B reverse-charge review context.",
    learningGoals: [
      "Separate B2C from B2B transaction classification.",
      "Avoid applying B2B reverse-charge wording to consumers.",
      "Keep place-of-supply and consumer VAT facts under professional review."
    ],
    transactionInput: {
      sellerCountry: "DE",
      buyerCountry: "FR",
      buyerType: "consumer",
      transactionType: "services",
      currency: "EUR",
      amount: "120.00"
    },
    expectedFindings: ["SELLER_VAT_ID_REVIEW_REQUIRED"],
    legalSafeExplanation:
      "The scenario is cross-border EU B2C, not an intra-EU B2B reverse-charge context.",
    countryPackContext: BETA_COUNTRY_PACK_CONTEXT,
    sourceRefs: COMMON_SOURCE_REFS,
    disclaimer: LEARNING_SCENARIO_DISCLAIMER,
    notForProductionUse: true
  },
  {
    scenarioId: "missing-buyer-vat-id",
    title: "Missing buyer VAT ID in B2B context",
    audience: "developer",
    description:
      "A fictional intra-EU B2B services scenario where the buyer VAT ID is intentionally omitted to show review-required evidence handling.",
    learningGoals: [
      "Detect missing buyer VAT evidence in a likely B2B context.",
      "Avoid treating country and buyer type alone as VIES evidence.",
      "Preserve professional-review-required warnings."
    ],
    transactionInput: {
      sellerCountry: "DE",
      buyerCountry: "HU",
      sellerVatId: "DE*********",
      buyerType: "business",
      transactionType: "services",
      buyerViesStatus: "not_checked",
      sellerViesStatus: "not_checked"
    },
    expectedFindings: [
      "BUYER_VAT_ID_REVIEW_REQUIRED",
      "SELLER_VAT_FORMAT_REVIEW_REQUIRED",
      "POSSIBLE_INTRA_EU_B2B_REVERSE_CHARGE_CONTEXT"
    ],
    legalSafeExplanation:
      "The missing buyer VAT ID limits the evidence chain. The output remains a technical educational warning only.",
    countryPackContext: PROFESSIONAL_REVIEW_COUNTRY_PACK_CONTEXT,
    sourceRefs: COMMON_SOURCE_REFS,
    disclaimer: LEARNING_SCENARIO_DISCLAIMER,
    notForProductionUse: true
  },
  {
    scenarioId: "vies-unavailable",
    title: "VIES unavailable evidence state",
    audience: "accountant",
    description:
      "A fictional intra-EU B2B scenario where VIES evidence is unavailable. The scenario shows that unavailable is not invalid.",
    learningGoals: [
      "Represent VIES unavailable separately from invalid.",
      "Keep time-of-check evidence separate from legal conclusions.",
      "Review fallback procedures with a qualified professional."
    ],
    transactionInput: {
      sellerCountry: "DE",
      buyerCountry: "HU",
      sellerVatId: "DE*********",
      buyerVatId: "HU********",
      buyerType: "business",
      transactionType: "services",
      buyerViesStatus: "unavailable",
      sellerViesStatus: "unavailable"
    },
    expectedFindings: [
      "VIES_UNAVAILABLE_NOT_INVALID",
      "POSSIBLE_INTRA_EU_B2B_REVERSE_CHARGE_CONTEXT"
    ],
    legalSafeExplanation:
      "Unavailable VIES evidence is preserved as a separate evidence state and is not treated as invalid VAT status.",
    countryPackContext: PROFESSIONAL_REVIEW_COUNTRY_PACK_CONTEXT,
    sourceRefs: COMMON_SOURCE_REFS,
    disclaimer: LEARNING_SCENARIO_DISCLAIMER,
    notForProductionUse: true
  },
  {
    scenarioId: "ubl-ready-cii-not-exported",
    title: "UBL-ready with CII not exported",
    audience: "developer",
    description:
      "A fictional invoice context with UBL XML evidence present and CII XML absent. The scenario shows syntax evidence separation.",
    learningGoals: [
      "Represent UBL and CII evidence separately.",
      "Avoid interpreting UBL evidence as CII readiness.",
      "Keep XML evidence technical and non-certifying."
    ],
    transactionInput: {
      sellerCountry: "DE",
      buyerCountry: "HU",
      buyerType: "business",
      transactionType: "services",
      structuredInvoiceSignals: {
        hasCanonicalInvoice: true,
        hasUblXml: true,
        hasCiiXml: false,
        xsdUblStatus: "passed",
        schematronPeppolStatus: "passed",
        schematronEn16931Status: "passed"
      }
    },
    expectedFindings: ["UBL_XML_EVIDENCE_PRESENT"],
    legalSafeExplanation:
      "UBL evidence is technical XML context only and does not prove Peppol, EN 16931, tax, filing, or authority acceptance.",
    countryPackContext: BETA_COUNTRY_PACK_CONTEXT,
    sourceRefs: ["invoice-lantern-country-pack-legal-notice"],
    disclaimer: LEARNING_SCENARIO_DISCLAIMER,
    notForProductionUse: true
  },
  {
    scenarioId: "cii-ready-xsd-not-configured",
    title: "CII present with XSD not configured",
    audience: "developer",
    description:
      "A fictional invoice context with CII XML evidence present but CII XSD not configured. The scenario shows that not configured is not a pass.",
    learningGoals: [
      "Represent CII evidence separately from UBL evidence.",
      "Treat not_configured as not successful.",
      "Preserve technical validation boundaries."
    ],
    transactionInput: {
      sellerCountry: "DE",
      buyerCountry: "HU",
      buyerType: "business",
      transactionType: "services",
      structuredInvoiceSignals: {
        hasCanonicalInvoice: true,
        hasUblXml: false,
        hasCiiXml: true,
        xsdCiiStatus: "not_configured",
        schematronEn16931Status: "passed"
      }
    },
    expectedFindings: [
      "CII_XML_EVIDENCE_PRESENT",
      "CII_XSD_EVIDENCE_NOT_CONFIGURED"
    ],
    legalSafeExplanation:
      "CII XML presence is useful technical context, but missing XSD configuration prevents treating the evidence as technically checked.",
    countryPackContext: BETA_COUNTRY_PACK_CONTEXT,
    sourceRefs: ["invoice-lantern-country-pack-legal-notice"],
    disclaimer: LEARNING_SCENARIO_DISCLAIMER,
    notForProductionUse: true
  },
  {
    scenarioId: "country-pack-review-required",
    title: "Country-pack professional review required",
    audience: "sme",
    description:
      "A fictional scenario where both country packs are explicitly marked professional-review required to demonstrate conservative source handling.",
    learningGoals: [
      "Understand source-linked country-pack status labels.",
      "Avoid relying on conservative packs as official national rules.",
      "Keep review warnings visible in simulation output."
    ],
    transactionInput: {
      sellerCountry: "DE",
      buyerCountry: "HU",
      buyerType: "business",
      transactionType: "mixed",
      countryPackStatuses: {
        DE: "professional_review_required",
        HU: "professional_review_required"
      }
    },
    expectedFindings: [
      "SELLER_COUNTRY_PACK_REVIEW_REQUIRED",
      "BUYER_COUNTRY_PACK_REVIEW_REQUIRED"
    ],
    legalSafeExplanation:
      "The scenario demonstrates that country-pack review status is itself evidence context and must not be upgraded into official guidance.",
    countryPackContext: PROFESSIONAL_REVIEW_COUNTRY_PACK_CONTEXT,
    sourceRefs: ["invoice-lantern-country-pack-legal-notice"],
    disclaimer: LEARNING_SCENARIO_DISCLAIMER,
    notForProductionUse: true
  },
  {
    scenarioId: "invalid-totals-context",
    title: "Invalid totals context with transaction review",
    audience: "student",
    description:
      "A fictional invoice-learning case for pairing calculation validation with transaction-context review. Totals are described as invalid for learning, but no production invoice is created.",
    learningGoals: [
      "Separate arithmetic validation from transaction classification.",
      "Avoid using transaction simulation to repair invoice totals.",
      "Keep learning templates out of production records unless intentionally started as a draft."
    ],
    transactionInput: {
      sellerCountry: "DE",
      buyerCountry: "HU",
      buyerType: "business",
      transactionType: "services",
      currency: "EUR",
      amount: "not-a-production-total",
      structuredInvoiceSignals: {
        hasCanonicalInvoice: false,
        hasUblXml: false,
        hasCiiXml: false
      }
    },
    expectedFindings: [
      "STRUCTURED_CANONICAL_INVOICE_EVIDENCE_MISSING",
      "STRUCTURED_XML_EVIDENCE_MISSING"
    ],
    legalSafeExplanation:
      "The scenario is for learning validation flow only. It does not create accounting entries, VAT returns, or production invoices.",
    countryPackContext: BETA_COUNTRY_PACK_CONTEXT,
    sourceRefs: ["invoice-lantern-country-pack-legal-notice"],
    disclaimer: LEARNING_SCENARIO_DISCLAIMER,
    notForProductionUse: true
  }
];

function cloneJson<T>(input: T): T {
  return JSON.parse(JSON.stringify(input)) as T;
}

function cloneScenario(scenario: LearningScenario): LearningScenario {
  return cloneJson(scenario);
}

function toSummary(scenario: LearningScenario): LearningScenarioSummary {
  const preview = classifyTransaction(scenario.transactionInput);
  const { transactionInput: _transactionInput, ...summary } = scenario;

  return {
    ...cloneJson(summary),
    transactionClassHint: preview.transactionClass
  };
}

function expectedFindingCodes(findings: TransactionSimulationFinding[]) {
  return new Set(findings.map((finding) => finding.code));
}

export function listLearningScenarios(): LearningScenarioSummary[] {
  return SCENARIOS.map(toSummary);
}

export function getLearningScenario(
  scenarioId: string
): LearningScenario | null {
  const normalizedScenarioId = scenarioId.trim().toLowerCase();
  const scenario = SCENARIOS.find(
    (item) => item.scenarioId.toLowerCase() === normalizedScenarioId
  );

  return scenario ? cloneScenario(scenario) : null;
}

export function previewLearningScenario(
  scenarioId: string
): LearningScenarioPreviewResult | null {
  const scenario = getLearningScenario(scenarioId);

  if (!scenario) {
    return null;
  }

  const transactionSimulation = classifyTransaction(scenario.transactionInput);
  const findingCodes = expectedFindingCodes(transactionSimulation.findings);
  const matchedExpectedFindings = scenario.expectedFindings.filter((code) =>
    findingCodes.has(code)
  );
  const missingExpectedFindings = scenario.expectedFindings.filter(
    (code) => !findingCodes.has(code)
  );

  return {
    scenario,
    transactionSimulation,
    matchedExpectedFindings,
    missingExpectedFindings,
    legalSafeExplanation: scenario.legalSafeExplanation,
    disclaimer: `${LEARNING_SCENARIO_DISCLAIMER} ${TRANSACTION_SIMULATION_DISCLAIMER}`,
    notForProductionUse: true
  };
}

export function listLearningScenarioIds(): string[] {
  return SCENARIOS.map((scenario) => scenario.scenarioId);
}
