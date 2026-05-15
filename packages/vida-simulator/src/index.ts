import {
  getCountryPack,
  getEuMemberStateCountryCodes,
  listCountryPacks,
  normalizeCountryCode as normalizeCountryPackCode,
  type CountryPack,
  type CountryPackConfidenceStatus,
  type CountryPackSourceReference,
  type CountryPackStatus,
  type LegalConfidence as CountryPackLegalConfidence
} from "@invoice-lantern/country-packs";
import type { CanonicalInvoice } from "@invoice-lantern/invoice-core";
import {
  classifyTransaction,
  normalizeVatId as normalizeVatFormatInput,
  validateVatFormat,
  type TransactionBuyerType as TaxEngineBuyerType,
  type TransactionClassifierInput as TaxEngineTransactionClassifierInput,
  type TransactionClassifierResult,
  type TransactionType as TaxEngineTransactionType,
  type VatFormatResult,
  type ViesEvidenceStatus as TaxEngineViesEvidenceStatus
} from "@invoice-lantern/tax-engine";

export const VIDA_SIMULATOR_VERSION = "2026.05.5";

export const VIDA_SIMULATOR_DISCLAIMER =
  "Invoice Lantern ViDA-readiness simulation is an independent educational and technical sandbox result only. It is not official software, not an official ViDA determination, not legal advice, not tax advice, not accounting advice, not authority submission, not filing software, and not a compliance guarantee. Before issuing real invoices or making VAT decisions, consult a qualified accountant, tax adviser, or competent authority.";

export const VIDA_EFFECTIVE_DATE_CONTEXT =
  "Digital Reporting Requirements are represented here as source-linked ViDA readiness context for cross-border EU B2B planning, including the European Commission's 1 July 2030 DRR milestone. This simulation does not decide legal obligations, official reporting duties, or authority acceptance.";

export type VidaBuyerType =
  | "business"
  | "consumer"
  | "public_authority"
  | "unknown";

export type VidaSellerType = "business" | "public_authority" | "unknown";

export type VidaTransactionType =
  | "goods"
  | "services"
  | "digital_service"
  | "mixed"
  | "unknown";

export type VidaSupplyScenario = "domestic" | "intra_eu" | "non_eu" | "unknown";

export type VidaInvoiceProfile = "EN16931" | "PEPPOL_BIS_3" | "COUNTRY_PACK";

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

export type VidaReadinessStatus =
  | "ready_for_technical_review"
  | "needs_more_invoice_data"
  | "needs_vat_evidence"
  | "needs_country_review"
  | "not_relevant"
  | "professional_review_required";

export type VidaFindingSeverity =
  | "info"
  | "warning"
  | "review_required"
  | "blocked";

export type VidaFindingCategory =
  | "VIDA_SIMULATION"
  | "VAT_ID"
  | "VIES"
  | "COUNTRY_PACK"
  | "STRUCTURED_INVOICE"
  | "UBL"
  | "CII"
  | "XSD"
  | "SCHEMATRON"
  | "LEGAL_LABEL";

export type VidaLegalConfidence = CountryPackLegalConfidence;

export type VidaTechnicalCheckStatus =
  | "passed"
  | "failed"
  | "warning"
  | "not_configured"
  | "not_checked"
  | "unavailable"
  | "unknown";

export type VidaVatFormatEvidenceStatus =
  | "valid"
  | "invalid"
  | "not_checked"
  | "unknown";

export type VidaViesEvidenceStatus =
  | "valid"
  | "invalid"
  | "unavailable"
  | "not_checked"
  | "unknown";

export type VidaStructuredInvoiceSignals = {
  hasCanonicalInvoice?: boolean | undefined;
  hasUblXml?: boolean | undefined;
  hasCiiXml?: boolean | undefined;
  xsdStatus?: VidaTechnicalCheckStatus | undefined;
  xsdUblStatus?: VidaTechnicalCheckStatus | undefined;
  xsdCiiStatus?: VidaTechnicalCheckStatus | undefined;
  schematronPeppolStatus?: VidaTechnicalCheckStatus | undefined;
  schematronEn16931Status?: VidaTechnicalCheckStatus | undefined;
  validationSummary?:
    | {
        status?: string | undefined;
        totalFindings?: number | undefined;
        blockedCount?: number | undefined;
        fatalCount?: number | undefined;
        warningCount?: number | undefined;
        infoCount?: number | undefined;
      }
    | undefined;
};

export type VidaVatEvidenceInput = {
  sellerFormatStatus?: VidaVatFormatEvidenceStatus | undefined;
  buyerFormatStatus?: VidaVatFormatEvidenceStatus | undefined;
  buyerViesStatus?: VidaViesEvidenceStatus | undefined;
  sellerViesStatus?: VidaViesEvidenceStatus | undefined;
  checkedAt?: string | undefined;
  sourceLabel?: string | undefined;
};

export type VidaCountryPackContextInput = {
  sellerCountryPackVersion?: string | undefined;
  buyerCountryPackVersion?: string | undefined;
  sellerCountryPackStatus?: CountryPackStatus | "unknown" | undefined;
  buyerCountryPackStatus?: CountryPackStatus | "unknown" | undefined;
  sourceCoverageStatus?: CountryPackConfidenceStatus | "unknown" | undefined;
};

export type NormalizedVidaStructuredInvoiceSignals = {
  hasCanonicalInvoice: boolean;
  hasUblXml: boolean;
  hasCiiXml: boolean;
  xsdStatus: VidaTechnicalCheckStatus;
  xsdUblStatus: VidaTechnicalCheckStatus;
  xsdCiiStatus: VidaTechnicalCheckStatus;
  schematronPeppolStatus: VidaTechnicalCheckStatus;
  schematronEn16931Status: VidaTechnicalCheckStatus;
  validationSummary: {
    status: string;
    totalFindings: number;
    blockedCount: number;
    fatalCount: number;
    warningCount: number;
    infoCount: number;
  };
};

export type NormalizedVidaVatEvidence = {
  sellerFormatStatus: VidaVatFormatEvidenceStatus;
  buyerFormatStatus: VidaVatFormatEvidenceStatus;
  buyerViesStatus: VidaViesEvidenceStatus;
  sellerViesStatus: VidaViesEvidenceStatus;
  checkedAt: string;
  sourceLabel: string;
};

export type VidaReadinessSimulationInput = {
  sellerCountry: string;
  buyerCountry: string;
  sellerVatId?: string | undefined;
  buyerVatId?: string | undefined;
  buyerType?: VidaBuyerType | undefined;
  sellerType?: VidaSellerType | undefined;
  transactionType?: VidaTransactionType | undefined;
  supplyScenario?: VidaSupplyScenario | undefined;
  invoiceDate?: string | undefined;
  issueDate?: string | undefined;
  currency?: string | undefined;
  amount?: string | undefined;
  invoiceProfile?: VidaInvoiceProfile | undefined;
  structuredInvoiceSignals?: VidaStructuredInvoiceSignals | undefined;
  vatEvidence?: VidaVatEvidenceInput | undefined;
  countryPackContext?: VidaCountryPackContextInput | undefined;
  countryPackVersions?: Record<string, string> | undefined;
  sourceRefs?: string[] | undefined;
  sourceLabels?: string[] | undefined;
};

export type NormalizedVidaInput = {
  sellerCountryCode: string | null;
  buyerCountryCode: string | null;
  sellerVatCountryCode: string | null;
  buyerVatCountryCode: string | null;
  sellerVatId: string | null;
  buyerVatId: string | null;
  buyerType: VidaBuyerType;
  sellerType: VidaSellerType;
  transactionType: VidaTransactionType;
  supplyScenario: VidaSupplyScenario;
  invoiceDate: string | null;
  issueDate: string | null;
  currency: string | null;
  amount: string | null;
  invoiceProfile: VidaInvoiceProfile | null;
  structuredInvoiceSignals: NormalizedVidaStructuredInvoiceSignals;
  vatEvidence: NormalizedVidaVatEvidence;
  countryPackContext: {
    sellerCountryPackVersion: string | null;
    buyerCountryPackVersion: string | null;
    sellerCountryPackStatus: CountryPackStatus | "unknown";
    buyerCountryPackStatus: CountryPackStatus | "unknown";
    sourceCoverageStatus: CountryPackConfidenceStatus | "unknown";
  };
  countryPackVersions: Record<string, string>;
  sourceRefs: string[];
  sourceLabels: string[];
};

export type VidaCountryContext = {
  sellerInEu: boolean;
  buyerInEu: boolean;
  sameCountry: boolean;
  crossBorderEu: boolean;
  sellerCountryPackStatus: CountryPackStatus | "unknown";
  buyerCountryPackStatus: CountryPackStatus | "unknown";
  sellerCountryPackVersion: string | null;
  buyerCountryPackVersion: string | null;
  sellerCountryPackSourceCoverageStatus: CountryPackConfidenceStatus | "unknown";
  buyerCountryPackSourceCoverageStatus: CountryPackConfidenceStatus | "unknown";
};

export type VidaSourceReference = {
  id: string;
  label: string;
  title?: string;
  publisher?: string;
  url?: string;
  sourceType?: string;
  reviewedAt?: string;
  notes?: string;
};

export type VidaTimelineItem = {
  date: string;
  label: string;
  sourceRefs: string[];
  relevance:
    | "source_context"
    | "readiness_context"
    | "cross_border_b2b_readiness"
    | "country_review_required";
};

export type VidaEvidenceStatus =
  | "present"
  | "missing"
  | "valid"
  | "invalid"
  | "passed"
  | "failed"
  | "not_configured"
  | "not_checked"
  | "unavailable"
  | "unknown";

export type VidaEvidenceSummary = {
  vatFormatEvidence: {
    sellerStatus: VidaVatFormatEvidenceStatus;
    buyerStatus: VidaVatFormatEvidenceStatus;
    sellerNormalizedVatId: string | null;
    buyerNormalizedVatId: string | null;
    sourceLabels: string[];
  };
  viesEvidence: {
    sellerStatus: VidaViesEvidenceStatus;
    buyerStatus: VidaViesEvidenceStatus;
    checkedAt: string | null;
    sourceLabel: string | null;
    note: string;
  };
  structuredInvoiceEvidence: {
    hasCanonicalInvoice: boolean;
    hasUblXml: boolean;
    hasCiiXml: boolean;
    invoiceProfile: VidaInvoiceProfile | null;
    validationSummary: NormalizedVidaStructuredInvoiceSignals["validationSummary"];
  };
  countryPackEvidence: {
    sellerCountryPackVersion: string | null;
    buyerCountryPackVersion: string | null;
    sellerCountryPackStatus: CountryPackStatus | "unknown";
    buyerCountryPackStatus: CountryPackStatus | "unknown";
    sourceCoverageStatus: CountryPackConfidenceStatus | "unknown";
  };
  xmlValidationEvidence: {
    xsdStatus: VidaTechnicalCheckStatus;
    ublXsdStatus: VidaTechnicalCheckStatus;
    ciiXsdStatus: VidaTechnicalCheckStatus;
    note: string;
  };
  schematronEvidence: {
    peppolStatus: VidaTechnicalCheckStatus;
    en16931Status: VidaTechnicalCheckStatus;
    note: string;
  };
};

export type VidaReadinessFinding = {
  code: string;
  severity: VidaFindingSeverity;
  category: VidaFindingCategory;
  message: string;
  fixSuggestion: string;
  sourceLabels: string[];
  sourceRefs: string[];
  legalConfidence: VidaLegalConfidence;
  countryPackVersion?: string;
  countryPackStatus?: CountryPackStatus | "unknown";
  evidenceStatus?: VidaEvidenceStatus;
};

export type VidaReadinessSimulationResult = {
  simulationId?: string;
  simulationVersion: string;
  transactionClass: VidaTransactionClass;
  transactionSimulation: TransactionClassifierResult;
  vidaRelevance: VidaRelevance;
  readinessScore: number | null;
  readinessStatus: VidaReadinessStatus;
  reason: string;
  effectiveDateContext: string;
  timeline: VidaTimelineItem[];
  confidence: VidaLegalConfidence;
  legalConfidence: VidaLegalConfidence;
  countryContext: VidaCountryContext;
  normalizedInput: NormalizedVidaInput;
  evidenceSummary: VidaEvidenceSummary;
  findings: VidaReadinessFinding[];
  recommendedNextActions: string[];
  sourceReferences: VidaSourceReference[];
  disclaimer: string;
};

const PLATFORM_SOURCE_LABEL = "Invoice Lantern ViDA-readiness simulator";
const EU_CORE_SOURCE_LABEL = "EU-core ViDA readiness context";
const VIES_SOURCE_LABEL = "European Commission VIES context";
const VAT_FORMAT_SOURCE_LABEL = "Invoice Lantern local VAT-format rules";
const COUNTRY_PACK_SOURCE_LABEL = "Invoice Lantern country packs";
const TAX_ENGINE_SOURCE_LABEL =
  "Invoice Lantern transaction and reverse-charge simulation";

const VIDA_CORE_SOURCE_REFERENCES: VidaSourceReference[] = [
  {
    id: "invoice-lantern-vida-simulation-boundary",
    label: "Invoice Lantern ViDA simulation boundary",
    title: "Invoice Lantern ViDA-readiness legal boundary",
    publisher: "Invoice Lantern",
    sourceType: "legal_notice",
    reviewedAt: "2026-05-14",
    notes:
      "Internal product boundary for educational, technical, non-official ViDA-readiness simulation output."
  },
  {
    id: "eu-vida-package-context",
    label: "European Commission ViDA package context",
    title: "Adoption of the VAT in the Digital Age package",
    publisher:
      "European Commission Directorate-General for Taxation and Customs Union",
    url: "https://taxation-customs.ec.europa.eu/news/adoption-vat-digital-age-package-2025-03-11_en",
    sourceType: "eu_guidance",
    reviewedAt: "2026-05-14",
    notes:
      "Used for public ViDA milestone context only. Invoice Lantern does not provide official filing, legal advice, or tax advice."
  },
  {
    id: "council-vida-adoption-2025",
    label: "Council of the EU ViDA adoption context",
    title: "Taxation: Council adopts VAT in the digital age package",
    publisher: "Council of the European Union",
    url: "https://www.consilium.europa.eu/en/press/press-releases/2025/03/11/taxation-council-adopts-vat-in-the-digital-age-package/",
    sourceType: "eu_guidance",
    reviewedAt: "2026-05-14",
    notes:
      "Used as public source context for the adopted ViDA package. This simulator does not determine official obligations."
  }
];

const VIDA_TIMELINE: VidaTimelineItem[] = [
  {
    date: "2025-03-11",
    label:
      "ViDA package adoption context. The date is used only as source context for readiness simulation.",
    sourceRefs: ["eu-vida-package-context", "council-vida-adoption-2025"],
    relevance: "source_context"
  },
  {
    date: "2030-07-01",
    label:
      "Digital Reporting Requirements affect cross-border B2B transactions from this milestone in European Commission source context. Invoice Lantern treats this as readiness planning context only.",
    sourceRefs: ["eu-vida-package-context"],
    relevance: "cross_border_b2b_readiness"
  },
  {
    date: "2035-01-01",
    label:
      "Domestic real-time transaction reporting alignment appears in European Commission rollout context. National interpretation remains professional-review required.",
    sourceRefs: ["eu-vida-package-context"],
    relevance: "country_review_required"
  }
];

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

  const countryPackCode = normalizeCountryPackCode(normalized);

  return countryPackCode.length === 2 ? countryPackCode : null;
}

function normalizeVatId(input: string | undefined) {
  const normalized = input ? normalizeVatFormatInput(input) : "";

  return normalized.length > 0 ? normalized : null;
}

function normalizeBuyerType(input: VidaBuyerType | undefined): VidaBuyerType {
  return input ?? "unknown";
}

function normalizeSellerType(input: VidaSellerType | undefined): VidaSellerType {
  return input ?? "business";
}

function normalizeTransactionType(
  input: VidaTransactionType | undefined
): VidaTransactionType {
  return input ?? "unknown";
}

function normalizeSupplyScenario(
  input: VidaSupplyScenario | undefined
): VidaSupplyScenario {
  return input ?? "unknown";
}

function normalizeInvoiceProfile(
  input: VidaInvoiceProfile | undefined
): VidaInvoiceProfile | null {
  return input ?? null;
}

function normalizeCountryPackVersions(
  input: Record<string, string> | undefined
) {
  const normalizedVersions: Record<string, string> = {};

  if (!input) {
    return normalizedVersions;
  }

  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = normalizeCountryCode(rawKey);
    const value = rawValue.trim();

    if (key && value.length > 0) {
      normalizedVersions[key] = value;
    }
  }

  return normalizedVersions;
}

function normalizeStringArray(input: string[] | undefined) {
  if (!input) {
    return [];
  }

  return uniqueStrings(input.map((item) => item.trim()).filter(Boolean));
}

function normalizeStructuredSignals(
  input: VidaStructuredInvoiceSignals | undefined
): NormalizedVidaStructuredInvoiceSignals {
  const genericXsdStatus = input?.xsdStatus ?? "not_checked";

  return {
    hasCanonicalInvoice: input?.hasCanonicalInvoice ?? false,
    hasUblXml: input?.hasUblXml ?? false,
    hasCiiXml: input?.hasCiiXml ?? false,
    xsdStatus: genericXsdStatus,
    xsdUblStatus:
      input?.xsdUblStatus ?? (input?.hasUblXml ? genericXsdStatus : "not_checked"),
    xsdCiiStatus:
      input?.xsdCiiStatus ?? (input?.hasCiiXml ? genericXsdStatus : "not_checked"),
    schematronPeppolStatus: input?.schematronPeppolStatus ?? "not_checked",
    schematronEn16931Status: input?.schematronEn16931Status ?? "not_checked",
    validationSummary: {
      status: input?.validationSummary?.status ?? "not_provided",
      totalFindings: input?.validationSummary?.totalFindings ?? 0,
      blockedCount: input?.validationSummary?.blockedCount ?? 0,
      fatalCount: input?.validationSummary?.fatalCount ?? 0,
      warningCount: input?.validationSummary?.warningCount ?? 0,
      infoCount: input?.validationSummary?.infoCount ?? 0
    }
  };
}

function normalizeVatEvidence(
  input: VidaVatEvidenceInput | undefined
): NormalizedVidaVatEvidence {
  return {
    sellerFormatStatus: input?.sellerFormatStatus ?? "not_checked",
    buyerFormatStatus: input?.buyerFormatStatus ?? "not_checked",
    buyerViesStatus: input?.buyerViesStatus ?? "not_checked",
    sellerViesStatus: input?.sellerViesStatus ?? "not_checked",
    checkedAt: input?.checkedAt ?? "",
    sourceLabel: input?.sourceLabel ?? ""
  };
}

function normalizeCountryPackContext(
  input: VidaCountryPackContextInput | undefined
): NormalizedVidaInput["countryPackContext"] {
  return {
    sellerCountryPackVersion: normalizeText(input?.sellerCountryPackVersion),
    buyerCountryPackVersion: normalizeText(input?.buyerCountryPackVersion),
    sellerCountryPackStatus: input?.sellerCountryPackStatus ?? "unknown",
    buyerCountryPackStatus: input?.buyerCountryPackStatus ?? "unknown",
    sourceCoverageStatus: input?.sourceCoverageStatus ?? "unknown"
  };
}

function inferVatCountryCode(vatId: string | null) {
  if (!vatId || vatId.length < 2) {
    return null;
  }

  const prefix = vatId.slice(0, 2).toUpperCase();
  const countryCode = normalizeCountryCode(prefix);

  return countryCode && isEuMemberStateCountryCode(countryCode)
    ? countryCode
    : prefix;
}

export function normalizeVidaSimulationInput(
  input: VidaReadinessSimulationInput
): NormalizedVidaInput {
  const sellerVatId = normalizeVatId(input.sellerVatId);
  const buyerVatId = normalizeVatId(input.buyerVatId);

  return {
    sellerCountryCode: normalizeCountryCode(input.sellerCountry),
    buyerCountryCode: normalizeCountryCode(input.buyerCountry),
    sellerVatCountryCode: inferVatCountryCode(sellerVatId),
    buyerVatCountryCode: inferVatCountryCode(buyerVatId),
    sellerVatId,
    buyerVatId,
    buyerType: normalizeBuyerType(input.buyerType),
    sellerType: normalizeSellerType(input.sellerType),
    transactionType: normalizeTransactionType(input.transactionType),
    supplyScenario: normalizeSupplyScenario(input.supplyScenario),
    invoiceDate: normalizeText(input.invoiceDate),
    issueDate: normalizeText(input.issueDate),
    currency: normalizeText(input.currency)?.toUpperCase() ?? null,
    amount: normalizeText(input.amount),
    invoiceProfile: normalizeInvoiceProfile(input.invoiceProfile),
    structuredInvoiceSignals: normalizeStructuredSignals(
      input.structuredInvoiceSignals
    ),
    vatEvidence: normalizeVatEvidence(input.vatEvidence),
    countryPackContext: normalizeCountryPackContext(input.countryPackContext),
    countryPackVersions: normalizeCountryPackVersions(input.countryPackVersions),
    sourceRefs: normalizeStringArray(input.sourceRefs),
    sourceLabels: normalizeStringArray(input.sourceLabels)
  };
}

export function isEuMemberStateCountryCode(countryCode: string | null) {
  return Boolean(
    countryCode && getEuMemberStateCountryCodes().includes(countryCode)
  );
}

function getPack(countryCode: string | null) {
  return countryCode ? getCountryPack(countryCode) : null;
}

function getCountryPackStatus(
  pack: CountryPack | null,
  inputStatus: CountryPackStatus | "unknown"
) {
  return pack?.status ?? inputStatus;
}

function getCountryPackVersion(
  countryCode: string | null,
  pack: CountryPack | null,
  inputVersion: string | null,
  countryPackVersions: Record<string, string>
) {
  if (inputVersion) {
    return inputVersion;
  }

  if (countryCode && countryPackVersions[countryCode]) {
    return countryPackVersions[countryCode];
  }

  return pack?.version ?? null;
}

function getSourceCoverageStatus(pack: CountryPack | null) {
  return pack?.sourceCoverageSummary.overall ?? "unknown";
}

export function buildVidaCountryContext(
  input: NormalizedVidaInput
): VidaCountryContext {
  const sellerPack = getPack(input.sellerCountryCode);
  const buyerPack = getPack(input.buyerCountryCode);
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
    crossBorderEu: sellerInEu && buyerInEu && !sameCountry,
    sellerCountryPackStatus: getCountryPackStatus(
      sellerPack,
      input.countryPackContext.sellerCountryPackStatus
    ),
    buyerCountryPackStatus: getCountryPackStatus(
      buyerPack,
      input.countryPackContext.buyerCountryPackStatus
    ),
    sellerCountryPackVersion: getCountryPackVersion(
      input.sellerCountryCode,
      sellerPack,
      input.countryPackContext.sellerCountryPackVersion,
      input.countryPackVersions
    ),
    buyerCountryPackVersion: getCountryPackVersion(
      input.buyerCountryCode,
      buyerPack,
      input.countryPackContext.buyerCountryPackVersion,
      input.countryPackVersions
    ),
    sellerCountryPackSourceCoverageStatus: getSourceCoverageStatus(sellerPack),
    buyerCountryPackSourceCoverageStatus: getSourceCoverageStatus(buyerPack)
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

function isHighRelevanceB2bClass(transactionClass: VidaTransactionClass) {
  return (
    transactionClass === "intra_eu_b2b_goods" ||
    transactionClass === "intra_eu_b2b_service" ||
    transactionClass === "intra_eu_b2b_digital_service" ||
    transactionClass === "intra_eu_b2b_mixed"
  );
}

function getVidaRelevance(
  transactionClass: VidaTransactionClass,
  context: VidaCountryContext
): VidaRelevance {
  if (isHighRelevanceB2bClass(transactionClass)) {
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

  if (
    transactionClass === "non_eu_or_unsupported" &&
    (context.sellerInEu || context.buyerInEu)
  ) {
    return "review_required";
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
    if (context.sellerInEu || context.buyerInEu) {
      return "One party appears to be in an EU Member State and the other party is outside the supported EU context, so professional review is required before using the scenario for readiness planning.";
    }

    return "Neither party is recognized as an EU Member State in the supported country-pack set, so the scenario is not treated as an EU cross-border B2B readiness simulation.";
  }

  if (context.crossBorderEu && input.buyerType === "business") {
    return "Seller and buyer appear to be in different EU Member States and the buyer is marked as a business, so the scenario appears relevant for ViDA-style cross-border B2B readiness planning. This is a readiness signal only, not a legal conclusion.";
  }

  if (transactionClass === "intra_eu_public_authority") {
    return "The transaction appears cross-border within the EU, but the buyer is marked as a public authority. Public procurement, B2G, and national e-invoicing rules require separate professional review.";
  }

  if (transactionClass === "intra_eu_b2c") {
    return "The transaction appears cross-border within the EU, but the buyer is marked as a consumer. This simulator does not treat the scenario as cross-border B2B DRR readiness.";
  }

  if (transactionClass === "domestic_eu_business") {
    return "Seller and buyer appear to be in the same EU Member State. Cross-border B2B readiness is not the main signal, but domestic e-invoicing and national VAT context may still require country-specific professional review.";
  }

  if (transactionClass === "domestic_eu_consumer") {
    return "Seller and buyer appear to be in the same EU Member State and the buyer is marked as a consumer. This is not treated as a cross-border B2B readiness scenario.";
  }

  return "The scenario needs more context before a stronger readiness signal can be shown.";
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function combineSourceRefs(...groups: Array<string[] | undefined>) {
  return uniqueStrings(groups.flatMap((group) => group ?? []));
}

function sourceLabels(...labels: string[]) {
  return uniqueStrings(labels);
}

function finding(input: {
  code: string;
  severity: VidaFindingSeverity;
  category: VidaFindingCategory;
  message: string;
  fixSuggestion: string;
  sourceLabels?: string[];
  sourceRefs?: string[];
  legalConfidence?: VidaLegalConfidence;
  countryPackVersion?: string | null;
  countryPackStatus?: CountryPackStatus | "unknown";
  evidenceStatus?: VidaEvidenceStatus;
}): VidaReadinessFinding {
  const output: VidaReadinessFinding = {
    code: input.code,
    severity: input.severity,
    category: input.category,
    message: input.message,
    fixSuggestion: input.fixSuggestion,
    legalConfidence:
      input.legalConfidence ??
      (input.severity === "review_required" || input.severity === "blocked"
        ? "professional_review_required"
        : "educational_simulation"),
    sourceLabels:
      input.sourceLabels ??
      sourceLabels(PLATFORM_SOURCE_LABEL, EU_CORE_SOURCE_LABEL),
    sourceRefs: input.sourceRefs ?? ["invoice-lantern-vida-simulation-boundary"]
  };

  if (input.countryPackVersion) {
    output.countryPackVersion = input.countryPackVersion;
  }

  if (input.countryPackStatus) {
    output.countryPackStatus = input.countryPackStatus;
  }

  if (input.evidenceStatus) {
    output.evidenceStatus = input.evidenceStatus;
  }

  return output;
}

function buildVatFormatEvidence(
  input: NormalizedVidaInput
): {
  seller: VatFormatResult | null;
  buyer: VatFormatResult | null;
  sellerStatus: VidaVatFormatEvidenceStatus;
  buyerStatus: VidaVatFormatEvidenceStatus;
} {
  const seller =
    input.sellerVatId && input.sellerCountryCode
      ? validateVatFormat(input.sellerVatId, input.sellerCountryCode)
      : null;
  const buyer =
    input.buyerVatId && input.buyerCountryCode
      ? validateVatFormat(input.buyerVatId, input.buyerCountryCode)
      : null;

  return {
    seller,
    buyer,
    sellerStatus:
      input.vatEvidence.sellerFormatStatus !== "not_checked"
        ? input.vatEvidence.sellerFormatStatus
        : toFormatStatus(seller),
    buyerStatus:
      input.vatEvidence.buyerFormatStatus !== "not_checked"
        ? input.vatEvidence.buyerFormatStatus
        : toFormatStatus(buyer)
  };
}

function toFormatStatus(
  result: VatFormatResult | null
): VidaVatFormatEvidenceStatus {
  if (!result) {
    return "not_checked";
  }

  return result.formatValid ? "valid" : "invalid";
}

function toTaxEngineBuyerType(input: VidaBuyerType): TaxEngineBuyerType {
  if (
    input === "business" ||
    input === "consumer" ||
    input === "public_authority"
  ) {
    return input;
  }

  return "unknown";
}

function toTaxEngineTransactionType(
  input: VidaTransactionType
): TaxEngineTransactionType {
  if (input === "digital_service") {
    return "digital_services";
  }

  if (
    input === "goods" ||
    input === "services" ||
    input === "mixed" ||
    input === "unknown"
  ) {
    return input;
  }

  return "unknown";
}

function toTaxEngineViesStatus(
  input: VidaViesEvidenceStatus
): TaxEngineViesEvidenceStatus {
  if (
    input === "valid" ||
    input === "invalid" ||
    input === "unavailable" ||
    input === "not_checked" ||
    input === "unknown"
  ) {
    return input;
  }

  return "not_checked";
}

function buildTaxEngineCountryPackStatuses(
  context: VidaCountryContext,
  input: NormalizedVidaInput
) {
  const statuses: Record<string, string> = {};

  if (input.sellerCountryCode) {
    statuses[input.sellerCountryCode] = context.sellerCountryPackStatus;
  }

  if (input.buyerCountryCode) {
    statuses[input.buyerCountryCode] = context.buyerCountryPackStatus;
  }

  return statuses;
}

function sanitizeText(value: string) {
  return value
    .replace(/\bsuccessful\b/gi, "passing")
    .replace(/\bsuccessfully\b/gi, "with a passing result");
}

function sanitizeStringArray(values: string[]) {
  return values.map(sanitizeText);
}

function sanitizeTaxEngineTransactionSimulation(
  result: TransactionClassifierResult
): TransactionClassifierResult {
  return {
    ...result,
    reverseChargeSimulation: {
      ...result.reverseChargeSimulation,
      message: sanitizeText(result.reverseChargeSimulation.message),
      warnings: sanitizeStringArray(result.reverseChargeSimulation.warnings)
    },
    vatIdEvidence: {
      ...result.vatIdEvidence,
      warnings: sanitizeStringArray(result.vatIdEvidence.warnings)
    },
    structuredInvoiceEvidence: {
      ...result.structuredInvoiceEvidence,
      warnings: sanitizeStringArray(result.structuredInvoiceEvidence.warnings)
    },
    countryPackContext: {
      ...result.countryPackContext,
      ruleVersions: { ...result.countryPackContext.ruleVersions },
      sourceRefs: [...result.countryPackContext.sourceRefs]
    },
    findings: result.findings.map((findingItem) => ({
      ...findingItem,
      message: sanitizeText(findingItem.message),
      fixSuggestion: sanitizeText(findingItem.fixSuggestion),
      sourceRefIds: [...findingItem.sourceRefIds]
    })),
    disclaimers: sanitizeStringArray(result.disclaimers),
    disclaimer: sanitizeText(result.disclaimer)
  };
}

function buildTaxEngineTransactionSimulation(
  input: NormalizedVidaInput,
  context: VidaCountryContext
): TransactionClassifierResult {
  const classifierInput: TaxEngineTransactionClassifierInput = {
    buyerType: toTaxEngineBuyerType(input.buyerType),
    transactionType: toTaxEngineTransactionType(input.transactionType),
    buyerViesStatus: toTaxEngineViesStatus(input.vatEvidence.buyerViesStatus),
    sellerViesStatus: toTaxEngineViesStatus(input.vatEvidence.sellerViesStatus),
    countryPackVersions: input.countryPackVersions,
    countryPackStatuses: buildTaxEngineCountryPackStatuses(context, input),
    structuredInvoiceSignals: {
      hasCanonicalInvoice: input.structuredInvoiceSignals.hasCanonicalInvoice,
      hasUblXml: input.structuredInvoiceSignals.hasUblXml,
      hasCiiXml: input.structuredInvoiceSignals.hasCiiXml,
      xsdUblStatus: input.structuredInvoiceSignals.xsdUblStatus,
      xsdCiiStatus: input.structuredInvoiceSignals.xsdCiiStatus,
      schematronPeppolStatus:
        input.structuredInvoiceSignals.schematronPeppolStatus,
      schematronEn16931Status:
        input.structuredInvoiceSignals.schematronEn16931Status
    }
  };

  if (input.sellerCountryCode) {
    classifierInput.sellerCountry = input.sellerCountryCode;
    classifierInput.sellerVatCountry = input.sellerCountryCode;
  }

  if (input.buyerCountryCode) {
    classifierInput.buyerCountry = input.buyerCountryCode;
    classifierInput.buyerVatCountry = input.buyerCountryCode;
  }

  if (input.sellerVatId) {
    classifierInput.sellerVatId = input.sellerVatId;
  }

  if (input.buyerVatId) {
    classifierInput.buyerVatId = input.buyerVatId;
  }

  const invoiceDate = input.invoiceDate ?? input.issueDate;

  if (invoiceDate) {
    classifierInput.invoiceDate = invoiceDate;
  }

  if (input.currency) {
    classifierInput.currency = input.currency;
  }

  if (input.amount) {
    classifierInput.amount = input.amount;
  }

  return sanitizeTaxEngineTransactionSimulation(
    classifyTransaction(classifierInput)
  );
}

function buildEvidenceSummary(
  input: NormalizedVidaInput,
  context: VidaCountryContext,
  vatFormatEvidence: ReturnType<typeof buildVatFormatEvidence>
): VidaEvidenceSummary {
  const sourceCoverageStatus =
    context.sellerCountryPackSourceCoverageStatus ===
    context.buyerCountryPackSourceCoverageStatus
      ? context.sellerCountryPackSourceCoverageStatus
      : "professional_review_required";

  return {
    vatFormatEvidence: {
      sellerStatus: vatFormatEvidence.sellerStatus,
      buyerStatus: vatFormatEvidence.buyerStatus,
      sellerNormalizedVatId: vatFormatEvidence.seller?.normalized ?? null,
      buyerNormalizedVatId: vatFormatEvidence.buyer?.normalized ?? null,
      sourceLabels: sourceLabels(VAT_FORMAT_SOURCE_LABEL)
    },
    viesEvidence: {
      sellerStatus: input.vatEvidence.sellerViesStatus,
      buyerStatus: input.vatEvidence.buyerViesStatus,
      checkedAt: normalizeText(input.vatEvidence.checkedAt),
      sourceLabel: normalizeText(input.vatEvidence.sourceLabel),
      note:
        "VIES evidence is time-of-check evidence only. Format-valid is not VIES-valid, and VIES unavailable is not treated as invalid."
    },
    structuredInvoiceEvidence: {
      hasCanonicalInvoice: input.structuredInvoiceSignals.hasCanonicalInvoice,
      hasUblXml: input.structuredInvoiceSignals.hasUblXml,
      hasCiiXml: input.structuredInvoiceSignals.hasCiiXml,
      invoiceProfile: input.invoiceProfile,
      validationSummary: input.structuredInvoiceSignals.validationSummary
    },
    countryPackEvidence: {
      sellerCountryPackVersion: context.sellerCountryPackVersion,
      buyerCountryPackVersion: context.buyerCountryPackVersion,
      sellerCountryPackStatus: context.sellerCountryPackStatus,
      buyerCountryPackStatus: context.buyerCountryPackStatus,
      sourceCoverageStatus
    },
    xmlValidationEvidence: {
      xsdStatus: input.structuredInvoiceSignals.xsdStatus,
      ublXsdStatus: input.structuredInvoiceSignals.xsdUblStatus,
      ciiXsdStatus: input.structuredInvoiceSignals.xsdCiiStatus,
      note:
        "XSD evidence is technical XML validation context only. Passing XSD does not prove legal, tax, accounting, filing, Peppol, EN 16931, CII syntax-binding, or authority acceptance."
    },
    schematronEvidence: {
      peppolStatus: input.structuredInvoiceSignals.schematronPeppolStatus,
      en16931Status: input.structuredInvoiceSignals.schematronEn16931Status,
      note:
        "Schematron evidence is technical rule-check context only. Passed or not-configured states must not be treated as official certification or compliance."
    }
  };
}

function addCountryPackFindings(
  findings: VidaReadinessFinding[],
  input: NormalizedVidaInput,
  context: VidaCountryContext
) {
  const countryEntries = [
    {
      role: "seller",
      countryCode: input.sellerCountryCode,
      status: context.sellerCountryPackStatus,
      version: context.sellerCountryPackVersion,
      coverage: context.sellerCountryPackSourceCoverageStatus
    },
    {
      role: "buyer",
      countryCode: input.buyerCountryCode,
      status: context.buyerCountryPackStatus,
      version: context.buyerCountryPackVersion,
      coverage: context.buyerCountryPackSourceCoverageStatus
    }
  ] as const;

  for (const entry of countryEntries) {
    if (!entry.countryCode || !isEuMemberStateCountryCode(entry.countryCode)) {
      continue;
    }

    if (entry.status !== "reviewed" || entry.coverage !== "reviewed") {
      findings.push(
        finding({
          code: `VIDA_${entry.role.toUpperCase()}_COUNTRY_PACK_REVIEW_REQUIRED`,
          severity: "warning",
          category: "COUNTRY_PACK",
          message: `${entry.role} country pack ${entry.countryCode} is source-linked, but its status or source coverage requires professional review before real-world reliance.`,
          fixSuggestion:
            "Review the country-pack source metadata, national implementation facts, and professional advice before using this readiness signal.",
          sourceLabels: sourceLabels(COUNTRY_PACK_SOURCE_LABEL),
          sourceRefs: ["invoice-lantern-country-pack-legal-notice"],
          legalConfidence: "professional_review_required",
          countryPackVersion: entry.version,
          countryPackStatus: entry.status,
          evidenceStatus: entry.coverage === "unknown" ? "unknown" : "present"
        })
      );
    }
  }

  if (input.sellerCountryCode === "GR" || input.buyerCountryCode === "GR") {
    findings.push(
      finding({
        code: "VIDA_GR_EL_VAT_PREFIX_COMPATIBILITY",
        severity: "info",
        category: "VAT_ID",
        message:
          "Greece is represented as country code GR in country packs, while VAT ID prefix compatibility may use EL for local VAT-format checks.",
        fixSuggestion:
          "Use GR for user-facing country selection and accept EL-prefixed Greek VAT IDs where local VAT-format evidence is needed.",
        sourceLabels: sourceLabels(
          COUNTRY_PACK_SOURCE_LABEL,
          VAT_FORMAT_SOURCE_LABEL
        ),
        sourceRefs: ["eu-vat-identification-numbers"],
        legalConfidence: "technical",
        evidenceStatus: "present"
      })
    );
  }
}

function addVatFindings(
  findings: VidaReadinessFinding[],
  input: NormalizedVidaInput,
  context: VidaCountryContext,
  transactionClass: VidaTransactionClass,
  vatFormatEvidence: ReturnType<typeof buildVatFormatEvidence>
) {
  if (
    context.crossBorderEu &&
    input.buyerType === "business" &&
    !input.buyerVatId
  ) {
    findings.push(
      finding({
        code: "VIDA_BUYER_VAT_ID_CONTEXT_MISSING",
        severity: "warning",
        category: "VAT_ID",
        message:
          "The buyer is marked as a business in a cross-border EU scenario, but no buyer VAT ID was provided.",
        fixSuggestion:
          "Add the buyer VAT ID and run local VAT-format and VIES-evidence checks where appropriate.",
        sourceLabels: sourceLabels(VAT_FORMAT_SOURCE_LABEL, VIES_SOURCE_LABEL),
        sourceRefs: ["eu-vies-vat-information-exchange-system"],
        evidenceStatus: "missing"
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
        category: "VAT_ID",
        message:
          "The seller is in a cross-border EU business scenario, but no seller VAT ID was provided.",
        fixSuggestion:
          "Add the seller VAT ID to improve readiness classification and audit context.",
        sourceLabels: sourceLabels(VAT_FORMAT_SOURCE_LABEL, VIES_SOURCE_LABEL),
        sourceRefs: ["eu-vies-vat-information-exchange-system"],
        evidenceStatus: "missing"
      })
    );
  }

  if (vatFormatEvidence.sellerStatus === "invalid") {
    findings.push(
      finding({
        code: "VIDA_SELLER_VAT_FORMAT_INVALID",
        severity: "warning",
        category: "VAT_ID",
        message:
          "Seller VAT ID local format evidence did not pass. This is a technical pattern signal only.",
        fixSuggestion:
          "Check the seller VAT ID prefix and local format before using it as readiness evidence.",
        sourceLabels: sourceLabels(VAT_FORMAT_SOURCE_LABEL),
        sourceRefs: ["eu-vat-identification-numbers"],
        legalConfidence: "technical",
        evidenceStatus: "invalid"
      })
    );
  }

  if (vatFormatEvidence.buyerStatus === "invalid") {
    findings.push(
      finding({
        code: "VIDA_BUYER_VAT_FORMAT_INVALID",
        severity: "warning",
        category: "VAT_ID",
        message:
          "Buyer VAT ID local format evidence did not pass. This is a technical pattern signal only.",
        fixSuggestion:
          "Check the buyer VAT ID prefix and local format before using it as readiness evidence.",
        sourceLabels: sourceLabels(VAT_FORMAT_SOURCE_LABEL),
        sourceRefs: ["eu-vat-identification-numbers"],
        legalConfidence: "technical",
        evidenceStatus: "invalid"
      })
    );
  }

  if (isHighRelevanceB2bClass(transactionClass)) {
    if (input.vatEvidence.buyerViesStatus === "not_checked") {
      findings.push(
        finding({
          code: "VIDA_BUYER_VIES_EVIDENCE_MISSING",
          severity: "warning",
          category: "VIES",
          message:
            "No buyer VIES evidence was supplied for a likely cross-border EU B2B readiness scenario.",
          fixSuggestion:
            "Attach cached or explicit VIES evidence when policy allows. Do not treat local VAT-format evidence as VIES evidence.",
          sourceLabels: sourceLabels(VIES_SOURCE_LABEL),
          sourceRefs: ["eu-vies-vat-information-exchange-system"],
          evidenceStatus: "missing"
        })
      );
    }

    if (input.vatEvidence.sellerViesStatus === "not_checked") {
      findings.push(
        finding({
          code: "VIDA_SELLER_VIES_EVIDENCE_MISSING",
          severity: "warning",
          category: "VIES",
          message:
            "No seller VIES evidence was supplied for a likely cross-border EU B2B readiness scenario.",
          fixSuggestion:
            "Attach cached or explicit VIES evidence when policy allows. VIES evidence remains time-of-check evidence only.",
          sourceLabels: sourceLabels(VIES_SOURCE_LABEL),
          sourceRefs: ["eu-vies-vat-information-exchange-system"],
          evidenceStatus: "missing"
        })
      );
    }
  }

  for (const [role, status] of [
    ["seller", input.vatEvidence.sellerViesStatus],
    ["buyer", input.vatEvidence.buyerViesStatus]
  ] as const) {
    if (status === "unavailable") {
      findings.push(
        finding({
          code: `VIDA_${role.toUpperCase()}_VIES_UNAVAILABLE`,
          severity: "warning",
          category: "VIES",
          message: `${role} VIES evidence was unavailable. Invoice Lantern does not treat VIES unavailable as invalid.`,
          fixSuggestion:
            "Keep the unavailable evidence state with timestamp/source label and retry or review through an appropriate professional process.",
          sourceLabels: sourceLabels(VIES_SOURCE_LABEL),
          sourceRefs: ["eu-vies-vat-information-exchange-system"],
          evidenceStatus: "unavailable"
        })
      );
    }

    if (status === "valid") {
      findings.push(
        finding({
          code: `VIDA_${role.toUpperCase()}_VIES_VALID_EVIDENCE_ONLY`,
          severity: "info",
          category: "VIES",
          message: `${role} VIES status was supplied as valid. This is evidence only and does not prove transaction compliance, tax treatment, or authority acceptance.`,
          fixSuggestion:
            "Keep the time-of-check VIES evidence alongside invoice validation results and professional review notes.",
          sourceLabels: sourceLabels(VIES_SOURCE_LABEL),
          sourceRefs: ["eu-vies-vat-information-exchange-system"],
          evidenceStatus: "valid"
        })
      );
    }

    if (status === "invalid") {
      findings.push(
        finding({
          code: `VIDA_${role.toUpperCase()}_VIES_INVALID_EVIDENCE`,
          severity: "warning",
          category: "VIES",
          message: `${role} VIES status was supplied as invalid. The simulator records this as evidence context, not as a final legal conclusion.`,
          fixSuggestion:
            "Review the VAT ID, timestamp, party facts, and professional advice before relying on the transaction readiness signal.",
          sourceLabels: sourceLabels(VIES_SOURCE_LABEL),
          sourceRefs: ["eu-vies-vat-information-exchange-system"],
          evidenceStatus: "invalid",
          legalConfidence: "professional_review_required"
        })
      );
    }
  }
}

function addStructuredEvidenceFindings(
  findings: VidaReadinessFinding[],
  input: NormalizedVidaInput
) {
  const signals = input.structuredInvoiceSignals;

  if (!signals.hasCanonicalInvoice) {
    findings.push(
      finding({
        code: "VIDA_CANONICAL_INVOICE_EVIDENCE_MISSING",
        severity: "warning",
        category: "STRUCTURED_INVOICE",
        message:
          "No canonical invoice evidence was supplied. Invoice Lantern treats canonical structured data as the validation basis.",
        fixSuggestion:
          "Normalize the invoice through the canonical invoice model before interpreting ViDA-readiness output.",
        sourceLabels: sourceLabels(PLATFORM_SOURCE_LABEL),
        evidenceStatus: "missing",
        legalConfidence: "technical"
      })
    );
  }

  if (!signals.hasUblXml && !signals.hasCiiXml) {
    findings.push(
      finding({
        code: "VIDA_STRUCTURED_XML_EVIDENCE_MISSING",
        severity: "warning",
        category: "STRUCTURED_INVOICE",
        message:
          "No UBL or CII XML evidence was supplied. Structured XML evidence improves technical readiness but is not legal or filing proof.",
        fixSuggestion:
          "Generate or import UBL or CII XML and validate it through configured technical checks where applicable.",
        sourceLabels: sourceLabels(PLATFORM_SOURCE_LABEL),
        evidenceStatus: "missing",
        legalConfidence: "technical"
      })
    );
  }

  if (signals.hasCiiXml) {
    findings.push(
      finding({
        code: "VIDA_CII_XML_EVIDENCE_PRESENT",
        severity: "info",
        category: "CII",
        message:
          "CII XML evidence is present. Invoice Lantern treats CII as a structured syntax-binding evidence signal, not official filing or authority acceptance.",
        fixSuggestion:
          "Keep CII parsing, export, XSD status, validation run ID, and report evidence together for technical review.",
        sourceLabels: sourceLabels(PLATFORM_SOURCE_LABEL),
        evidenceStatus: "present",
        legalConfidence: "technical"
      })
    );
  }

  if (signals.hasUblXml) {
    findings.push(
      finding({
        code: "VIDA_UBL_XML_EVIDENCE_PRESENT",
        severity: "info",
        category: "UBL",
        message:
          "UBL XML evidence is present. Invoice Lantern treats UBL as a structured syntax-binding evidence signal, not official filing or authority acceptance.",
        fixSuggestion:
          "Keep UBL parsing, export, XSD status, validation run ID, and report evidence together for technical review.",
        sourceLabels: sourceLabels(PLATFORM_SOURCE_LABEL),
        evidenceStatus: "present",
        legalConfidence: "technical"
      })
    );
  }

  for (const [code, label, category, status] of [
    [
      "VIDA_XSD_FAILED",
      "Generic XML XSD",
      "XSD",
      signals.xsdStatus
    ],
    [
      "VIDA_UBL_XSD_FAILED",
      "UBL XSD",
      "UBL",
      signals.xsdUblStatus
    ],
    [
      "VIDA_CII_XSD_FAILED",
      "CII XSD",
      "CII",
      signals.xsdCiiStatus
    ]
  ] as const) {
    if (status === "failed") {
      findings.push(
        finding({
          code,
          severity: "warning",
          category,
          message: `${label} validation evidence failed. This lowers technical readiness but is not an official legal determination.`,
          fixSuggestion:
            "Correct XML schema errors and rerun local XSD validation before using the readiness signal.",
          sourceLabels: sourceLabels(PLATFORM_SOURCE_LABEL),
          evidenceStatus: "failed",
          legalConfidence: "technical"
        })
      );
    }
  }

  for (const [code, label, category, status] of [
    [
      "VIDA_XSD_NOT_CONFIGURED",
      "Generic XML XSD",
      "XSD",
      signals.xsdStatus
    ],
    [
      "VIDA_UBL_XSD_NOT_CONFIGURED",
      "UBL XSD",
      "UBL",
      signals.xsdUblStatus
    ],
    [
      "VIDA_CII_XSD_NOT_CONFIGURED",
      "CII XSD",
      "CII",
      signals.xsdCiiStatus
    ]
  ] as const) {
    if (status === "not_configured") {
      findings.push(
        finding({
          code,
          severity: "warning",
          category,
          message: `${label} validation is not configured. Not configured is not treated as a passed XML check.`,
          fixSuggestion:
            "Configure the local XSD worker path and rerun XML validation where structured XML is used.",
          sourceLabels: sourceLabels(PLATFORM_SOURCE_LABEL),
          evidenceStatus: "not_configured",
          legalConfidence: "technical"
        })
      );
    }
  }

  for (const [code, label, status] of [
    [
      "VIDA_SCHEMATRON_PEPPOL_FAILED",
      "Peppol-style Schematron",
      signals.schematronPeppolStatus
    ],
    [
      "VIDA_SCHEMATRON_EN16931_FAILED",
      "EN 16931-style Schematron",
      signals.schematronEn16931Status
    ]
  ] as const) {
    if (status === "failed") {
      findings.push(
        finding({
          code,
          severity: "warning",
          category: "SCHEMATRON",
          message: `${label} evidence failed. This is a technical readiness warning only.`,
          fixSuggestion:
            "Review structured invoice rules and rerun Schematron where configured.",
          sourceLabels: sourceLabels(PLATFORM_SOURCE_LABEL),
          evidenceStatus: "failed",
          legalConfidence: "technical"
        })
      );
    }
  }

  for (const [code, label, status] of [
    [
      "VIDA_SCHEMATRON_PEPPOL_NOT_CONFIGURED",
      "Peppol-style Schematron",
      signals.schematronPeppolStatus
    ],
    [
      "VIDA_SCHEMATRON_EN16931_NOT_CONFIGURED",
      "EN 16931-style Schematron",
      signals.schematronEn16931Status
    ]
  ] as const) {
    if (status === "not_configured") {
      findings.push(
        finding({
          code,
          severity: "warning",
          category: "SCHEMATRON",
          message: `${label} is not configured. Not configured is not treated as a passed rule check.`,
          fixSuggestion:
            "Configure guarded local Schematron execution where this evidence is needed.",
          sourceLabels: sourceLabels(PLATFORM_SOURCE_LABEL),
          evidenceStatus: "not_configured",
          legalConfidence: "technical"
        })
      );
    }
  }
}

function addTaxEngineTransactionFindings(
  findings: VidaReadinessFinding[],
  transactionSimulation: TransactionClassifierResult
) {
  if (
    transactionSimulation.reverseChargeSimulation.relevance === "possible" ||
    transactionSimulation.reverseChargeSimulation.relevance === "needs_review"
  ) {
    findings.push(
      finding({
        code: "VIDA_REVERSE_CHARGE_REVIEW_CONTEXT",
        severity: "warning",
        category: "LEGAL_LABEL",
        message:
          "The tax-engine transaction simulation detected a possible or review-required reverse-charge context. This is not tax advice.",
        fixSuggestion:
          "Review buyer status, VAT evidence, transaction type, place-of-supply facts, invoice wording, country rules, and professional advice before real-world reliance.",
        sourceLabels: sourceLabels(TAX_ENGINE_SOURCE_LABEL),
        sourceRefs: [
          "invoice-lantern-country-pack-legal-notice",
          "eu-vat-country-specific-information",
          "eu-vies-vat-information-exchange-system"
        ],
        legalConfidence: "professional_review_required",
        evidenceStatus: "present"
      })
    );
  }

  if (transactionSimulation.vatIdEvidence.buyerViesStatus === "unavailable") {
    findings.push(
      finding({
        code: "VIDA_TAX_ENGINE_BUYER_VIES_UNAVAILABLE_CONTEXT",
        severity: "warning",
        category: "VIES",
        message:
          "The tax-engine transaction simulation reports buyer VIES evidence as unavailable. Unavailable is not invalid.",
        fixSuggestion:
          "Preserve the unavailable state and retry or review through an appropriate professional process.",
        sourceLabels: sourceLabels(TAX_ENGINE_SOURCE_LABEL, VIES_SOURCE_LABEL),
        sourceRefs: ["eu-vies-vat-information-exchange-system"],
        legalConfidence: "educational_simulation",
        evidenceStatus: "unavailable"
      })
    );
  }

  if (transactionSimulation.vatIdEvidence.sellerViesStatus === "unavailable") {
    findings.push(
      finding({
        code: "VIDA_TAX_ENGINE_SELLER_VIES_UNAVAILABLE_CONTEXT",
        severity: "warning",
        category: "VIES",
        message:
          "The tax-engine transaction simulation reports seller VIES evidence as unavailable. Unavailable is not invalid.",
        fixSuggestion:
          "Preserve the unavailable state and retry or review through an appropriate professional process.",
        sourceLabels: sourceLabels(TAX_ENGINE_SOURCE_LABEL, VIES_SOURCE_LABEL),
        sourceRefs: ["eu-vies-vat-information-exchange-system"],
        legalConfidence: "educational_simulation",
        evidenceStatus: "unavailable"
      })
    );
  }
}

function buildFindings(
  input: NormalizedVidaInput,
  context: VidaCountryContext,
  transactionClass: VidaTransactionClass,
  vidaRelevance: VidaRelevance,
  vatFormatEvidence: ReturnType<typeof buildVatFormatEvidence>,
  transactionSimulation: TransactionClassifierResult
) {
  const findings: VidaReadinessFinding[] = [];

  if (!input.sellerCountryCode) {
    findings.push(
      finding({
        code: "VIDA_SELLER_COUNTRY_REQUIRED",
        severity: "blocked",
        category: "VIDA_SIMULATION",
        message:
          "Seller country is required for the ViDA-readiness simulation.",
        fixSuggestion:
          "Provide the seller country as a two-letter country code before using the readiness result.",
        evidenceStatus: "missing"
      })
    );
  }

  if (!input.buyerCountryCode) {
    findings.push(
      finding({
        code: "VIDA_BUYER_COUNTRY_REQUIRED",
        severity: "blocked",
        category: "VIDA_SIMULATION",
        message: "Buyer country is required for the ViDA-readiness simulation.",
        fixSuggestion:
          "Provide the buyer country as a two-letter country code before using the readiness result.",
        evidenceStatus: "missing"
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
        severity: context.sellerInEu || context.buyerInEu ? "review_required" : "warning",
        category: "VIDA_SIMULATION",
        message:
          "At least one party is not in the supported EU Member State set for this simulator.",
        fixSuggestion:
          "Use country-specific professional review for non-EU or unsupported country scenarios.",
        legalConfidence:
          context.sellerInEu || context.buyerInEu
            ? "professional_review_required"
            : "educational_simulation"
      })
    );
  }

  if (context.crossBorderEu && input.buyerType === "unknown") {
    findings.push(
      finding({
        code: "VIDA_BUYER_TYPE_REVIEW_REQUIRED",
        severity: "review_required",
        category: "VIDA_SIMULATION",
        message:
          "The transaction appears cross-border within the EU, but the buyer type is unknown.",
        fixSuggestion:
          "Confirm whether the buyer is a business, consumer, or public authority before interpreting the readiness signal.",
        legalConfidence: "professional_review_required"
      })
    );
  }

  if (isHighRelevanceB2bClass(transactionClass)) {
    findings.push(
      finding({
        code: "VIDA_INTRA_EU_B2B_RELEVANCE_SIGNAL",
        severity: "info",
        category: "VIDA_SIMULATION",
        message:
          "This scenario appears relevant for ViDA-style cross-border B2B readiness planning.",
        fixSuggestion:
          "Validate invoice structure, VAT IDs, XML evidence, country-pack context, and professional-review requirements before real-world use.",
        sourceRefs: ["eu-vida-package-context", "council-vida-adoption-2025"]
      })
    );
  }

  if (transactionClass === "intra_eu_b2c") {
    findings.push(
      finding({
        code: "VIDA_B2C_NOT_CROSS_BORDER_B2B_DRR",
        severity: "info",
        category: "VIDA_SIMULATION",
        message:
          "The buyer is marked as consumer, so the scenario is not treated as cross-border B2B DRR readiness.",
        fixSuggestion:
          "Review consumer VAT and place-of-supply facts separately where relevant.",
        legalConfidence: "professional_review_required"
      })
    );
  }

  if (transactionClass === "intra_eu_public_authority") {
    findings.push(
      finding({
        code: "VIDA_PUBLIC_AUTHORITY_REVIEW_REQUIRED",
        severity: "review_required",
        category: "VIDA_SIMULATION",
        message:
          "The buyer is marked as a public authority. B2G, procurement, national e-invoicing, and public-sector rules require separate review.",
        fixSuggestion:
          "Review public-procurement and country-specific e-invoicing requirements with a qualified professional.",
        legalConfidence: "professional_review_required"
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
        category: "COUNTRY_PACK",
        message:
          "This appears to be a domestic EU scenario. Domestic e-invoicing and VAT requirements depend on the relevant country rules.",
        fixSuggestion:
          "Use the applicable country pack and professional review for domestic e-invoicing and VAT obligations.",
        sourceLabels: sourceLabels(COUNTRY_PACK_SOURCE_LABEL),
        sourceRefs: ["eu-einvoicing-country-factsheets"],
        legalConfidence: "professional_review_required"
      })
    );
  }

  addTaxEngineTransactionFindings(findings, transactionSimulation);
  addVatFindings(findings, input, context, transactionClass, vatFormatEvidence);
  addStructuredEvidenceFindings(findings, input);
  addCountryPackFindings(findings, input, context);

  if (vidaRelevance === "review_required") {
    findings.push(
      finding({
        code: "VIDA_PROFESSIONAL_REVIEW_REQUIRED",
        severity: "review_required",
        category: "LEGAL_LABEL",
        message:
          "The simulation cannot safely provide a stronger readiness signal without additional factual, country, or professional context.",
        fixSuggestion:
          "Review buyer status, transaction type, VAT IDs, place-of-supply facts, country rules, and professional advice.",
        legalConfidence: "professional_review_required"
      })
    );
  }

  return findings;
}

function scoreBase(transactionClass: VidaTransactionClass, relevance: VidaRelevance) {
  if (transactionClass === "insufficient_data") {
    return null;
  }

  if (relevance === "not_relevant") {
    return 35;
  }

  if (isHighRelevanceB2bClass(transactionClass)) {
    return 76;
  }

  if (relevance === "review_required") {
    return 48;
  }

  if (relevance === "medium") {
    return 58;
  }

  return 45;
}

function scorePenalty(findingItem: VidaReadinessFinding) {
  if (findingItem.severity === "blocked") {
    return 35;
  }

  if (findingItem.code.includes("FORMAT_INVALID")) {
    return 14;
  }

  if (findingItem.code.includes("XSD_FAILED")) {
    return 16;
  }

  if (
    findingItem.code.includes("SCHEMATRON") &&
    findingItem.code.includes("FAILED")
  ) {
    return 12;
  }

  if (findingItem.code.includes("NOT_CONFIGURED")) {
    return 8;
  }

  if (findingItem.code.includes("VIES_UNAVAILABLE")) {
    return 3;
  }

  if (findingItem.code.includes("VIES_INVALID")) {
    return 14;
  }

  if (findingItem.category === "COUNTRY_PACK") {
    return 8;
  }

  if (findingItem.severity === "review_required") {
    return 12;
  }

  if (findingItem.severity === "warning") {
    return 7;
  }

  return 0;
}

function calculateReadinessScore(
  transactionClass: VidaTransactionClass,
  relevance: VidaRelevance,
  findings: VidaReadinessFinding[]
) {
  const base = scoreBase(transactionClass, relevance);

  if (base === null) {
    return null;
  }

  const score = findings.reduce(
    (current, findingItem) => current - scorePenalty(findingItem),
    base
  );

  return Math.max(0, Math.min(100, score));
}

function isActionableStructuredEvidenceFinding(
  findingItem: VidaReadinessFinding
) {
  if (
    findingItem.category !== "STRUCTURED_INVOICE" &&
    findingItem.category !== "UBL" &&
    findingItem.category !== "CII" &&
    findingItem.category !== "XSD" &&
    findingItem.category !== "SCHEMATRON"
  ) {
    return false;
  }

  if (findingItem.severity !== "info") {
    return true;
  }

  return (
    findingItem.evidenceStatus === "missing" ||
    findingItem.evidenceStatus === "failed" ||
    findingItem.evidenceStatus === "not_configured" ||
    findingItem.evidenceStatus === "invalid"
  );
}

function isActionableXmlRerunFinding(findingItem: VidaReadinessFinding) {
  if (
    findingItem.category !== "UBL" &&
    findingItem.category !== "CII" &&
    findingItem.category !== "XSD" &&
    findingItem.category !== "SCHEMATRON"
  ) {
    return false;
  }

  return (
    findingItem.severity !== "info" ||
    findingItem.evidenceStatus === "failed" ||
    findingItem.evidenceStatus === "not_configured" ||
    findingItem.evidenceStatus === "invalid"
  );
}

function getReadinessStatus(
  transactionClass: VidaTransactionClass,
  relevance: VidaRelevance,
  score: number | null,
  findings: VidaReadinessFinding[]
): VidaReadinessStatus {
  if (transactionClass === "insufficient_data") {
    return "needs_more_invoice_data";
  }

  if (relevance === "not_relevant") {
    return "not_relevant";
  }

  if (
    findings.some(
      (findingItem) =>
        findingItem.severity === "blocked" ||
        isActionableStructuredEvidenceFinding(findingItem)
    )
  ) {
    return "needs_more_invoice_data";
  }

  if (
    relevance === "review_required" ||
    findings.some(
      (findingItem) =>
        findingItem.severity === "review_required" ||
        findingItem.category === "LEGAL_LABEL"
    )
  ) {
    return "professional_review_required";
  }

  if (
    findings.some(
      (findingItem) =>
        (findingItem.category === "VIES" ||
          findingItem.category === "VAT_ID") &&
        findingItem.severity !== "info"
    )
  ) {
    return "needs_vat_evidence";
  }

  if (
    findings.some(
      (findingItem) =>
        findingItem.category === "COUNTRY_PACK" ||
        findingItem.category === "LEGAL_LABEL"
    )
  ) {
    return "needs_country_review";
  }

  if (score !== null && score >= 70) {
    return "ready_for_technical_review";
  }

  return "professional_review_required";
}

function buildRecommendedNextActions(
  transactionClass: VidaTransactionClass,
  findings: VidaReadinessFinding[]
) {
  const actions = [
    "Validate the invoice as canonical structured data before relying on any readiness output.",
    "Keep local VAT-format checks and VIES evidence separate; VIES evidence is time-of-check evidence only.",
    "Review applicable country packs, source coverage, version dates, and professional-review warnings.",
    "Treat this result as an educational simulation, not legal, tax, accounting, filing, or authority advice."
  ];

  if (isHighRelevanceB2bClass(transactionClass)) {
    actions.unshift(
      "Prepare the invoice data for cross-border EU B2B readiness review."
    );
  }

  if (
    findings.some(
      (item) => item.severity === "blocked" || item.severity === "review_required"
    )
  ) {
    actions.unshift(
      "Resolve blocked and review-required findings before interpreting the readiness result."
    );
  }

  if (findings.some(isActionableXmlRerunFinding)) {
    actions.unshift(
      "Rerun XML, XSD, and guarded Schematron checks after fixing structured invoice issues."
    );
  }

  return uniqueStrings(actions);
}

function mapCountryPackSourceReference(
  sourceReference: CountryPackSourceReference
): VidaSourceReference {
  return {
    id: sourceReference.id,
    label: `${sourceReference.publisher}: ${sourceReference.title}`,
    title: sourceReference.title,
    publisher: sourceReference.publisher,
    url: sourceReference.url,
    sourceType: sourceReference.sourceType,
    reviewedAt: sourceReference.reviewedAt,
    ...(sourceReference.notes ? { notes: sourceReference.notes } : {})
  };
}

function buildSourceReferences(
  input: NormalizedVidaInput,
  findings: VidaReadinessFinding[],
  transactionSimulation: TransactionClassifierResult
) {
  const sourceMap = new Map<string, VidaSourceReference>();

  for (const sourceReference of VIDA_CORE_SOURCE_REFERENCES) {
    sourceMap.set(sourceReference.id, sourceReference);
  }

  for (const countryCode of [
    input.sellerCountryCode,
    input.buyerCountryCode,
    "EU"
  ]) {
    const pack = getPack(countryCode);

    if (!pack) {
      continue;
    }

    for (const sourceReference of pack.sourceReferences) {
      sourceMap.set(
        sourceReference.id,
        mapCountryPackSourceReference(sourceReference)
      );
    }
  }

  for (const sourceRef of combineSourceRefs(
    input.sourceRefs,
    findings.flatMap((findingItem) => findingItem.sourceRefs),
    transactionSimulation.countryPackContext.sourceRefs,
    transactionSimulation.findings.flatMap((findingItem) => findingItem.sourceRefIds)
  )) {
    if (!sourceMap.has(sourceRef)) {
      sourceMap.set(sourceRef, {
        id: sourceRef,
        label: sourceRef,
        notes:
          "Caller-provided or subsystem-provided source reference. It is carried as evidence context only and does not create a legal or tax rule."
      });
    }
  }

  for (const sourceLabel of input.sourceLabels) {
    const id = sourceLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    if (id && !sourceMap.has(id)) {
      sourceMap.set(id, {
        id,
        label: sourceLabel,
        notes:
          "Caller-provided source label. It is carried as evidence context only and does not create a legal or tax rule."
      });
    }
  }

  return [...sourceMap.values()];
}

function getLegalConfidence(
  relevance: VidaRelevance,
  findings: VidaReadinessFinding[]
): VidaLegalConfidence {
  if (
    relevance === "review_required" ||
    findings.some(
      (findingItem) =>
        findingItem.severity === "review_required" ||
        findingItem.severity === "blocked" ||
        findingItem.legalConfidence === "professional_review_required"
    )
  ) {
    return "professional_review_required";
  }

  return "educational_simulation";
}

export function buildVidaSimulationInputFromCanonicalInvoice(
  invoice: CanonicalInvoice,
  extra: Partial<Omit<VidaReadinessSimulationInput, "sellerCountry" | "buyerCountry">> = {}
): VidaReadinessSimulationInput {
  const output: VidaReadinessSimulationInput = {
    sellerCountry: invoice.seller.country,
    buyerCountry: invoice.buyer.country,
    buyerType: extra.buyerType ?? (invoice.buyer.vatId ? "business" : "unknown"),
    sellerType: extra.sellerType ?? "business",
    transactionType: extra.transactionType ?? "unknown",
    invoiceDate: extra.invoiceDate ?? invoice.document.issueDate,
    issueDate: extra.issueDate ?? invoice.document.issueDate,
    currency: extra.currency ?? invoice.document.currency,
    invoiceProfile: extra.invoiceProfile ?? invoice.profile,
    structuredInvoiceSignals: {
      ...extra.structuredInvoiceSignals,
      hasCanonicalInvoice: true
    }
  };

  if (invoice.seller.vatId) {
    output.sellerVatId = invoice.seller.vatId;
  }

  if (invoice.buyer.vatId) {
    output.buyerVatId = invoice.buyer.vatId;
  }

  if (extra.supplyScenario) {
    output.supplyScenario = extra.supplyScenario;
  }

  const amount = extra.amount ?? invoice.totals.payableAmount;

  if (amount) {
    output.amount = amount;
  }

  if (extra.vatEvidence) {
    output.vatEvidence = extra.vatEvidence;
  }

  if (extra.countryPackContext) {
    output.countryPackContext = extra.countryPackContext;
  }

  if (extra.countryPackVersions) {
    output.countryPackVersions = extra.countryPackVersions;
  }

  if (extra.sourceRefs) {
    output.sourceRefs = extra.sourceRefs;
  }

  if (extra.sourceLabels) {
    output.sourceLabels = extra.sourceLabels;
  }

  return output;
}

export function simulateVidaReadinessFromCanonicalInvoice(
  invoice: CanonicalInvoice,
  extra: Partial<Omit<VidaReadinessSimulationInput, "sellerCountry" | "buyerCountry">> = {}
): VidaReadinessSimulationResult {
  return simulateVidaReadiness(
    buildVidaSimulationInputFromCanonicalInvoice(invoice, extra)
  );
}

export function listVidaSupportedEuCountries() {
  return listCountryPacks()
    .filter((pack) => pack.euMemberState)
    .map((pack) => ({
      countryCode: pack.countryCode,
      countryName: pack.countryName,
      vatPrefix: pack.vatNumber.prefix,
      status: pack.status,
      version: pack.version,
      sourceCoverageStatus: pack.sourceCoverageSummary.overall
    }));
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
  const transactionSimulation = buildTaxEngineTransactionSimulation(
    normalizedInput,
    countryContext
  );
  const vidaRelevance = getVidaRelevance(transactionClass, countryContext);
  const reason = buildReason(transactionClass, normalizedInput, countryContext);
  const vatFormatEvidence = buildVatFormatEvidence(normalizedInput);
  const findings = buildFindings(
    normalizedInput,
    countryContext,
    transactionClass,
    vidaRelevance,
    vatFormatEvidence,
    transactionSimulation
  );
  const readinessScore = calculateReadinessScore(
    transactionClass,
    vidaRelevance,
    findings
  );
  const readinessStatus = getReadinessStatus(
    transactionClass,
    vidaRelevance,
    readinessScore,
    findings
  );
  const legalConfidence = getLegalConfidence(vidaRelevance, findings);

  return {
    simulationVersion: VIDA_SIMULATOR_VERSION,
    transactionClass,
    transactionSimulation,
    vidaRelevance,
    readinessScore,
    readinessStatus,
    reason,
    effectiveDateContext: VIDA_EFFECTIVE_DATE_CONTEXT,
    timeline: VIDA_TIMELINE.map((item) => ({
      ...item,
      sourceRefs: [...item.sourceRefs]
    })),
    confidence: legalConfidence,
    legalConfidence,
    countryContext,
    normalizedInput,
    evidenceSummary: buildEvidenceSummary(
      normalizedInput,
      countryContext,
      vatFormatEvidence
    ),
    findings,
    recommendedNextActions: buildRecommendedNextActions(
      transactionClass,
      findings
    ),
    sourceReferences: buildSourceReferences(
      normalizedInput,
      findings,
      transactionSimulation
    ),
    disclaimer: VIDA_SIMULATOR_DISCLAIMER
  };
}
