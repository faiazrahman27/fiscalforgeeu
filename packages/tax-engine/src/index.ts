export type VatFormatResult = {
  input: string;
  normalized: string;
  countryCode?: string;
  countryName?: string;
  formatValid: boolean;
  checkLevel: "local_format";
  source: "invoice_lantern_vat_format_rules";
  message: string;
  warnings: string[];
  disclaimer: string;
};

type VatFormatRule = {
  countryName: string;
  pattern: RegExp;
};

export type TransactionBuyerType =
  | "business"
  | "consumer"
  | "public_authority"
  | "unknown";

export type TransactionType =
  | "goods"
  | "services"
  | "digital_service"
  | "digital_services"
  | "mixed"
  | "unknown";

export type NormalizedTransactionType =
  | "goods"
  | "services"
  | "digital_services"
  | "mixed"
  | "unknown";

export type TransactionClass =
  | "domestic"
  | "intra_eu_b2b_goods"
  | "intra_eu_b2b_services"
  | "intra_eu_b2c_goods"
  | "intra_eu_b2c_services"
  | "eu_to_non_eu"
  | "non_eu_to_eu"
  | "non_eu"
  | "unknown";

export type ViesEvidenceStatus =
  | "valid"
  | "invalid"
  | "unavailable"
  | "error"
  | "not_checked"
  | "unsupported"
  | "rate_limited"
  | "unknown";

export type LegalConfidence =
  | "technical"
  | "standard_based"
  | "official_source_derived"
  | "educational_simulation"
  | "professional_review_required";

export type TransactionFindingSeverity =
  | "info"
  | "warning"
  | "fatal"
  | "blocked";

export type TransactionFindingCategory =
  | "SCHEMA"
  | "CALCULATION"
  | "VAT_ID"
  | "VIES"
  | "COUNTRY_PACK"
  | "VIDA_SIMULATION"
  | "LEGAL_LABEL"
  | "STRUCTURED_INVOICE"
  | "UBL"
  | "CII"
  | "XSD"
  | "SCHEMATRON";

export type TransactionStructuredCheckStatus =
  | "passed"
  | "failed"
  | "warning"
  | "not_configured"
  | "not_checked"
  | "unavailable"
  | "unknown";

export type TransactionSimulationFinding = {
  code: string;
  severity: TransactionFindingSeverity;
  category: TransactionFindingCategory;
  fieldPath?: string;
  message: string;
  fixSuggestion: string;
  legalConfidence: LegalConfidence;
  professionalReviewRequired: boolean;
  sourceRefIds: string[];
  ruleSetCode: string;
  ruleVersion: string;
};

export type TransactionClassifierInput = {
  sellerCountry?: string;
  buyerCountry?: string;
  sellerVatId?: string;
  buyerVatId?: string;
  sellerVatCountry?: string;
  buyerVatCountry?: string;
  buyerType?: TransactionBuyerType;
  transactionType?: TransactionType;
  invoiceDate?: string;
  currency?: string;
  amount?: string;
  hasViesEvidence?: boolean;
  buyerViesStatus?: ViesEvidenceStatus;
  sellerViesStatus?: ViesEvidenceStatus;
  countryPackVersions?: Record<string, string>;
  countryPackStatuses?: Record<string, string>;
  structuredInvoiceSignals?: {
    hasCanonicalInvoice?: boolean;
    hasUblXml?: boolean;
    hasCiiXml?: boolean;
    xsdStatus?: string;
    xsdUblStatus?: string;
    xsdCiiStatus?: string;
    schematronPeppolStatus?: string;
    schematronEn16931Status?: string;
  };
};

export type TransactionStructuredInvoiceEvidence = {
  hasCanonicalInvoice: boolean;
  hasUblXml: boolean;
  hasCiiXml: boolean;
  xsdStatus: TransactionStructuredCheckStatus;
  xsdUblStatus: TransactionStructuredCheckStatus;
  xsdCiiStatus: TransactionStructuredCheckStatus;
  schematronPeppolStatus: TransactionStructuredCheckStatus;
  schematronEn16931Status: TransactionStructuredCheckStatus;
  warnings: string[];
};

export type TransactionClassifierResult = {
  transactionClass: TransactionClass;
  legalConfidence: LegalConfidence;
  euContext: {
    sellerCountry: string | null;
    buyerCountry: string | null;
    sellerIsEu: boolean;
    buyerIsEu: boolean;
    crossBorderEu: boolean;
  };
  reverseChargeSimulation: {
    relevance: "not_relevant" | "possible" | "needs_review" | "unknown";
    message: string;
    warnings: string[];
    legalConfidence: LegalConfidence;
    professionalReviewRequired: boolean;
  };
  vatIdEvidence: {
    sellerFormatStatus: "valid" | "invalid" | "not_checked" | "unsupported";
    buyerFormatStatus: "valid" | "invalid" | "not_checked" | "unsupported";
    buyerViesStatus: ViesEvidenceStatus;
    sellerViesStatus: ViesEvidenceStatus;
    warnings: string[];
  };
  structuredInvoiceEvidence: TransactionStructuredInvoiceEvidence;
  countryPackContext: {
    sellerCountryPackStatus: string;
    buyerCountryPackStatus: string;
    ruleVersions: Record<string, string>;
    sourceRefs: string[];
  };
  findings: TransactionSimulationFinding[];
  disclaimers: string[];
  disclaimer: string;
};

export const VAT_FORMAT_CHECK_SOURCE =
  "invoice_lantern_vat_format_rules" as const;

export const TAX_ENGINE_RULE_VERSION = "2026.05.2";
export const TAX_ENGINE_RULE_SET_CODE = "INVOICE_LANTERN_TAX_ENGINE";

export const VAT_FORMAT_DISCLAIMER =
  "This is a local VAT ID format check only. It does not confirm that the VAT number exists, is active, belongs to a party, is registered for VAT, has been validated through VIES, or is accepted by any authority. Use VIES or a competent authority for official confirmation.";

export const VIES_EVIDENCE_DISCLAIMER =
  "VIES evidence, when requested and available, is time-of-check evidence only. VIES unavailable is not the same as invalid. A positive VIES response is not legal, tax, accounting, filing, or transaction compliance proof.";

export const TRANSACTION_SIMULATION_DISCLAIMER =
  "Transaction classification and reverse-charge indicators in Invoice Lantern are educational technical simulations only. They are not legal, tax, accounting, VAT-return, filing, authority, or compliance conclusions. Qualified professional review is required before real-world reliance.";

export const STRUCTURED_INVOICE_EVIDENCE_DISCLAIMER =
  "Structured invoice evidence, including UBL, CII, XSD, and Schematron status, is technical validation context only. It does not create official EN 16931 certification, Peppol certification, tax compliance, filing acceptance, or authority acceptance.";

const TECHNICAL_ONLY_WARNING =
  "Format checks are technical only and do not determine VAT registration status.";

const VIES_NOT_CHECKED_WARNING =
  "Local VAT format checks are separate from VIES evidence. No VIES evidence result is inferred from local format status.";

const EU_MEMBER_STATE_COUNTRY_CODES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE"
]);

const VAT_FORMAT_RULES = {
  AT: {
    countryName: "Austria",
    pattern: /^ATU\d{8}$/
  },
  BE: {
    countryName: "Belgium",
    pattern: /^BE[01]\d{9}$/
  },
  BG: {
    countryName: "Bulgaria",
    pattern: /^BG\d{9,10}$/
  },
  CY: {
    countryName: "Cyprus",
    pattern: /^CY\d{8}[A-Z]$/
  },
  CZ: {
    countryName: "Czechia",
    pattern: /^CZ\d{8,10}$/
  },
  DE: {
    countryName: "Germany",
    pattern: /^DE\d{9}$/
  },
  DK: {
    countryName: "Denmark",
    pattern: /^DK\d{8}$/
  },
  EE: {
    countryName: "Estonia",
    pattern: /^EE\d{9}$/
  },
  EL: {
    countryName: "Greece",
    pattern: /^EL\d{9}$/
  },
  ES: {
    countryName: "Spain",
    pattern: /^ES(?:[A-Z]\d{8}|\d{8}[A-Z]|[A-Z]\d{7}[A-Z0-9])$/
  },
  FI: {
    countryName: "Finland",
    pattern: /^FI\d{8}$/
  },
  FR: {
    countryName: "France",
    pattern: /^FR[A-Z0-9]{2}\d{9}$/
  },
  HR: {
    countryName: "Croatia",
    pattern: /^HR\d{11}$/
  },
  HU: {
    countryName: "Hungary",
    pattern: /^HU\d{8}$/
  },
  IE: {
    countryName: "Ireland",
    pattern: /^IE(?:\d{7}[A-Z]{1,2}|\d[A-Z0-9]\d{5}[A-Z])$/
  },
  IT: {
    countryName: "Italy",
    pattern: /^IT\d{11}$/
  },
  LT: {
    countryName: "Lithuania",
    pattern: /^LT(?:\d{9}|\d{12})$/
  },
  LU: {
    countryName: "Luxembourg",
    pattern: /^LU\d{8}$/
  },
  LV: {
    countryName: "Latvia",
    pattern: /^LV\d{11}$/
  },
  MT: {
    countryName: "Malta",
    pattern: /^MT\d{8}$/
  },
  NL: {
    countryName: "Netherlands",
    pattern: /^NL\d{9}B\d{2}$/
  },
  PL: {
    countryName: "Poland",
    pattern: /^PL\d{10}$/
  },
  PT: {
    countryName: "Portugal",
    pattern: /^PT\d{9}$/
  },
  RO: {
    countryName: "Romania",
    pattern: /^RO\d{2,10}$/
  },
  SE: {
    countryName: "Sweden",
    pattern: /^SE\d{10}01$/
  },
  SI: {
    countryName: "Slovenia",
    pattern: /^SI\d{8}$/
  },
  SK: {
    countryName: "Slovakia",
    pattern: /^SK\d{10}$/
  },
  XI: {
    countryName: "Northern Ireland",
    pattern: /^XI(?:\d{9}|\d{12})$/
  }
} satisfies Record<string, VatFormatRule>;

export type SupportedVatCountryCode = keyof typeof VAT_FORMAT_RULES;

const VAT_COUNTRY_HINT_ALIASES: Record<string, SupportedVatCountryCode> = {
  GR: "EL"
};

const JURISDICTION_COUNTRY_ALIASES: Record<string, string> = {
  EL: "GR"
};

export function normalizeVatId(input: string): string {
  return input.trim().toUpperCase().replace(/[\s\-./]+/g, "");
}

export function extractVatCountry(input: string): string | null {
  const normalized = normalizeVatId(input);
  const prefix = normalized.slice(0, 2);

  return isSupportedVatCountryCode(prefix) ? prefix : null;
}

export function validateVatFormat(
  input: string,
  countryHint?: string
): VatFormatResult {
  const normalizedInput = normalizeVatId(input);
  const warnings: string[] = [];
  const hint = normalizeCountryHint(countryHint);
  const hasRawHint = Boolean(countryHint?.trim());
  const detectedCountry = extractVatCountry(input);
  const supportedDetectedCountry =
    detectedCountry && isSupportedVatCountryCode(detectedCountry)
      ? detectedCountry
      : null;
  const leadingPrefix = extractLeadingCountryLikePrefix(normalizedInput);

  if (!normalizedInput) {
    return buildVatFormatResult({
      input,
      normalized: normalizedInput,
      formatValid: false,
      message: "Enter a VAT ID to run a local format check.",
      warnings: [TECHNICAL_ONLY_WARNING, VIES_NOT_CHECKED_WARNING]
    });
  }

  if (hasRawHint && !hint) {
    warnings.push(
      "Country hint was ignored because it is not a two-letter country code."
    );
  }

  if (supportedDetectedCountry && hint && isSupportedVatCountryCode(hint)) {
    if (supportedDetectedCountry !== hint) {
      return buildVatFormatResult({
        input,
        normalized: normalizedInput,
        countryCode: supportedDetectedCountry,
        formatValid: false,
        message:
          "The selected country hint conflicts with the VAT ID prefix, so this local format check did not pass.",
        warnings: [
          `Country hint ${hint} conflicts with detected VAT prefix ${supportedDetectedCountry}.`,
          TECHNICAL_ONLY_WARNING,
          VIES_NOT_CHECKED_WARNING
        ]
      });
    }
  }

  if (supportedDetectedCountry) {
    if (hint && !isSupportedVatCountryCode(hint)) {
      warnings.push(
        `Country hint ${hint} is not supported and was not used because the VAT ID includes a supported prefix.`
      );
    }

    return validateNormalizedVatId({
      input,
      normalized: normalizedInput,
      countryCode: supportedDetectedCountry,
      warnings
    });
  }

  if (leadingPrefix) {
    return buildVatFormatResult({
      input,
      normalized: normalizedInput,
      countryCode: leadingPrefix,
      formatValid: false,
      message:
        "Invoice Lantern does not currently support a local VAT format pattern for the selected country.",
      warnings: [TECHNICAL_ONLY_WARNING, VIES_NOT_CHECKED_WARNING]
    });
  }

  if (hint) {
    if (!isSupportedVatCountryCode(hint)) {
      return buildVatFormatResult({
        input,
        normalized: `${hint}${normalizedInput}`,
        countryCode: hint,
        formatValid: false,
        message:
          "Invoice Lantern does not currently support a local VAT format pattern for the selected country.",
        warnings: [TECHNICAL_ONLY_WARNING, VIES_NOT_CHECKED_WARNING]
      });
    }

    return validateNormalizedVatId({
      input,
      normalized: `${hint}${normalizedInput}`,
      countryCode: hint,
      warnings: [
        ...warnings,
        "Country hint was used because the VAT ID did not include a supported country prefix."
      ]
    });
  }

  return buildVatFormatResult({
    input,
    normalized: normalizedInput,
    formatValid: false,
    message:
      "No supported VAT country prefix was detected. Provide a supported country hint to run a local format check.",
    warnings: [
      "The VAT ID did not include a supported country prefix.",
      TECHNICAL_ONLY_WARNING,
      VIES_NOT_CHECKED_WARNING
    ]
  });
}

export function listSupportedVatFormatCountries(): SupportedVatCountryCode[] {
  return Object.keys(VAT_FORMAT_RULES) as SupportedVatCountryCode[];
}

export function getVatFormatCountryName(countryCode: string | undefined) {
  if (!countryCode) {
    return undefined;
  }

  const normalized = normalizeCountryHint(countryCode);

  if (!normalized || !isSupportedVatCountryCode(normalized)) {
    return undefined;
  }

  return VAT_FORMAT_RULES[normalized].countryName;
}

export function classifyTransaction(
  input: TransactionClassifierInput
): TransactionClassifierResult {
  const sellerCountry = normalizeJurisdictionCountryCode(input.sellerCountry);
  const buyerCountry = normalizeJurisdictionCountryCode(input.buyerCountry);
  const buyerType = input.buyerType ?? "unknown";
  const transactionType = normalizeTransactionType(input.transactionType);
  const structuredInvoiceEvidence = normalizeStructuredInvoiceEvidence(
    input.structuredInvoiceSignals
  );

  const sellerIsEu = sellerCountry ? isEuMemberState(sellerCountry) : false;
  const buyerIsEu = buyerCountry ? isEuMemberState(buyerCountry) : false;
  const crossBorderEu =
    Boolean(sellerCountry && buyerCountry) &&
    sellerIsEu &&
    buyerIsEu &&
    sellerCountry !== buyerCountry;

  const buyerViesStatus = normalizeViesStatus(input.buyerViesStatus);
  const sellerViesStatus = normalizeViesStatus(input.sellerViesStatus);

  const sellerFormatResult = input.sellerVatId
    ? validateVatFormat(
        input.sellerVatId,
        normalizeVatCountryHintFromJurisdiction(
          input.sellerVatCountry ?? input.sellerCountry
        )
      )
    : null;
  const buyerFormatResult = input.buyerVatId
    ? validateVatFormat(
        input.buyerVatId,
        normalizeVatCountryHintFromJurisdiction(
          input.buyerVatCountry ?? input.buyerCountry
        )
      )
    : null;

  const transactionClass = resolveTransactionClass({
    sellerCountry,
    buyerCountry,
    sellerIsEu,
    buyerIsEu,
    crossBorderEu,
    buyerType,
    transactionType
  });

  const findings: TransactionSimulationFinding[] = [];
  const vatWarnings: string[] = [];

  if (!sellerCountry || !buyerCountry) {
    findings.push(
      createTransactionFinding({
        code: "TRANSACTION_COUNTRY_CONTEXT_INCOMPLETE",
        severity: "warning",
        category: "COUNTRY_PACK",
        fieldPath: !sellerCountry ? "sellerCountry" : "buyerCountry",
        message:
          "Seller and buyer countries are required for reliable transaction context simulation.",
        fixSuggestion:
          "Add seller and buyer country information, then rerun the transaction simulation.",
        legalConfidence: "professional_review_required",
        sourceRefIds: ["invoice-lantern-country-pack-legal-notice"]
      })
    );
  }

  if (buyerType === "unknown") {
    findings.push(
      createTransactionFinding({
        code: "BUYER_TYPE_REVIEW_REQUIRED",
        severity: "warning",
        category: "LEGAL_LABEL",
        fieldPath: "buyerType",
        message:
          "Buyer type is unknown, so B2B/B2C transaction context cannot be concluded.",
        fixSuggestion:
          "Classify the buyer as business, consumer, public authority, or keep the result under professional review.",
        legalConfidence: "professional_review_required",
        sourceRefIds: ["invoice-lantern-country-pack-legal-notice"]
      })
    );
  }

  if (transactionType === "unknown") {
    findings.push(
      createTransactionFinding({
        code: "TRANSACTION_TYPE_REVIEW_REQUIRED",
        severity: "warning",
        category: "LEGAL_LABEL",
        fieldPath: "transactionType",
        message:
          "Transaction type is unknown, so goods/services-specific simulation context is limited.",
        fixSuggestion:
          "Classify the transaction as goods, services, digital services, or mixed before relying on the simulation context.",
        legalConfidence: "professional_review_required",
        sourceRefIds: ["invoice-lantern-country-pack-legal-notice"]
      })
    );
  }

  if (!input.sellerVatId) {
    vatWarnings.push("Seller VAT ID was not supplied.");
    findings.push(
      createTransactionFinding({
        code: "SELLER_VAT_ID_REVIEW_REQUIRED",
        severity: "warning",
        category: "VAT_ID",
        fieldPath: "sellerVatId",
        message:
          "Seller VAT ID was not supplied. VAT registration context cannot be inferred.",
        fixSuggestion:
          "Add seller VAT ID where relevant and run local format and optional VIES evidence checks.",
        legalConfidence: "professional_review_required",
        sourceRefIds: ["eu-vies-vat-information-exchange-system"]
      })
    );
  }

  if (crossBorderEu && buyerType === "business" && !input.buyerVatId) {
    vatWarnings.push("Buyer VAT ID was not supplied for an intra-EU B2B context.");
    findings.push(
      createTransactionFinding({
        code: "BUYER_VAT_ID_REVIEW_REQUIRED",
        severity: "warning",
        category: "VAT_ID",
        fieldPath: "buyerVatId",
        message:
          "Buyer VAT ID was not supplied for a possible intra-EU B2B context.",
        fixSuggestion:
          "Add the buyer VAT ID and run local format and optional VIES evidence checks. Do not treat this simulation as tax advice.",
        legalConfidence: "professional_review_required",
        sourceRefIds: ["eu-vies-vat-information-exchange-system"]
      })
    );
  }

  if (sellerFormatResult && !sellerFormatResult.formatValid) {
    vatWarnings.push("Seller VAT ID did not pass local format simulation.");
    findings.push(
      createTransactionFinding({
        code: "SELLER_VAT_FORMAT_REVIEW_REQUIRED",
        severity: "warning",
        category: "VAT_ID",
        fieldPath: "sellerVatId",
        message:
          "Seller VAT ID did not pass the local format simulation. This does not determine official validity.",
        fixSuggestion:
          "Review the seller VAT ID format and use VIES or a competent authority where appropriate.",
        legalConfidence: "technical",
        sourceRefIds: ["eu-vies-vat-information-exchange-system"]
      })
    );
  }

  if (buyerFormatResult && !buyerFormatResult.formatValid) {
    vatWarnings.push("Buyer VAT ID did not pass local format simulation.");
    findings.push(
      createTransactionFinding({
        code: "BUYER_VAT_FORMAT_REVIEW_REQUIRED",
        severity: "warning",
        category: "VAT_ID",
        fieldPath: "buyerVatId",
        message:
          "Buyer VAT ID did not pass the local format simulation. This does not determine official validity.",
        fixSuggestion:
          "Review the buyer VAT ID format and use VIES or a competent authority where appropriate.",
        legalConfidence: "technical",
        sourceRefIds: ["eu-vies-vat-information-exchange-system"]
      })
    );
  }

  if (buyerViesStatus === "not_checked" && input.buyerVatId) {
    vatWarnings.push("Buyer VIES evidence was not checked.");
    findings.push(
      createTransactionFinding({
        code: "BUYER_VIES_EVIDENCE_NOT_CHECKED",
        severity: "warning",
        category: "VIES",
        fieldPath: "buyerViesStatus",
        message:
          "Buyer VIES evidence is not checked. Local VAT format status is not VIES evidence.",
        fixSuggestion:
          "Run an optional VIES evidence check where appropriate and available. Treat VIES evidence as time-of-check evidence only.",
        legalConfidence: "educational_simulation",
        sourceRefIds: ["eu-vies-vat-information-exchange-system"]
      })
    );
  }

  if (sellerViesStatus === "not_checked" && input.sellerVatId) {
    vatWarnings.push("Seller VIES evidence was not checked.");
    findings.push(
      createTransactionFinding({
        code: "SELLER_VIES_EVIDENCE_NOT_CHECKED",
        severity: "warning",
        category: "VIES",
        fieldPath: "sellerViesStatus",
        message:
          "Seller VIES evidence is not checked. Local VAT format status is not VIES evidence.",
        fixSuggestion:
          "Run an optional VIES evidence check where appropriate and available. Treat VIES evidence as time-of-check evidence only.",
        legalConfidence: "educational_simulation",
        sourceRefIds: ["eu-vies-vat-information-exchange-system"]
      })
    );
  }

  if (buyerViesStatus === "unavailable" || sellerViesStatus === "unavailable") {
    vatWarnings.push("VIES unavailable is not the same as invalid.");
    findings.push(
      createTransactionFinding({
        code: "VIES_UNAVAILABLE_NOT_INVALID",
        severity: "warning",
        category: "VIES",
        fieldPath: "viesStatus",
        message:
          "VIES was unavailable for at least one party. Unavailable VIES evidence is not the same as invalid VAT status.",
        fixSuggestion:
          "Retry later or consult a competent authority where official confirmation is needed.",
        legalConfidence: "educational_simulation",
        sourceRefIds: ["eu-vies-vat-information-exchange-system"]
      })
    );
  }

  addStructuredInvoiceEvidenceFindings(findings, structuredInvoiceEvidence);

  const reverseChargeSimulation = buildReverseChargeSimulation({
    transactionClass,
    crossBorderEu,
    buyerType,
    transactionType
  });

  if (
    reverseChargeSimulation.relevance === "possible" ||
    reverseChargeSimulation.relevance === "needs_review"
  ) {
    findings.push(
      createTransactionFinding({
        code: "POSSIBLE_INTRA_EU_B2B_REVERSE_CHARGE_CONTEXT",
        severity: "warning",
        category: "LEGAL_LABEL",
        fieldPath: "transactionContext",
        message:
          "This transaction appears to match a possible intra-EU B2B reverse-charge review context. This is an educational simulation only.",
        fixSuggestion:
          "Review buyer status, VAT evidence, place-of-supply facts, country rules, invoice wording, and local obligations with a qualified professional.",
        legalConfidence: "educational_simulation",
        sourceRefIds: [
          "eu-vat-country-specific-information",
          "invoice-lantern-country-pack-legal-notice"
        ]
      })
    );

    findings.push(
      createTransactionFinding({
        code: "VAT_TREATMENT_PROFESSIONAL_REVIEW_REQUIRED",
        severity: "warning",
        category: "LEGAL_LABEL",
        fieldPath: "transactionContext",
        message:
          "VAT treatment is not concluded by this simulation and requires professional review.",
        fixSuggestion:
          "Use this output as technical context only, not as a VAT return, filing, or tax decision.",
        legalConfidence: "professional_review_required",
        sourceRefIds: ["invoice-lantern-country-pack-legal-notice"]
      })
    );
  }

  const sellerCountryPackStatus = resolveCountryPackStatus(
    sellerCountry,
    input.countryPackStatuses
  );
  const buyerCountryPackStatus = resolveCountryPackStatus(
    buyerCountry,
    input.countryPackStatuses
  );

  if (countryPackNeedsReview(sellerCountryPackStatus)) {
    findings.push(
      createTransactionFinding({
        code: "SELLER_COUNTRY_PACK_REVIEW_REQUIRED",
        severity: "warning",
        category: "COUNTRY_PACK",
        fieldPath: "sellerCountry",
        message:
          "Seller country pack status requires professional review before real-world reliance.",
        fixSuggestion:
          "Check the current country pack source coverage, review date, and national-source status.",
        legalConfidence: "professional_review_required",
        sourceRefIds: ["invoice-lantern-country-pack-legal-notice"]
      })
    );
  }

  if (countryPackNeedsReview(buyerCountryPackStatus)) {
    findings.push(
      createTransactionFinding({
        code: "BUYER_COUNTRY_PACK_REVIEW_REQUIRED",
        severity: "warning",
        category: "COUNTRY_PACK",
        fieldPath: "buyerCountry",
        message:
          "Buyer country pack status requires professional review before real-world reliance.",
        fixSuggestion:
          "Check the current country pack source coverage, review date, and national-source status.",
        legalConfidence: "professional_review_required",
        sourceRefIds: ["invoice-lantern-country-pack-legal-notice"]
      })
    );
  }

  return {
    transactionClass,
    legalConfidence: resolveOverallLegalConfidence(findings),
    euContext: {
      sellerCountry,
      buyerCountry,
      sellerIsEu,
      buyerIsEu,
      crossBorderEu
    },
    reverseChargeSimulation,
    vatIdEvidence: {
      sellerFormatStatus: normalizeVatFormatStatus(sellerFormatResult),
      buyerFormatStatus: normalizeVatFormatStatus(buyerFormatResult),
      buyerViesStatus,
      sellerViesStatus,
      warnings: uniqueStrings(vatWarnings)
    },
    structuredInvoiceEvidence,
    countryPackContext: {
      sellerCountryPackStatus,
      buyerCountryPackStatus,
      ruleVersions: buildCountryPackRuleVersions({
        sellerCountry,
        buyerCountry,
        countryPackVersions: input.countryPackVersions
      }),
      sourceRefs: [
        "invoice-lantern-country-pack-legal-notice",
        "eu-vat-country-specific-information",
        "eu-vies-vat-information-exchange-system"
      ]
    },
    findings: dedupeFindings(findings),
    disclaimers: [
      VAT_FORMAT_DISCLAIMER,
      VIES_EVIDENCE_DISCLAIMER,
      STRUCTURED_INVOICE_EVIDENCE_DISCLAIMER,
      TRANSACTION_SIMULATION_DISCLAIMER
    ],
    disclaimer: TRANSACTION_SIMULATION_DISCLAIMER
  };
}

export function isEuMemberState(countryCode: string | undefined): boolean {
  const normalized = normalizeJurisdictionCountryCode(countryCode);

  return normalized ? EU_MEMBER_STATE_COUNTRY_CODES.has(normalized) : false;
}

export function normalizeJurisdictionCountryCode(
  countryCode: string | undefined
): string | null {
  if (!countryCode) {
    return null;
  }

  const normalized = countryCode.trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(normalized)) {
    return null;
  }

  return JURISDICTION_COUNTRY_ALIASES[normalized] ?? normalized;
}

function validateNormalizedVatId(input: {
  input: string;
  normalized: string;
  countryCode: SupportedVatCountryCode;
  warnings: string[];
}) {
  const rule = VAT_FORMAT_RULES[input.countryCode];
  const formatValid = rule.pattern.test(input.normalized);

  return buildVatFormatResult({
    input: input.input,
    normalized: input.normalized,
    countryCode: input.countryCode,
    formatValid,
    message: formatValid
      ? `This VAT ID appears to match the expected local format pattern for ${rule.countryName}.`
      : "This VAT ID does not match the expected local format pattern for the selected country.",
    warnings: [
      ...input.warnings,
      TECHNICAL_ONLY_WARNING,
      VIES_NOT_CHECKED_WARNING
    ]
  });
}

function buildVatFormatResult(input: {
  input: string;
  normalized: string;
  countryCode?: string;
  formatValid: boolean;
  message: string;
  warnings: string[];
}): VatFormatResult {
  const result: VatFormatResult = {
    input: input.input,
    normalized: input.normalized,
    formatValid: input.formatValid,
    checkLevel: "local_format",
    source: VAT_FORMAT_CHECK_SOURCE,
    message: input.message,
    warnings: uniqueStrings(input.warnings),
    disclaimer: VAT_FORMAT_DISCLAIMER
  };

  if (input.countryCode) {
    const countryName = getVatFormatCountryName(input.countryCode);

    result.countryCode = input.countryCode;

    if (countryName) {
      result.countryName = countryName;
    }
  }

  return result;
}

function normalizeCountryHint(input: string | undefined) {
  if (!input) {
    return null;
  }

  const normalized = normalizeVatId(input);

  if (!/^[A-Z]{2}$/.test(normalized)) {
    return null;
  }

  return VAT_COUNTRY_HINT_ALIASES[normalized] ?? normalized;
}

function normalizeVatCountryHintFromJurisdiction(
  input: string | undefined
): string | undefined {
  const normalized = normalizeJurisdictionCountryCode(input);

  if (!normalized) {
    return undefined;
  }

  return normalized === "GR" ? "EL" : normalized;
}

function extractLeadingCountryLikePrefix(input: string) {
  const match = /^[A-Z]{2}/.exec(input);

  return match ? match[0] : null;
}

function isSupportedVatCountryCode(
  input: string
): input is SupportedVatCountryCode {
  return Object.prototype.hasOwnProperty.call(VAT_FORMAT_RULES, input);
}

function normalizeViesStatus(
  status: ViesEvidenceStatus | undefined
): ViesEvidenceStatus {
  if (
    status === "valid" ||
    status === "invalid" ||
    status === "unavailable" ||
    status === "error" ||
    status === "not_checked" ||
    status === "unsupported" ||
    status === "rate_limited" ||
    status === "unknown"
  ) {
    return status === "unknown" ? "not_checked" : status;
  }

  return "not_checked";
}

function normalizeTransactionType(
  transactionType: TransactionType | undefined
): NormalizedTransactionType {
  if (
    transactionType === "goods" ||
    transactionType === "services" ||
    transactionType === "mixed"
  ) {
    return transactionType;
  }

  if (
    transactionType === "digital_service" ||
    transactionType === "digital_services"
  ) {
    return "digital_services";
  }

  return "unknown";
}

function normalizeStructuredCheckStatus(
  status: string | undefined
): TransactionStructuredCheckStatus {
  if (
    status === "passed" ||
    status === "failed" ||
    status === "warning" ||
    status === "not_configured" ||
    status === "not_checked" ||
    status === "unavailable" ||
    status === "unknown"
  ) {
    return status;
  }

  return "not_checked";
}

function normalizeStructuredInvoiceEvidence(
  input: TransactionClassifierInput["structuredInvoiceSignals"]
): TransactionStructuredInvoiceEvidence {
  const hasCanonicalInvoice = input?.hasCanonicalInvoice ?? false;
  const hasUblXml = input?.hasUblXml ?? false;
  const hasCiiXml = input?.hasCiiXml ?? false;
  const genericXsdStatus = normalizeStructuredCheckStatus(input?.xsdStatus);
  const xsdUblStatus = normalizeStructuredCheckStatus(input?.xsdUblStatus);
  const xsdCiiStatus = normalizeStructuredCheckStatus(input?.xsdCiiStatus);
  const schematronPeppolStatus = normalizeStructuredCheckStatus(
    input?.schematronPeppolStatus
  );
  const schematronEn16931Status = normalizeStructuredCheckStatus(
    input?.schematronEn16931Status
  );
  const warnings: string[] = [];

  if (!hasCanonicalInvoice) {
    warnings.push(
      "Canonical invoice evidence was not supplied. Transaction simulation should be treated as limited technical context."
    );
  }

  if (!hasUblXml && !hasCiiXml) {
    warnings.push(
      "No UBL or CII XML evidence was supplied. Structured XML evidence improves technical readiness context."
    );
  }

  if (hasUblXml && xsdUblStatus === "not_configured") {
    warnings.push(
      "UBL XSD evidence is not configured. Not configured is treated as unchecked XML evidence."
    );
  }

  if (hasCiiXml && xsdCiiStatus === "not_configured") {
    warnings.push(
      "CII XSD evidence is not configured. Not configured is treated as unchecked XML evidence."
    );
  }

  if (genericXsdStatus === "not_configured") {
    warnings.push(
      "Generic XSD evidence is not configured. Not configured is treated as unchecked XML evidence."
    );
  }

  return {
    hasCanonicalInvoice,
    hasUblXml,
    hasCiiXml,
    xsdStatus: genericXsdStatus,
    xsdUblStatus,
    xsdCiiStatus,
    schematronPeppolStatus,
    schematronEn16931Status,
    warnings: uniqueStrings(warnings)
  };
}

function addStructuredInvoiceEvidenceFindings(
  findings: TransactionSimulationFinding[],
  evidence: TransactionStructuredInvoiceEvidence
) {
  if (!evidence.hasCanonicalInvoice) {
    findings.push(
      createTransactionFinding({
        code: "STRUCTURED_CANONICAL_INVOICE_EVIDENCE_MISSING",
        severity: "warning",
        category: "STRUCTURED_INVOICE",
        fieldPath: "structuredInvoiceSignals.hasCanonicalInvoice",
        message:
          "Canonical invoice evidence was not supplied. Transaction simulation remains limited technical context.",
        fixSuggestion:
          "Normalize the invoice through the canonical invoice model before interpreting transaction context.",
        legalConfidence: "technical",
        sourceRefIds: ["invoice-lantern-country-pack-legal-notice"]
      })
    );
  }

  if (!evidence.hasUblXml && !evidence.hasCiiXml) {
    findings.push(
      createTransactionFinding({
        code: "STRUCTURED_XML_EVIDENCE_MISSING",
        severity: "warning",
        category: "STRUCTURED_INVOICE",
        fieldPath: "structuredInvoiceSignals",
        message:
          "No UBL or CII XML evidence was supplied. Structured XML evidence improves technical readiness context.",
        fixSuggestion:
          "Generate or import UBL/CII XML and run configured technical checks where appropriate.",
        legalConfidence: "technical",
        sourceRefIds: ["invoice-lantern-country-pack-legal-notice"]
      })
    );
  }

  if (evidence.hasUblXml) {
    findings.push(
      createTransactionFinding({
        code: "UBL_XML_EVIDENCE_PRESENT",
        severity: "info",
        category: "UBL",
        fieldPath: "structuredInvoiceSignals.hasUblXml",
        message:
          "UBL XML evidence is present as technical structured invoice context.",
        fixSuggestion:
          "Keep UBL XSD and Schematron evidence separate from legal, tax, filing, Peppol, EN 16931, or authority conclusions.",
        legalConfidence: "technical",
        sourceRefIds: ["invoice-lantern-country-pack-legal-notice"]
      })
    );
  }

  if (evidence.hasCiiXml) {
    findings.push(
      createTransactionFinding({
        code: "CII_XML_EVIDENCE_PRESENT",
        severity: "info",
        category: "CII",
        fieldPath: "structuredInvoiceSignals.hasCiiXml",
        message:
          "CII XML evidence is present as technical structured invoice context.",
        fixSuggestion:
          "Keep CII XSD and EN 16931-style evidence separate from legal, tax, filing, certification, or authority conclusions.",
        legalConfidence: "technical",
        sourceRefIds: ["invoice-lantern-country-pack-legal-notice"]
      })
    );
  }

  if (evidence.xsdStatus === "failed") {
    findings.push(
      createTransactionFinding({
        code: "GENERIC_XSD_EVIDENCE_FAILED",
        severity: "warning",
        category: "XSD",
        fieldPath: "structuredInvoiceSignals.xsdStatus",
        message:
          "Generic XSD evidence failed. This lowers technical readiness context only.",
        fixSuggestion:
          "Fix XML schema issues and rerun configured validation.",
        legalConfidence: "technical",
        sourceRefIds: ["invoice-lantern-country-pack-legal-notice"]
      })
    );
  }

  if (evidence.xsdStatus === "not_configured") {
    findings.push(
      createTransactionFinding({
        code: "GENERIC_XSD_EVIDENCE_NOT_CONFIGURED",
        severity: "warning",
        category: "XSD",
        fieldPath: "structuredInvoiceSignals.xsdStatus",
        message:
          "Generic XSD evidence is not configured. This evidence remains unchecked until validation is configured.",
        fixSuggestion:
          "Configure the XML validation worker or mark this evidence as not checked.",
        legalConfidence: "technical",
        sourceRefIds: ["invoice-lantern-country-pack-legal-notice"]
      })
    );
  }

  if (evidence.hasUblXml && evidence.xsdUblStatus === "failed") {
    findings.push(
      createTransactionFinding({
        code: "UBL_XSD_EVIDENCE_FAILED",
        severity: "warning",
        category: "UBL",
        fieldPath: "structuredInvoiceSignals.xsdUblStatus",
        message:
          "UBL XSD evidence failed. This is a technical XML validation warning only.",
        fixSuggestion:
          "Fix UBL XML schema issues and rerun configured UBL XSD validation.",
        legalConfidence: "technical",
        sourceRefIds: ["invoice-lantern-country-pack-legal-notice"]
      })
    );
  }

  if (evidence.hasUblXml && evidence.xsdUblStatus === "not_configured") {
    findings.push(
      createTransactionFinding({
        code: "UBL_XSD_EVIDENCE_NOT_CONFIGURED",
        severity: "warning",
        category: "UBL",
        fieldPath: "structuredInvoiceSignals.xsdUblStatus",
        message:
          "UBL XSD evidence is not configured. This UBL evidence remains unchecked until validation is configured.",
        fixSuggestion:
          "Configure UBL XSD validation before treating UBL XML evidence as technically checked.",
        legalConfidence: "technical",
        sourceRefIds: ["invoice-lantern-country-pack-legal-notice"]
      })
    );
  }

  if (evidence.hasCiiXml && evidence.xsdCiiStatus === "failed") {
    findings.push(
      createTransactionFinding({
        code: "CII_XSD_EVIDENCE_FAILED",
        severity: "warning",
        category: "CII",
        fieldPath: "structuredInvoiceSignals.xsdCiiStatus",
        message:
          "CII XSD evidence failed. This is a technical XML validation warning only.",
        fixSuggestion:
          "Fix CII XML schema issues and rerun configured CII XSD validation.",
        legalConfidence: "technical",
        sourceRefIds: ["invoice-lantern-country-pack-legal-notice"]
      })
    );
  }

  if (evidence.hasCiiXml && evidence.xsdCiiStatus === "not_configured") {
    findings.push(
      createTransactionFinding({
        code: "CII_XSD_EVIDENCE_NOT_CONFIGURED",
        severity: "warning",
        category: "CII",
        fieldPath: "structuredInvoiceSignals.xsdCiiStatus",
        message:
          "CII XSD evidence is not configured. This CII evidence remains unchecked until validation is configured.",
        fixSuggestion:
          "Configure CII XSD validation before treating CII evidence as technically checked.",
        legalConfidence: "technical",
        sourceRefIds: ["invoice-lantern-country-pack-legal-notice"]
      })
    );
  }

  if (evidence.schematronPeppolStatus === "failed") {
    findings.push(
      createTransactionFinding({
        code: "PEPPOL_SCHEMATRON_EVIDENCE_FAILED",
        severity: "warning",
        category: "SCHEMATRON",
        fieldPath: "structuredInvoiceSignals.schematronPeppolStatus",
        message:
          "Peppol-style Schematron evidence failed. This is technical rule-check context only.",
        fixSuggestion:
          "Review Peppol-style findings and rerun guarded Schematron checks where configured.",
        legalConfidence: "technical",
        sourceRefIds: ["invoice-lantern-country-pack-legal-notice"]
      })
    );
  }

  if (evidence.schematronPeppolStatus === "not_configured") {
    findings.push(
      createTransactionFinding({
        code: "PEPPOL_SCHEMATRON_EVIDENCE_NOT_CONFIGURED",
        severity: "warning",
        category: "SCHEMATRON",
        fieldPath: "structuredInvoiceSignals.schematronPeppolStatus",
        message:
          "Peppol-style Schematron evidence is not configured. This rule evidence remains unchecked until guarded execution is configured.",
        fixSuggestion:
          "Configure guarded Peppol-style Schematron execution where this evidence is required.",
        legalConfidence: "technical",
        sourceRefIds: ["invoice-lantern-country-pack-legal-notice"]
      })
    );
  }

  if (evidence.schematronEn16931Status === "failed") {
    findings.push(
      createTransactionFinding({
        code: "EN16931_SCHEMATRON_EVIDENCE_FAILED",
        severity: "warning",
        category: "SCHEMATRON",
        fieldPath: "structuredInvoiceSignals.schematronEn16931Status",
        message:
          "EN 16931-style Schematron evidence failed. This is technical rule-check context only.",
        fixSuggestion:
          "Review EN 16931-style findings and rerun guarded Schematron checks where configured.",
        legalConfidence: "technical",
        sourceRefIds: ["invoice-lantern-country-pack-legal-notice"]
      })
    );
  }

  if (evidence.schematronEn16931Status === "not_configured") {
    findings.push(
      createTransactionFinding({
        code: "EN16931_SCHEMATRON_EVIDENCE_NOT_CONFIGURED",
        severity: "warning",
        category: "SCHEMATRON",
        fieldPath: "structuredInvoiceSignals.schematronEn16931Status",
        message:
          "EN 16931-style Schematron evidence is not configured. This rule evidence remains unchecked until guarded execution is configured.",
        fixSuggestion:
          "Configure guarded EN 16931-style Schematron execution where this evidence is required.",
        legalConfidence: "technical",
        sourceRefIds: ["invoice-lantern-country-pack-legal-notice"]
      })
    );
  }
}

function resolveTransactionClass(input: {
  sellerCountry: string | null;
  buyerCountry: string | null;
  sellerIsEu: boolean;
  buyerIsEu: boolean;
  crossBorderEu: boolean;
  buyerType: TransactionBuyerType;
  transactionType: NormalizedTransactionType;
}): TransactionClass {
  if (!input.sellerCountry || !input.buyerCountry) {
    return "unknown";
  }

  if (input.sellerCountry === input.buyerCountry) {
    return "domestic";
  }

  if (input.sellerIsEu && input.buyerIsEu && input.crossBorderEu) {
    if (input.buyerType === "business") {
      if (input.transactionType === "goods") {
        return "intra_eu_b2b_goods";
      }

      if (
        input.transactionType === "services" ||
        input.transactionType === "digital_services" ||
        input.transactionType === "mixed"
      ) {
        return "intra_eu_b2b_services";
      }

      return "unknown";
    }

    if (
      input.buyerType === "consumer" ||
      input.buyerType === "public_authority"
    ) {
      if (input.transactionType === "goods") {
        return "intra_eu_b2c_goods";
      }

      if (
        input.transactionType === "services" ||
        input.transactionType === "digital_services" ||
        input.transactionType === "mixed"
      ) {
        return "intra_eu_b2c_services";
      }
    }

    return "unknown";
  }

  if (input.sellerIsEu && !input.buyerIsEu) {
    return "eu_to_non_eu";
  }

  if (!input.sellerIsEu && input.buyerIsEu) {
    return "non_eu_to_eu";
  }

  if (!input.sellerIsEu && !input.buyerIsEu) {
    return "non_eu";
  }

  return "unknown";
}

function buildReverseChargeSimulation(input: {
  transactionClass: TransactionClass;
  crossBorderEu: boolean;
  buyerType: TransactionBuyerType;
  transactionType: NormalizedTransactionType;
}): TransactionClassifierResult["reverseChargeSimulation"] {
  if (
    input.transactionClass === "intra_eu_b2b_goods" ||
    input.transactionClass === "intra_eu_b2b_services"
  ) {
    return {
      relevance: "possible",
      message:
        "This appears to be an intra-EU B2B context where reverse-charge review may be relevant. Invoice Lantern does not determine VAT treatment.",
      warnings: [
        "Possible reverse-charge context is an educational warning only.",
        "Buyer status, VAT evidence, place-of-supply facts, invoice wording, national rules, and professional review remain required."
      ],
      legalConfidence: "educational_simulation",
      professionalReviewRequired: true
    };
  }

  if (input.crossBorderEu && input.buyerType === "unknown") {
    return {
      relevance: "needs_review",
      message:
        "This is a cross-border EU context, but buyer type is unknown. Reverse-charge relevance cannot be simulated reliably.",
      warnings: [
        "Buyer type must be reviewed before B2B/B2C VAT context can be assessed.",
        "No legal or tax conclusion is produced."
      ],
      legalConfidence: "professional_review_required",
      professionalReviewRequired: true
    };
  }

  if (input.transactionClass === "unknown") {
    return {
      relevance: "unknown",
      message:
        "Reverse-charge relevance is unknown because the transaction context is incomplete or unsupported.",
      warnings: [
        "Add seller country, buyer country, buyer type, and transaction type for a safer simulation."
      ],
      legalConfidence: "professional_review_required",
      professionalReviewRequired: true
    };
  }

  return {
    relevance: "not_relevant",
    message:
      "No intra-EU B2B reverse-charge review context was detected by this educational simulation.",
    warnings: [
      "This is not a legal or tax conclusion. Country-specific facts may still require professional review."
    ],
    legalConfidence: "educational_simulation",
    professionalReviewRequired: true
  };
}

function createTransactionFinding(input: {
  code: string;
  severity: TransactionFindingSeverity;
  category: TransactionFindingCategory;
  fieldPath?: string;
  message: string;
  fixSuggestion: string;
  legalConfidence: LegalConfidence;
  sourceRefIds: string[];
}): TransactionSimulationFinding {
  return {
    code: input.code,
    severity: input.severity,
    category: input.category,
    ...(input.fieldPath ? { fieldPath: input.fieldPath } : {}),
    message: input.message,
    fixSuggestion: input.fixSuggestion,
    legalConfidence: input.legalConfidence,
    professionalReviewRequired:
      input.legalConfidence !== "technical" ||
      input.category === "LEGAL_LABEL" ||
      input.category === "COUNTRY_PACK" ||
      input.category === "VIES",
    sourceRefIds: input.sourceRefIds,
    ruleSetCode: TAX_ENGINE_RULE_SET_CODE,
    ruleVersion: TAX_ENGINE_RULE_VERSION
  };
}

function normalizeVatFormatStatus(
  result: VatFormatResult | null
): "valid" | "invalid" | "not_checked" | "unsupported" {
  if (!result) {
    return "not_checked";
  }

  if (result.countryCode && !getVatFormatCountryName(result.countryCode)) {
    return "unsupported";
  }

  return result.formatValid ? "valid" : "invalid";
}

function normalizeRecordKeys(input: Record<string, string> | undefined) {
  const output: Record<string, string> = {};

  if (!input) {
    return output;
  }

  for (const [rawKey, rawValue] of Object.entries(input)) {
    const jurisdictionCode = normalizeJurisdictionCountryCode(rawKey);
    const vatCode = normalizeVatCountryHintFromJurisdiction(rawKey);
    const value = rawValue.trim();

    if (!value) {
      continue;
    }

    if (jurisdictionCode) {
      output[jurisdictionCode] = value;
    }

    if (vatCode) {
      output[vatCode] = value;
    }
  }

  return output;
}

function resolveCountryPackStatus(
  countryCode: string | null,
  statuses: Record<string, string> | undefined
) {
  if (!countryCode) {
    return "unknown";
  }

  const normalizedStatuses = normalizeRecordKeys(statuses);

  return (
    normalizedStatuses[countryCode] ??
    normalizedStatuses[
      normalizeVatCountryHintFromJurisdiction(countryCode) ?? countryCode
    ] ??
    "professional_review_required"
  );
}

function buildCountryPackRuleVersions(input: {
  sellerCountry: string | null;
  buyerCountry: string | null;
  countryPackVersions: Record<string, string> | undefined;
}) {
  const normalizedVersions = normalizeRecordKeys(input.countryPackVersions);
  const output: Record<string, string> = {};

  for (const countryCode of [input.sellerCountry, input.buyerCountry]) {
    if (!countryCode) {
      continue;
    }

    output[countryCode] =
      normalizedVersions[countryCode] ??
      normalizedVersions[
        normalizeVatCountryHintFromJurisdiction(countryCode) ?? countryCode
      ] ??
      "unknown";
  }

  return output;
}

function countryPackNeedsReview(status: string) {
  return (
    status === "unknown" ||
    status === "draft" ||
    status === "beta" ||
    status === "not_reviewed" ||
    status === "source_required" ||
    status === "eu_core_only" ||
    status === "professional_review_required"
  );
}

function resolveOverallLegalConfidence(
  findings: TransactionSimulationFinding[]
): LegalConfidence {
  if (
    findings.some(
      (finding) => finding.legalConfidence === "professional_review_required"
    )
  ) {
    return "professional_review_required";
  }

  return "educational_simulation";
}

function dedupeFindings(
  findings: TransactionSimulationFinding[]
): TransactionSimulationFinding[] {
  const seen = new Set<string>();

  return findings.filter((finding) => {
    const key = `${finding.code}:${finding.fieldPath ?? ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

export * from "./learning-scenarios.js";
