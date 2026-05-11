export const VIDA_SIMULATOR_VERSION = "2026.05.1";

export const VIDA_SIMULATOR_DISCLAIMER =
  "Invoice Lantern ViDA-readiness simulation is an educational and technical sandbox result only. It is not official software, not an official ViDA determination, not legal advice, not tax advice, not accounting advice, not authority submission, not filing software, and not a compliance guarantee. Before issuing real invoices or making VAT decisions, consult a qualified accountant, tax adviser, or competent authority.";

export const VIDA_EFFECTIVE_DATE_CONTEXT =
  "Digital Reporting Requirements for cross-border EU B2B transactions are expected to apply from 1 July 2030 under the ViDA rollout context. This simulation only checks whether the scenario appears relevant for readiness planning; it does not decide legal obligations.";

export type VidaBuyerType =
  | "business"
  | "consumer"
  | "public_authority"
  | "unknown";

export type VidaTransactionType =
  | "goods"
  | "services"
  | "digital_service"
  | "mixed"
  | "unknown";

export type VidaTransactionClass =
  | "intra_eu_b2b_goods"
  | "intra_eu_b2b_service"
  | "intra_eu_b2b_digital_service"
  | "intra_eu_b2b_mixed"
  | "intra_eu_b2b_unknown"
  | "intra_eu_b2c"
  | "intra_eu_public_authority"
  | "domestic_eu_business"
  | "domestic_eu_consumer"
  | "domestic_eu_unknown"
  | "non_eu_or_unsupported"
  | "insufficient_data";

export type VidaRelevance =
  | "high"
  | "medium"
  | "low"
  | "not_relevant"
  | "review_required";

export type VidaFindingSeverity = "info" | "warning" | "review_required";

export type VidaLegalConfidence =
  | "educational_simulation"
  | "professional_review_required";

export type VidaReadinessSimulationInput = {
  sellerCountry: string;
  buyerCountry: string;
  sellerVatId?: string;
  buyerVatId?: string;
  buyerType?: VidaBuyerType;
  transactionType?: VidaTransactionType;
  invoiceDate?: string;
  currency?: string;
  amount?: string;
  countryPackVersions?: Record<string, string>;
};

export type NormalizedVidaInput = {
  sellerCountryCode: string | null;
  buyerCountryCode: string | null;
  sellerVatId: string | null;
  buyerVatId: string | null;
  buyerType: VidaBuyerType;
  transactionType: VidaTransactionType;
  invoiceDate: string | null;
  currency: string | null;
  amount: string | null;
  countryPackVersions: Record<string, string>;
};

export type VidaCountryContext = {
  sellerInEu: boolean;
  buyerInEu: boolean;
  sameCountry: boolean;
  crossBorderEu: boolean;
};

export type VidaReadinessFinding = {
  code: string;
  severity: VidaFindingSeverity;
  message: string;
  legalConfidence: VidaLegalConfidence;
  sourceLabels: string[];
  fixSuggestion: string;
};

export type VidaReadinessSimulationResult = {
  simulationVersion: string;
  transactionClass: VidaTransactionClass;
  vidaRelevance: VidaRelevance;
  reason: string;
  effectiveDateContext: string;
  confidence: VidaLegalConfidence;
  legalConfidence: VidaLegalConfidence;
  countryContext: VidaCountryContext;
  normalizedInput: NormalizedVidaInput;
  findings: VidaReadinessFinding[];
  recommendedNextActions: string[];
  disclaimer: string;
};

const EU_MEMBER_STATE_CODES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "EL",
  "ES",
  "FI",
  "FR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK"
]);

const COUNTRY_CODE_ALIASES: Readonly<Record<string, string>> = {
  GR: "EL"
};

function normalizeText(input: string | undefined) {
  if (!input) {
    return null;
  }

  const normalized = input.trim();

  return normalized.length > 0 ? normalized : null;
}

function normalizeCountryCode(input: string | undefined) {
  const normalized = normalizeText(input)?.toUpperCase().replace(/[^A-Z]/g, "");

  if (!normalized || normalized.length !== 2) {
    return null;
  }

  return COUNTRY_CODE_ALIASES[normalized] ?? normalized;
}

function normalizeVatId(input: string | undefined) {
  const normalized = normalizeText(input)
    ?.toUpperCase()
    .replace(/[\s\-./]+/g, "");

  return normalized && normalized.length > 0 ? normalized : null;
}

function normalizeBuyerType(input: VidaBuyerType | undefined): VidaBuyerType {
  return input ?? "unknown";
}

function normalizeTransactionType(
  input: VidaTransactionType | undefined
): VidaTransactionType {
  return input ?? "unknown";
}

function normalizeCountryPackVersions(
  input: Record<string, string> | undefined
) {
  const normalizedVersions: Record<string, string> = {};

  if (!input) {
    return normalizedVersions;
  }

  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = rawKey.trim().toUpperCase();
    const value = rawValue.trim();

    if (key.length > 0 && value.length > 0) {
      normalizedVersions[key] = value;
    }
  }

  return normalizedVersions;
}

export function normalizeVidaSimulationInput(
  input: VidaReadinessSimulationInput
): NormalizedVidaInput {
  return {
    sellerCountryCode: normalizeCountryCode(input.sellerCountry),
    buyerCountryCode: normalizeCountryCode(input.buyerCountry),
    sellerVatId: normalizeVatId(input.sellerVatId),
    buyerVatId: normalizeVatId(input.buyerVatId),
    buyerType: normalizeBuyerType(input.buyerType),
    transactionType: normalizeTransactionType(input.transactionType),
    invoiceDate: normalizeText(input.invoiceDate),
    currency: normalizeText(input.currency)?.toUpperCase() ?? null,
    amount: normalizeText(input.amount),
    countryPackVersions: normalizeCountryPackVersions(input.countryPackVersions)
  };
}

export function isEuMemberStateCountryCode(countryCode: string | null) {
  return Boolean(countryCode && EU_MEMBER_STATE_CODES.has(countryCode));
}

export function buildVidaCountryContext(
  input: NormalizedVidaInput
): VidaCountryContext {
  const sellerInEu = isEuMemberStateCountryCode(input.sellerCountryCode);
  const buyerInEu = isEuMemberStateCountryCode(input.buyerCountryCode);
  const sameCountry = Boolean(
    input.sellerCountryCode &&
      input.buyerCountryCode &&
      input.sellerCountryCode === input.buyerCountryCode
  );

  return {
    sellerInEu,
    buyerInEu,
    sameCountry,
    crossBorderEu: sellerInEu && buyerInEu && !sameCountry
  };
}

function classifyIntraEuTransaction(
  input: NormalizedVidaInput
): VidaTransactionClass {
  if (input.buyerType === "consumer") {
    return "intra_eu_b2c";
  }

  if (input.buyerType === "public_authority") {
    return "intra_eu_public_authority";
  }

  if (input.buyerType !== "business") {
    return "intra_eu_b2b_unknown";
  }

  if (input.transactionType === "goods") {
    return "intra_eu_b2b_goods";
  }

  if (input.transactionType === "services") {
    return "intra_eu_b2b_service";
  }

  if (input.transactionType === "digital_service") {
    return "intra_eu_b2b_digital_service";
  }

  if (input.transactionType === "mixed") {
    return "intra_eu_b2b_mixed";
  }

  return "intra_eu_b2b_unknown";
}

function classifyDomesticEuTransaction(
  input: NormalizedVidaInput
): VidaTransactionClass {
  if (input.buyerType === "business") {
    return "domestic_eu_business";
  }

  if (input.buyerType === "consumer") {
    return "domestic_eu_consumer";
  }

  return "domestic_eu_unknown";
}

export function classifyVidaTransaction(
  input: NormalizedVidaInput,
  context: VidaCountryContext
): VidaTransactionClass {
  if (!input.sellerCountryCode || !input.buyerCountryCode) {
    return "insufficient_data";
  }

  if (!context.sellerInEu || !context.buyerInEu) {
    return "non_eu_or_unsupported";
  }

  if (context.crossBorderEu) {
    return classifyIntraEuTransaction(input);
  }

  return classifyDomesticEuTransaction(input);
}

function getVidaRelevance(
  transactionClass: VidaTransactionClass
): VidaRelevance {
  if (
    transactionClass === "intra_eu_b2b_goods" ||
    transactionClass === "intra_eu_b2b_service" ||
    transactionClass === "intra_eu_b2b_digital_service" ||
    transactionClass === "intra_eu_b2b_mixed"
  ) {
    return "high";
  }

  if (
    transactionClass === "intra_eu_b2b_unknown" ||
    transactionClass === "intra_eu_public_authority"
  ) {
    return "review_required";
  }

  if (
    transactionClass === "domestic_eu_business" ||
    transactionClass === "domestic_eu_unknown"
  ) {
    return "medium";
  }

  if (transactionClass === "intra_eu_b2c") {
    return "low";
  }

  return "not_relevant";
}

function buildReason(
  transactionClass: VidaTransactionClass,
  input: NormalizedVidaInput,
  context: VidaCountryContext
) {
  if (transactionClass === "insufficient_data") {
    return "Seller and buyer country codes are required before Invoice Lantern can run a ViDA-readiness simulation.";
  }

  if (transactionClass === "non_eu_or_unsupported") {
    return "At least one party is outside the supported EU Member State set, so the scenario is not treated as an EU cross-border B2B readiness simulation.";
  }

  if (context.crossBorderEu && input.buyerType === "business") {
    return "Seller and buyer appear to be in different EU Member States and the buyer is marked as a business, so the scenario appears relevant for ViDA-style cross-border B2B readiness planning.";
  }

  if (transactionClass === "intra_eu_public_authority") {
    return "The transaction appears cross-border within the EU, but the buyer is marked as a public authority. Public procurement and national e-invoicing rules require separate professional review.";
  }

  if (transactionClass === "intra_eu_b2c") {
    return "The transaction appears cross-border within the EU, but the buyer is marked as a consumer. This simulator focuses on business-readiness signals and does not decide consumer VAT obligations.";
  }

  if (transactionClass === "domestic_eu_business") {
    return "Seller and buyer appear to be in the same EU Member State. ViDA cross-border readiness may be less central, but domestic e-invoicing and national VAT obligations may still require country-specific review.";
  }

  if (transactionClass === "domestic_eu_consumer") {
    return "Seller and buyer appear to be in the same EU Member State and the buyer is marked as a consumer. This is not treated as a cross-border B2B readiness scenario.";
  }

  return "The scenario needs more context before a stronger readiness signal can be shown.";
}

function finding(input: {
  code: string;
  severity: VidaFindingSeverity;
  message: string;
  fixSuggestion: string;
  sourceLabels?: string[];
}): VidaReadinessFinding {
  return {
    code: input.code,
    severity: input.severity,
    message: input.message,
    legalConfidence:
      input.severity === "review_required"
        ? "professional_review_required"
        : "educational_simulation",
    sourceLabels: input.sourceLabels ?? [
      "Invoice Lantern ViDA-readiness simulator",
      "EU-core readiness context"
    ],
    fixSuggestion: input.fixSuggestion
  };
}

function buildFindings(
  input: NormalizedVidaInput,
  context: VidaCountryContext,
  transactionClass: VidaTransactionClass,
  vidaRelevance: VidaRelevance
) {
  const findings: VidaReadinessFinding[] = [];

  if (!input.sellerCountryCode) {
    findings.push(
      finding({
        code: "VIDA_SELLER_COUNTRY_REQUIRED",
        severity: "review_required",
        message:
          "Seller country is required for the ViDA-readiness simulation.",
        fixSuggestion:
          "Provide the seller country as a two-letter country code before using the readiness result."
      })
    );
  }

  if (!input.buyerCountryCode) {
    findings.push(
      finding({
        code: "VIDA_BUYER_COUNTRY_REQUIRED",
        severity: "review_required",
        message: "Buyer country is required for the ViDA-readiness simulation.",
        fixSuggestion:
          "Provide the buyer country as a two-letter country code before using the readiness result."
      })
    );
  }

  if (
    input.sellerCountryCode &&
    input.buyerCountryCode &&
    (!context.sellerInEu || !context.buyerInEu)
  ) {
    findings.push(
      finding({
        code: "VIDA_UNSUPPORTED_COUNTRY_CONTEXT",
        severity: "warning",
        message:
          "At least one party is not in the supported EU Member State set for this simulator.",
        fixSuggestion:
          "Use country-specific professional review for non-EU or unsupported country scenarios."
      })
    );
  }

  if (context.crossBorderEu && input.buyerType === "unknown") {
    findings.push(
      finding({
        code: "VIDA_BUYER_TYPE_REVIEW_REQUIRED",
        severity: "review_required",
        message:
          "The transaction appears cross-border within the EU, but the buyer type is unknown.",
        fixSuggestion:
          "Confirm whether the buyer is a business, consumer, or public authority before interpreting the readiness signal."
      })
    );
  }

  if (
    context.crossBorderEu &&
    input.buyerType === "business" &&
    !input.buyerVatId
  ) {
    findings.push(
      finding({
        code: "VIDA_BUYER_VAT_ID_CONTEXT_MISSING",
        severity: "warning",
        message:
          "The buyer is marked as a business in a cross-border EU scenario, but no buyer VAT ID was provided.",
        fixSuggestion:
          "Add the buyer VAT ID and run local VAT-format and VIES-evidence checks where appropriate."
      })
    );
  }

  if (
    context.crossBorderEu &&
    input.buyerType === "business" &&
    !input.sellerVatId
  ) {
    findings.push(
      finding({
        code: "VIDA_SELLER_VAT_ID_CONTEXT_MISSING",
        severity: "warning",
        message:
          "The seller is in a cross-border EU business scenario, but no seller VAT ID was provided.",
        fixSuggestion:
          "Add the seller VAT ID to improve readiness classification and audit context."
      })
    );
  }

  if (
    transactionClass === "intra_eu_b2b_goods" ||
    transactionClass === "intra_eu_b2b_service" ||
    transactionClass === "intra_eu_b2b_digital_service" ||
    transactionClass === "intra_eu_b2b_mixed"
  ) {
    findings.push(
      finding({
        code: "VIDA_INTRA_EU_B2B_RELEVANCE_SIGNAL",
        severity: "info",
        message:
          "This scenario appears relevant for ViDA-style cross-border B2B readiness planning.",
        fixSuggestion:
          "Validate invoice structure, VAT IDs, UBL output, country-pack context, and professional-review requirements before real-world use."
      })
    );
  }

  if (
    transactionClass === "domestic_eu_business" ||
    transactionClass === "domestic_eu_unknown"
  ) {
    findings.push(
      finding({
        code: "VIDA_DOMESTIC_RULE_PACK_REVIEW_REQUIRED",
        severity: "warning",
        message:
          "This appears to be a domestic EU scenario. Domestic e-invoicing and VAT requirements depend on the relevant country rules.",
        fixSuggestion:
          "Use the applicable country pack and professional review for domestic e-invoicing and VAT obligations."
      })
    );
  }

  if (vidaRelevance === "review_required") {
    findings.push(
      finding({
        code: "VIDA_PROFESSIONAL_REVIEW_REQUIRED",
        severity: "review_required",
        message:
          "The simulation cannot safely provide a stronger readiness signal without additional factual context.",
        fixSuggestion:
          "Review buyer status, transaction type, VAT IDs, place-of-supply facts, country rules, and professional advice."
      })
    );
  }

  return findings;
}

function buildRecommendedNextActions(
  transactionClass: VidaTransactionClass,
  findings: VidaReadinessFinding[]
) {
  const actions = [
    "Validate the invoice as structured data before relying on any readiness output.",
    "Run local VAT-format checks and keep VIES evidence where appropriate.",
    "Review applicable country packs and their source-review dates.",
    "Treat this result as an educational simulation, not legal, tax, accounting, filing, or authority advice."
  ];

  if (
    transactionClass === "intra_eu_b2b_goods" ||
    transactionClass === "intra_eu_b2b_service" ||
    transactionClass === "intra_eu_b2b_digital_service" ||
    transactionClass === "intra_eu_b2b_mixed"
  ) {
    actions.unshift(
      "Prepare the invoice data for cross-border EU B2B readiness review."
    );
  }

  if (findings.some((item) => item.severity === "review_required")) {
    actions.unshift(
      "Resolve review-required findings before interpreting the readiness result."
    );
  }

  return actions;
}

export function simulateVidaReadiness(
  input: VidaReadinessSimulationInput
): VidaReadinessSimulationResult {
  const normalizedInput = normalizeVidaSimulationInput(input);
  const countryContext = buildVidaCountryContext(normalizedInput);
  const transactionClass = classifyVidaTransaction(
    normalizedInput,
    countryContext
  );
  const vidaRelevance = getVidaRelevance(transactionClass);
  const reason = buildReason(transactionClass, normalizedInput, countryContext);
  const findings = buildFindings(
    normalizedInput,
    countryContext,
    transactionClass,
    vidaRelevance
  );

  return {
    simulationVersion: VIDA_SIMULATOR_VERSION,
    transactionClass,
    vidaRelevance,
    reason,
    effectiveDateContext: VIDA_EFFECTIVE_DATE_CONTEXT,
    confidence: "educational_simulation",
    legalConfidence:
      vidaRelevance === "review_required"
        ? "professional_review_required"
        : "educational_simulation",
    countryContext,
    normalizedInput,
    findings,
    recommendedNextActions: buildRecommendedNextActions(
      transactionClass,
      findings
    ),
    disclaimer: VIDA_SIMULATOR_DISCLAIMER
  };
}