import {
  SCHEMATRON_EXECUTION_ADAPTER_VERSION,
  SCHEMATRON_FINDING_CONTRACT_VERSION
} from "@invoice-lantern/ubl";
import {
  getCountryPack,
  normalizeCountryCode,
  type CountryPack,
  type CountryPackSourceReference,
  type CountryPackStatus
} from "@invoice-lantern/country-packs";
import type {
  CanonicalInvoice,
  ValidationFinding as CoreValidationFinding,
  ValidationFindingSeverity,
  ValidationRuleSourceType,
  ValidationRuleSetMetadata
} from "@invoice-lantern/invoice-core";
import {
  enrichedValidationFindingSchema,
  legalConfidenceSchema,
  validationRuleCategorySchema,
  type EnrichedValidationFinding,
  type LegalConfidence,
  type ValidationRuleCategory,
  type ValidationSourceReference
} from "../schemas/validation-engine.js";
import type { ViesEvidenceRecord } from "../repositories/vies-evidence-repository.js";
import type { XmlValidationJobFinding } from "./xml-validation-job-service.js";

export const VALIDATION_ENGINE_RULE_SET_CODE =
  "INVOICE_LANTERN_VALIDATION_ENGINE";
export const VALIDATION_ENGINE_RULE_VERSION = "2026.05.1";
export const VALIDATION_ENGINE_SOURCE_LABEL =
  "Invoice Lantern validation engine mapping policy";
export const UBL_XSD_SOURCE_LABEL =
  "Invoice Lantern local UBL XSD validation adapter";
export const SCHEMATRON_SOURCE_LABEL =
  "Invoice Lantern guarded local Schematron execution adapter";
export const VIES_RULE_SET_CODE = "INVOICE_LANTERN_VIES_EVIDENCE";
export const VIES_RULE_VERSION = "2026.05.1";
export const VIES_SOURCE_LABEL = "VAT Information Exchange System (VIES)";
export const VIES_SOURCE_URL =
  "https://ec.europa.eu/taxation_customs/vies/";
export const COUNTRY_PACK_RULE_SET_CODE =
  "INVOICE_LANTERN_COUNTRY_PACKS";
export const COUNTRY_PACK_RULE_VERSION = "2026.05.1";
export const COUNTRY_PACK_SOURCE_LABEL =
  "Invoice Lantern country-pack source metadata";

const VALIDATION_ENGINE_SOURCE: ValidationSourceReference = {
  sourceName: VALIDATION_ENGINE_SOURCE_LABEL,
  sourceType: "internal_technical_policy",
  jurisdiction: "platform",
  notes:
    "Internal Invoice Lantern mapping policy for source-linked technical validation findings. It does not create official, legal, tax, accounting, Peppol, EN 16931, ViDA, government, or authority conclusions."
};

const UBL_XSD_SOURCE: ValidationSourceReference = {
  sourceName: UBL_XSD_SOURCE_LABEL,
  sourceType: "internal_technical_policy",
  jurisdiction: "platform",
  notes:
    "Local technical adapter that maps UBL XSD diagnostics into the Invoice Lantern finding contract. It is not an authority or standards-body result."
};

const SCHEMATRON_SOURCE: ValidationSourceReference = {
  sourceName: SCHEMATRON_SOURCE_LABEL,
  sourceType: "internal_technical_policy",
  jurisdiction: "platform",
  notes:
    "Guarded local Schematron execution metadata mapped into EN 16931-style and Peppol-style sandbox findings. It does not claim authority or standards-body status."
};

export const VIES_SOURCE_REFERENCE: ValidationSourceReference = {
  sourceName: VIES_SOURCE_LABEL,
  sourceLabel: VIES_SOURCE_LABEL,
  sourceType: "official_eu_source",
  sourceUrl: VIES_SOURCE_URL,
  jurisdiction: "EU",
  notes:
    "VIES time-of-check evidence source. Availability depends on EU and national VAT database systems; returned evidence is not legal, tax, accounting, filing, or full transaction treatment advice."
};

const LEGAL_CONFIDENCE_VALUES = new Set<string>(legalConfidenceSchema.options);
const SOURCE_TYPE_VALUES = new Set<ValidationRuleSourceType>([
  "internal_technical_policy",
  "standard_documentation",
  "official_eu_source",
  "official_national_source",
  "public_reference",
  "professional_review"
]);

function hasText(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeLegalConfidence(value: unknown): LegalConfidence {
  return typeof value === "string" && LEGAL_CONFIDENCE_VALUES.has(value)
    ? (value as LegalConfidence)
    : "technical";
}

function normalizeCategory(
  value: unknown,
  fallback: ValidationRuleCategory
): ValidationRuleCategory {
  const parsed = validationRuleCategorySchema.safeParse(value);

  return parsed.success ? parsed.data : fallback;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSourceType(value: string | undefined) {
  return value && SOURCE_TYPE_VALUES.has(value as ValidationRuleSourceType)
    ? (value as ValidationRuleSourceType)
    : "internal_technical_policy";
}

function mapCountryPackSourceType(
  value: CountryPackSourceReference["sourceType"]
): ValidationRuleSourceType {
  if (value === "national_tax_authority" || value === "national_einvoicing_authority") {
    return "official_national_source";
  }

  if (value === "eu_law" || value === "eu_guidance" || value === "vies") {
    return "official_eu_source";
  }

  if (value === "standard" || value === "peppol") {
    return "standard_documentation";
  }

  if (value === "country_pack") {
    return "public_reference";
  }

  return "internal_technical_policy";
}

function mapCountryPackSourceReference(
  sourceReference: CountryPackSourceReference
): ValidationSourceReference {
  return {
    id: sourceReference.id,
    sourceName: sourceReference.title,
    sourceLabel: sourceReference.title,
    sourceType: mapCountryPackSourceType(sourceReference.sourceType),
    sourceUrl: sourceReference.url,
    jurisdiction: sourceReference.jurisdiction,
    reviewedAt: sourceReference.reviewedAt,
    ...(sourceReference.effectiveFrom
      ? { effectiveFrom: sourceReference.effectiveFrom }
      : {}),
    ...(sourceReference.effectiveTo ?? sourceReference.effectiveUntil
      ? { effectiveUntil: sourceReference.effectiveTo ?? sourceReference.effectiveUntil }
      : {}),
    notes: sourceReference.notes
  };
}

function mapCountryPackSourceReferences(
  pack: CountryPack,
  sourceRefIds: string[]
) {
  const refs = sourceRefIds.length > 0 ? sourceRefIds : pack.sourceReferences.map((source) => source.id);
  const sourceRefIdSet = new Set(refs);

  return pack.sourceReferences
    .filter((sourceReference) => sourceRefIdSet.has(sourceReference.id))
    .map(mapCountryPackSourceReference);
}

function hasSourceContext(input: {
  sourceLabels: string[];
  sourceReferences: ValidationSourceReference[];
}) {
  return input.sourceLabels.length > 0 || input.sourceReferences.length > 0;
}

function legalConfidenceWithSourceGuard(input: {
  legalConfidence: LegalConfidence;
  sourceLabels: string[];
  sourceReferences: ValidationSourceReference[];
}) {
  if (input.legalConfidence === "technical") {
    return input.legalConfidence;
  }

  return hasSourceContext(input) ? input.legalConfidence : "technical";
}

function mergeSourceLabels(
  labels: string[],
  references: ValidationSourceReference[]
) {
  return [
    ...new Set([
      ...labels,
      ...references
        .map((reference) => reference.sourceLabel ?? reference.sourceName)
        .filter(hasText)
    ])
  ];
}

function buildRuleSetKey(code: string, version: string) {
  return `${code}@${version}`;
}

function makeEngineRule(input: {
  code: string;
  title: string;
  description: string;
  category: ValidationRuleCategory;
  severity: ValidationFindingSeverity;
  fieldPath: string;
  messageTemplate: string;
  fixSuggestion?: string;
  legalConfidence: LegalConfidence;
  source: ValidationSourceReference;
  ruleSetCode?: string;
  ruleVersion?: string;
}): ValidationRuleSetMetadata["rules"][number] {
  const rule: ValidationRuleSetMetadata["rules"][number] = {
    code: input.code,
    title: input.title,
    description: input.description,
    category: input.category,
    severity: input.severity,
    fieldPath: input.fieldPath,
    messageTemplate: input.messageTemplate,
    legalConfidence: input.legalConfidence,
    version: input.ruleVersion ?? VALIDATION_ENGINE_RULE_VERSION,
    status: "published",
    ruleSetCode: input.ruleSetCode ?? VALIDATION_ENGINE_RULE_SET_CODE,
    sourceLabels: [input.source.sourceLabel ?? input.source.sourceName],
    sources: [
      {
        sourceName: input.source.sourceName,
        sourceType: normalizeSourceType(input.source.sourceType),
        jurisdiction: input.source.jurisdiction ?? "platform",
        ...(input.source.sourceUrl ? { sourceUrl: input.source.sourceUrl } : {}),
        ...(input.source.reviewedAt
          ? { reviewedAt: input.source.reviewedAt }
          : {}),
        ...(input.source.effectiveFrom
          ? { effectiveFrom: input.source.effectiveFrom }
          : {}),
        ...(input.source.effectiveUntil
          ? { effectiveUntil: input.source.effectiveUntil }
          : {}),
        notes: input.source.notes ?? ""
      }
    ]
  };

  if (input.fixSuggestion) {
    rule.fixSuggestion = input.fixSuggestion;
  }

  return rule;
}

export function enrichValidationFinding(
  finding: CoreValidationFinding & {
    field?: string;
    ruleId?: string;
    sourceRefIds?: string[];
    sourceReferences?: ValidationSourceReference[];
    checkType?: string;
    layer?: string;
    createdAt?: string;
    status?: string;
    evidenceId?: string;
    xmlLine?: number;
    technicalCode?: string;
    technicalMessage?: string;
    businessRuleId?: string;
    countryPackVersion?: string;
    countryPackStatus?: string;
    countryPackCountryCode?: string;
  },
  defaults: {
    category?: ValidationRuleCategory;
    ruleSetCode?: string;
    ruleVersion?: string;
    sourceReferences?: ValidationSourceReference[];
    sourceLabels?: string[];
    legalConfidence?: LegalConfidence;
    checkType?: string;
    layer?: string;
  } = {}
): EnrichedValidationFinding {
  const defaultSources = defaults.sourceReferences ?? [VALIDATION_ENGINE_SOURCE];
  const sourceReferences =
    finding.sourceReferences && finding.sourceReferences.length > 0
      ? finding.sourceReferences
      : defaultSources;
  const sourceLabels = mergeSourceLabels(
    finding.sourceLabels ?? defaults.sourceLabels ?? [],
    sourceReferences
  );
  const fieldPath = hasText(finding.fieldPath)
    ? finding.fieldPath
    : finding.field ?? "invoice";
  const legalConfidence = legalConfidenceWithSourceGuard({
    legalConfidence:
      defaults.legalConfidence ?? normalizeLegalConfidence(finding.legalConfidence),
    sourceLabels,
    sourceReferences
  });

  const enriched: EnrichedValidationFinding = {
    code: finding.code,
    severity: finding.severity,
    category: normalizeCategory(finding.category, defaults.category ?? "SCHEMA"),
    field: hasText(finding.field) ? finding.field : fieldPath,
    fieldPath,
    message: finding.message,
    sourceLabels,
    sourceReferences,
    ruleId: finding.ruleId ?? finding.code,
    ruleSetCode: finding.ruleSetCode ?? defaults.ruleSetCode,
    ruleVersion:
      finding.ruleVersion ??
      defaults.ruleVersion ??
      VALIDATION_ENGINE_RULE_VERSION,
    legalConfidence,
    checkType: finding.checkType ?? defaults.checkType ?? "canonical",
    layer: finding.layer ?? defaults.layer ?? "canonical"
  };

  if (finding.fixSuggestion) {
    enriched.fixSuggestion = finding.fixSuggestion;
  }

  if (finding.sourceRefIds && finding.sourceRefIds.length > 0) {
    enriched.sourceRefIds = finding.sourceRefIds;
  }

  if (finding.createdAt) {
    enriched.createdAt = finding.createdAt;
  }

  if (finding.status) {
    enriched.status = finding.status;
  }

  if (finding.evidenceId) {
    enriched.evidenceId = finding.evidenceId;
  }

  if (typeof finding.xmlLine === "number") {
    enriched.xmlLine = finding.xmlLine;
  }

  if (finding.technicalCode) {
    enriched.technicalCode = finding.technicalCode;
  }

  if (finding.technicalMessage) {
    enriched.technicalMessage = finding.technicalMessage;
  }

  if (finding.businessRuleId) {
    enriched.businessRuleId = finding.businessRuleId;
  }

  if (finding.countryPackVersion) {
    enriched.countryPackVersion = finding.countryPackVersion;
  }

  if (finding.countryPackStatus) {
    enriched.countryPackStatus = finding.countryPackStatus;
  }

  if (finding.countryPackCountryCode) {
    enriched.countryPackCountryCode = finding.countryPackCountryCode;
  }

  return enrichedValidationFindingSchema.parse(enriched);
}

export function enrichValidationFindings(
  findings: Array<CoreValidationFinding & { field?: string }>
) {
  return findings.map((finding) => enrichValidationFinding(finding));
}

export function mapXmlValidationFindingToEnriched(
  finding: XmlValidationJobFinding
): EnrichedValidationFinding {
  const category =
    finding.checkType === "xsd_ubl"
      ? "SCHEMA"
      : finding.schematronLayer === "en16931_tc434"
        ? "EN16931"
        : finding.schematronLayer === "peppol_bis_billing"
          ? "PEPPOL"
          : "UBL";
  const ruleVersion =
    finding.schematronLayer === "en16931_tc434" ||
    finding.schematronLayer === "peppol_bis_billing"
      ? SCHEMATRON_FINDING_CONTRACT_VERSION
      : VALIDATION_ENGINE_RULE_VERSION;
  const source =
    finding.checkType === "xsd_ubl" ? UBL_XSD_SOURCE : SCHEMATRON_SOURCE;

  return enrichValidationFinding(
    {
      ...finding,
      category,
      fieldPath: finding.field,
      sourceReferences: [source],
      sourceLabels: finding.sourceLabels ?? [source.sourceName],
      ruleId: finding.businessRuleId ?? finding.ruleId ?? finding.code,
      ruleSetCode:
        finding.schematronLayer === "en16931_tc434" ||
        finding.schematronLayer === "peppol_bis_billing"
          ? "INVOICE_LANTERN_SCHEMATRON_ADAPTER"
          : VALIDATION_ENGINE_RULE_SET_CODE,
      ruleVersion,
      checkType: finding.checkType,
      layer: finding.schematronLayer ?? finding.checkType
    },
    {
      category,
      sourceReferences: [source],
      sourceLabels: [source.sourceName],
      ruleSetCode: VALIDATION_ENGINE_RULE_SET_CODE,
      ruleVersion,
      checkType: finding.checkType,
      layer: finding.schematronLayer ?? finding.checkType
    }
  );
}

function buildCountryPackFinding(input: {
  pack: CountryPack;
  code: string;
  title: string;
  message: string;
  fieldPath: string;
  severity?: ValidationFindingSeverity;
  legalConfidence?: LegalConfidence;
  sourceRefIds?: string[];
  fixSuggestion?: string;
}): EnrichedValidationFinding {
  const sourceRefIds = input.sourceRefIds ?? [];
  const sourceReferences = mapCountryPackSourceReferences(input.pack, sourceRefIds);
  const finding = {
    code: input.code,
    severity: input.severity ?? "warning",
    category: "COUNTRY_PACK" as const,
    field: input.fieldPath,
    fieldPath: input.fieldPath,
    message: input.message,
    legalConfidence:
      input.legalConfidence ?? "professional_review_required",
    ruleId: input.code,
    ruleSetCode: COUNTRY_PACK_RULE_SET_CODE,
    ruleVersion: COUNTRY_PACK_RULE_VERSION,
    sourceRefIds,
    sourceReferences,
    sourceLabels: [
      COUNTRY_PACK_SOURCE_LABEL,
      ...sourceReferences
        .map((sourceReference) => sourceReference.sourceLabel ?? sourceReference.sourceName)
        .filter(hasText)
    ],
    checkType: "country_pack",
    layer: "country_pack",
    countryPackVersion: input.pack.version,
    countryPackStatus: input.pack.status,
    countryPackCountryCode: input.pack.countryCode
  };

  return enrichValidationFinding(
    {
      ...finding,
      ...(input.fixSuggestion ? { fixSuggestion: input.fixSuggestion } : {})
    },
    {
      category: "COUNTRY_PACK",
      ruleSetCode: COUNTRY_PACK_RULE_SET_CODE,
      ruleVersion: COUNTRY_PACK_RULE_VERSION,
      sourceReferences,
      sourceLabels: [COUNTRY_PACK_SOURCE_LABEL],
      legalConfidence: input.legalConfidence ?? "professional_review_required",
      checkType: "country_pack",
      layer: "country_pack"
    }
  );
}

function buildUnsupportedCountryPackFinding(input: {
  countryCode: string;
  fieldPath: string;
}): EnrichedValidationFinding {
  return enrichValidationFinding(
    {
      code: "COUNTRY_PACK_UNSUPPORTED_COUNTRY",
      severity: "warning",
      category: "COUNTRY_PACK",
      field: input.fieldPath,
      fieldPath: input.fieldPath,
      message:
        `No country pack is available for ${input.countryCode}. Invoice Lantern cannot simulate country-specific VAT or e-invoicing context for this country, and professional review is required.`,
      fixSuggestion:
        "Check the country code, use an available EU country pack where appropriate, or route the invoice for professional review.",
      legalConfidence: "professional_review_required",
      ruleId: "COUNTRY_PACK_UNSUPPORTED_COUNTRY",
      ruleSetCode: COUNTRY_PACK_RULE_SET_CODE,
      ruleVersion: COUNTRY_PACK_RULE_VERSION,
      sourceReferences: [VALIDATION_ENGINE_SOURCE],
      sourceLabels: [COUNTRY_PACK_SOURCE_LABEL],
      checkType: "country_pack",
      layer: "country_pack",
      countryPackCountryCode: input.countryCode
    },
    {
      category: "COUNTRY_PACK",
      ruleSetCode: COUNTRY_PACK_RULE_SET_CODE,
      ruleVersion: COUNTRY_PACK_RULE_VERSION,
      sourceReferences: [VALIDATION_ENGINE_SOURCE],
      sourceLabels: [COUNTRY_PACK_SOURCE_LABEL],
      legalConfidence: "professional_review_required",
      checkType: "country_pack",
      layer: "country_pack"
    }
  );
}

function getPackContextFindings(input: {
  pack: CountryPack;
  fieldPath: string;
}) {
  const findings: EnrichedValidationFinding[] = [];
  const pack = input.pack;

  if (
    pack.status !== "reviewed" ||
    pack.legalConfidence === "professional_review_required"
  ) {
    findings.push(
      buildCountryPackFinding({
        pack,
        code: "COUNTRY_PACK_REVIEW_REQUIRED",
        title: "Country pack requires review",
        fieldPath: input.fieldPath,
        sourceRefIds: ["invoice-lantern-country-pack-legal-notice"],
        message:
          `${pack.countryName} country-pack status is ${pack.status}. Country-pack output is educational simulation only and requires professional review before real-world reliance.`,
        fixSuggestion:
          "Review the relevant national VAT and e-invoicing sources with a qualified professional before relying on this invoice."
      })
    );
  }

  if (
    pack.sourceCoverageSummary.overall !== "reviewed" ||
    pack.sourceCoverageSummary.missingSourceWarnings.length > 0
  ) {
    findings.push(
      buildCountryPackFinding({
        pack,
        code: "COUNTRY_PACK_SOURCE_LIMITED",
        title: "Country pack source coverage is limited",
        fieldPath: input.fieldPath,
        sourceRefIds: [
          "eu-vat-country-specific-information",
          "eu-einvoicing-country-factsheets"
        ],
        message:
          `${pack.countryName} source coverage is ${pack.sourceCoverageSummary.overall}. ${pack.sourceCoverageSummary.missingSourceWarnings.join(" ")}`,
        fixSuggestion:
          "Treat missing or limited source coverage as a review task, not as a pass/fail compliance result."
      })
    );
  }

  if (
    pack.vatRates.standard === null ||
    pack.vatRates.confidenceStatus !== "reviewed"
  ) {
    findings.push(
      buildCountryPackFinding({
        pack,
        code: "COUNTRY_PACK_UNKNOWN_RATE_CONTEXT",
        title: "Country VAT rate context is not reviewed",
        fieldPath: input.fieldPath,
        sourceRefIds: pack.vatRates.sourceRefIds,
        message:
          `${pack.countryName} VAT-rate fields are ${pack.vatRates.confidenceStatus}; Invoice Lantern does not infer a national VAT rate from this country pack.`,
        fixSuggestion:
          "Verify VAT rate treatment against reviewed national sources and the transaction facts."
      })
    );
  }

  if (
    pack.eInvoicingStatus.confidenceStatus !== "reviewed" ||
    pack.eInvoicingStatus.b2bDomestic === "unknown" ||
    pack.eInvoicingStatus.clearanceModel === "unknown"
  ) {
    findings.push(
      buildCountryPackFinding({
        pack,
        code: "COUNTRY_PACK_EINVOICING_REVIEW_REQUIRED",
        title: "Country e-invoicing context requires review",
        fieldPath: input.fieldPath,
        sourceRefIds: pack.eInvoicingStatus.sourceRefIds,
        message:
          `${pack.countryName} e-invoicing context is ${pack.eInvoicingStatus.confidenceStatus}. National B2G/B2B, platform, clearance, and effective-date details require professional review.`,
        fixSuggestion:
          "Review national e-invoicing obligations and platform requirements before operational use."
      })
    );
  }

  return findings;
}

function getInvoicePartyCountryContexts(invoice: CanonicalInvoice) {
  return [
    {
      role: "seller" as const,
      countryCode: invoice.seller.country,
      fieldPath: "seller.country"
    },
    {
      role: "buyer" as const,
      countryCode: invoice.buyer.country,
      fieldPath: "buyer.country"
    }
  ].filter((context) => hasText(context.countryCode));
}

export function buildCountryPackValidationFindings(
  invoice: CanonicalInvoice
): EnrichedValidationFinding[] {
  const findings: EnrichedValidationFinding[] = [];
  const seenCountryCodes = new Set<string>();
  const partyContexts = getInvoicePartyCountryContexts(invoice).map((context) => {
    const normalizedCountryCode = normalizeCountryCode(context.countryCode);
    const pack = getCountryPack(normalizedCountryCode);

    return {
      ...context,
      normalizedCountryCode,
      pack
    };
  });

  for (const context of partyContexts) {
    if (seenCountryCodes.has(context.normalizedCountryCode)) {
      continue;
    }

    seenCountryCodes.add(context.normalizedCountryCode);

    if (!context.pack) {
      findings.push(
        buildUnsupportedCountryPackFinding({
          countryCode: context.normalizedCountryCode,
          fieldPath: context.fieldPath
        })
      );
      continue;
    }

    findings.push(
      ...getPackContextFindings({
        pack: context.pack,
        fieldPath: context.fieldPath
      })
    );
  }

  const sellerContext = partyContexts.find((context) => context.role === "seller");
  const buyerContext = partyContexts.find((context) => context.role === "buyer");

  if (
    sellerContext?.pack?.euMemberState &&
    buyerContext?.pack?.euMemberState &&
    sellerContext.normalizedCountryCode !== buyerContext.normalizedCountryCode
  ) {
    const euPack = getCountryPack("EU");
    const sourceRefIds = [
      "eu-vat-country-specific-information",
      "eu-einvoicing-country-factsheets"
    ];

    if (euPack) {
      findings.push(
        buildCountryPackFinding({
          pack: euPack,
          code: "COUNTRY_PACK_CROSS_BORDER_CONTEXT",
          title: "EU cross-border country context",
          fieldPath: "buyer.country",
          severity: "warning",
          legalConfidence: "educational_simulation",
          sourceRefIds,
          message:
            `Seller country ${sellerContext.normalizedCountryCode} and buyer country ${buyerContext.normalizedCountryCode} are different EU member-state country packs. VAT treatment, e-invoicing obligations, and evidence needs require professional review.`,
          fixSuggestion:
            "Review seller and buyer country rules, VAT evidence, and transaction facts before relying on the invoice."
        })
      );
    }
  }

  return findings;
}

export function buildViesFindingFromEvidence(input: {
  record: ViesEvidenceRecord;
  fieldPath?: string;
}): EnrichedValidationFinding {
  const fieldPath = input.fieldPath ?? "parties.vatId";
  const record = input.record;
  const checkedAt = record.checkedAt;
  const displayVat = `${record.countryCode}${record.vatNumberDisplay}`.trim();
  const base = {
    field: fieldPath,
    fieldPath,
    category: "VIES" as const,
    ruleSetCode: VIES_RULE_SET_CODE,
    ruleVersion: VIES_RULE_VERSION,
    sourceReferences: [VIES_SOURCE_REFERENCE],
    sourceLabels: [VIES_SOURCE_LABEL],
    checkType: "vies_evidence",
    layer: "vies",
    evidenceId: record.id,
    createdAt: record.createdAt
  };

  if (record.status === "valid") {
    return enrichValidationFinding({
      ...base,
      code: "VIES_EVIDENCE_VALID_AT_CHECK_TIME",
      severity: "info",
      legalConfidence: "official_source_derived",
      ruleId: "VIES_EVIDENCE_VALID_AT_CHECK_TIME",
      message: `VIES returned time-of-check evidence that VAT number ${displayVat} was valid at ${checkedAt}. This is not legal, tax, accounting, filing, or full transaction treatment advice.`
    });
  }

  if (record.status === "invalid") {
    return enrichValidationFinding({
      ...base,
      code: "VIES_EVIDENCE_INVALID_AT_CHECK_TIME",
      severity: "warning",
      legalConfidence: "official_source_derived",
      ruleId: "VIES_EVIDENCE_INVALID_AT_CHECK_TIME",
      message: `VIES returned time-of-check evidence that VAT number ${displayVat} was not valid at ${checkedAt}. Review the VAT number and seek professional advice before relying on the invoice.`
    });
  }

  if (record.status === "rate_limited") {
    return enrichValidationFinding({
      ...base,
      code: "VIES_EVIDENCE_RATE_LIMITED",
      severity: "warning",
      legalConfidence: "technical",
      ruleId: "VIES_EVIDENCE_RATE_LIMITED",
      message:
        "The VIES evidence check was not sent because the configured Invoice Lantern VIES rate limit was reached. This is not evidence that the VAT number is invalid."
    });
  }

  if (record.status === "unsupported") {
    return enrichValidationFinding({
      ...base,
      code: "VIES_EVIDENCE_UNSUPPORTED_COUNTRY",
      severity: "warning",
      legalConfidence: "technical",
      ruleId: "VIES_EVIDENCE_UNSUPPORTED_COUNTRY",
      message:
        "The VIES evidence check was not sent because the country/VAT format is unsupported by the local format rules. Format-valid and VIES-valid remain separate checks."
    });
  }

  if (record.status === "not_checked") {
    return enrichValidationFinding({
      ...base,
      code: "VIES_EVIDENCE_NOT_CHECKED",
      severity: "info",
      legalConfidence: "technical",
      ruleId: "VIES_EVIDENCE_NOT_CHECKED",
      message:
        "No live VIES evidence check was performed. A locally valid VAT format must not be treated as VIES-valid."
    });
  }

  return enrichValidationFinding({
    ...base,
    code:
      record.status === "error"
        ? "VIES_EVIDENCE_ERROR"
        : "VIES_EVIDENCE_UNAVAILABLE",
    severity: "warning",
    legalConfidence: "technical",
    ruleId:
      record.status === "error"
        ? "VIES_EVIDENCE_ERROR"
        : "VIES_EVIDENCE_UNAVAILABLE",
    message:
      "VIES evidence was unavailable or could not be retrieved safely. VIES unavailable does not mean the VAT number is invalid."
  });
}

export function buildViesFindingFromStatus(input: {
  status: ViesEvidenceRecord["status"];
  countryCode: string;
  vatNumberDisplay: string;
  fieldPath?: string;
  checkedAt?: string;
}): EnrichedValidationFinding {
  const fieldPath = input.fieldPath ?? "parties.vatId";
  const base = {
    field: fieldPath,
    fieldPath,
    category: "VIES" as const,
    ruleSetCode: VIES_RULE_SET_CODE,
    ruleVersion: VIES_RULE_VERSION,
    sourceReferences: [VIES_SOURCE_REFERENCE],
    sourceLabels: [VIES_SOURCE_LABEL],
    checkType: "vies_evidence",
    layer: "vies"
  };
  const baseFinding = input.checkedAt ? { ...base, createdAt: input.checkedAt } : base;

  if (input.status === "unsupported") {
    return enrichValidationFinding({
      ...baseFinding,
      code: "VIES_EVIDENCE_UNSUPPORTED_COUNTRY",
      severity: "warning",
      legalConfidence: "technical",
      ruleId: "VIES_EVIDENCE_UNSUPPORTED_COUNTRY",
      message:
        "The VIES evidence check was not sent because the country/VAT format is unsupported by the local format rules. Format-valid and VIES-valid remain separate checks."
    });
  }

  if (input.status === "rate_limited") {
    return enrichValidationFinding({
      ...baseFinding,
      code: "VIES_EVIDENCE_RATE_LIMITED",
      severity: "warning",
      legalConfidence: "technical",
      ruleId: "VIES_EVIDENCE_RATE_LIMITED",
      message:
        "The VIES evidence check was not sent because the configured Invoice Lantern VIES rate limit was reached. This is not evidence that the VAT number is invalid."
    });
  }

  return enrichValidationFinding({
    ...baseFinding,
    code: "VIES_EVIDENCE_NOT_CHECKED",
    severity: "info",
    legalConfidence: "technical",
    ruleId: "VIES_EVIDENCE_NOT_CHECKED",
    message:
      "No live VIES evidence check was performed. A locally valid VAT format must not be treated as VIES-valid."
  });
}

export function buildValidationFindingSummary(
  findings: EnrichedValidationFinding[]
) {
  const bySeverity: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byLayer: Record<string, number> = {};
  const byCheckType: Record<string, number> = {};
  const byLegalConfidence: Record<string, number> = {};
  const ruleVersions = new Set<string>();
  const sourceLabels = new Set<string>();

  for (const finding of findings) {
    bySeverity[finding.severity] = (bySeverity[finding.severity] ?? 0) + 1;
    byCategory[finding.category] = (byCategory[finding.category] ?? 0) + 1;
    byLayer[finding.layer] = (byLayer[finding.layer] ?? 0) + 1;
    byCheckType[finding.checkType] = (byCheckType[finding.checkType] ?? 0) + 1;
    byLegalConfidence[finding.legalConfidence] =
      (byLegalConfidence[finding.legalConfidence] ?? 0) + 1;

    ruleVersions.add(
      buildRuleSetKey(finding.ruleSetCode ?? "not_linked", finding.ruleVersion)
    );

    for (const label of finding.sourceLabels ?? []) {
      sourceLabels.add(label);
    }
  }

  return {
    totalFindings: findings.length,
    bySeverity,
    byCategory,
    byLayer,
    byCheckType,
    byLegalConfidence,
    ruleVersions: [...ruleVersions].sort(),
    sourceLabels: [...sourceLabels].sort(),
    disclaimer:
      "Invoice Lantern findings are informational technical and simulation findings. They are not legal, tax, accounting, filing, Peppol, EN 16931, ViDA, government, or authority advice."
  };
}

export function listValidationEngineRuleCatalog(): ValidationRuleSetMetadata[] {
  return [
    {
      code: VALIDATION_ENGINE_RULE_SET_CODE,
      name: "Invoice Lantern Validation Engine Mapping Rules",
      description:
        "Internal source-linked finding enrichment rules for canonical, XML, XSD, and guarded Schematron results. These are technical sandbox mappings, not official validation conclusions.",
      version: VALIDATION_ENGINE_RULE_VERSION,
      status: "published",
      legalConfidence: "technical",
      rules: [
        makeEngineRule({
          code: "XML_XSD_FINDING_MAPPED",
          title: "UBL XSD finding mapped",
          description:
            "Maps local UBL XSD worker diagnostics into the unified validation finding contract.",
          category: "SCHEMA",
          severity: "fatal",
          fieldPath: "xml",
          messageTemplate: "{xsdMessage}",
          legalConfidence: "technical",
          source: UBL_XSD_SOURCE
        }),
        makeEngineRule({
          code: "SCHEMATRON_FINDING_MAPPED",
          title: "Schematron finding mapped",
          description:
            "Maps guarded local Schematron failed assertions into EN 16931-style and Peppol-style technical sandbox findings.",
          category: "EN16931",
          severity: "warning",
          fieldPath: "xml",
          messageTemplate: "{schematronMessage}",
          legalConfidence: "educational_simulation",
          source: SCHEMATRON_SOURCE,
          ruleVersion: SCHEMATRON_EXECUTION_ADAPTER_VERSION
        })
      ]
    },
    {
      code: VIES_RULE_SET_CODE,
      name: "Invoice Lantern VIES Evidence Rules",
      description:
        "Rules for optional VIES time-of-check evidence findings. VAT format validity and VIES evidence remain separate.",
      version: VIES_RULE_VERSION,
      status: "published",
      legalConfidence: "official_source_derived",
      rules: [
        makeEngineRule({
          code: "VIES_EVIDENCE_VALID_AT_CHECK_TIME",
          title: "VIES valid at check time",
          description:
            "VIES returned time-of-check evidence that the VAT number was valid. This is not a conclusion about full transaction treatment.",
          category: "VIES",
          severity: "info",
          fieldPath: "parties.vatId",
          messageTemplate: "{viesEvidenceMessage}",
          legalConfidence: "official_source_derived",
          source: VIES_SOURCE_REFERENCE,
          ruleSetCode: VIES_RULE_SET_CODE,
          ruleVersion: VIES_RULE_VERSION
        }),
        makeEngineRule({
          code: "VIES_EVIDENCE_INVALID_AT_CHECK_TIME",
          title: "VIES invalid at check time",
          description:
            "VIES returned time-of-check evidence that the VAT number was invalid. Professional review may still be required.",
          category: "VIES",
          severity: "warning",
          fieldPath: "parties.vatId",
          messageTemplate: "{viesEvidenceMessage}",
          fixSuggestion:
            "Check the VAT number and country code, then retry later or review with a qualified professional.",
          legalConfidence: "official_source_derived",
          source: VIES_SOURCE_REFERENCE,
          ruleSetCode: VIES_RULE_SET_CODE,
          ruleVersion: VIES_RULE_VERSION
        }),
        makeEngineRule({
          code: "VIES_EVIDENCE_UNAVAILABLE",
          title: "VIES unavailable",
          description:
            "The VIES evidence check could not retrieve evidence safely. Unavailable does not mean invalid.",
          category: "VIES",
          severity: "warning",
          fieldPath: "parties.vatId",
          messageTemplate: "{viesEvidenceMessage}",
          legalConfidence: "technical",
          source: VALIDATION_ENGINE_SOURCE,
          ruleSetCode: VIES_RULE_SET_CODE,
          ruleVersion: VIES_RULE_VERSION
        })
      ]
    },
    {
      code: COUNTRY_PACK_RULE_SET_CODE,
      name: "Invoice Lantern Country-Pack Context Rules",
      description:
        "Source-linked country-pack context rules for EU VAT and e-invoicing simulation warnings. They are educational and professional-review-aware, not legal or tax conclusions.",
      version: COUNTRY_PACK_RULE_VERSION,
      status: "published",
      legalConfidence: "professional_review_required",
      rules: [
        makeEngineRule({
          code: "COUNTRY_PACK_REVIEW_REQUIRED",
          title: "Country pack requires professional review",
          description:
            "Flags country packs whose review status is beta, draft, EU-core only, or professional-review required.",
          category: "COUNTRY_PACK",
          severity: "warning",
          fieldPath: "seller.country",
          messageTemplate: "{countryPackReviewMessage}",
          fixSuggestion:
            "Review national VAT and e-invoicing sources with a qualified professional before relying on the invoice.",
          legalConfidence: "professional_review_required",
          source: VALIDATION_ENGINE_SOURCE,
          ruleSetCode: COUNTRY_PACK_RULE_SET_CODE,
          ruleVersion: COUNTRY_PACK_RULE_VERSION
        }),
        makeEngineRule({
          code: "COUNTRY_PACK_SOURCE_LIMITED",
          title: "Country pack source coverage is limited",
          description:
            "Flags missing or limited source coverage in source-linked country-pack sections.",
          category: "COUNTRY_PACK",
          severity: "warning",
          fieldPath: "seller.country",
          messageTemplate: "{countryPackSourceCoverageMessage}",
          fixSuggestion:
            "Treat missing source coverage as a review task, not as a pass/fail compliance result.",
          legalConfidence: "professional_review_required",
          source: VALIDATION_ENGINE_SOURCE,
          ruleSetCode: COUNTRY_PACK_RULE_SET_CODE,
          ruleVersion: COUNTRY_PACK_RULE_VERSION
        }),
        makeEngineRule({
          code: "COUNTRY_PACK_UNKNOWN_RATE_CONTEXT",
          title: "Country VAT rate context is not reviewed",
          description:
            "Flags country packs where VAT-rate fields are null, unknown, or not reviewed.",
          category: "COUNTRY_PACK",
          severity: "warning",
          fieldPath: "seller.country",
          messageTemplate: "{countryPackVatRateMessage}",
          fixSuggestion:
            "Verify VAT rate treatment against reviewed national sources and transaction facts.",
          legalConfidence: "professional_review_required",
          source: VALIDATION_ENGINE_SOURCE,
          ruleSetCode: COUNTRY_PACK_RULE_SET_CODE,
          ruleVersion: COUNTRY_PACK_RULE_VERSION
        }),
        makeEngineRule({
          code: "COUNTRY_PACK_EINVOICING_REVIEW_REQUIRED",
          title: "Country e-invoicing context requires review",
          description:
            "Flags country packs where B2G/B2B, platform, clearance, or effective-date details require professional review.",
          category: "COUNTRY_PACK",
          severity: "warning",
          fieldPath: "seller.country",
          messageTemplate: "{countryPackEInvoicingMessage}",
          fixSuggestion:
            "Review national e-invoicing obligations and platform requirements before operational use.",
          legalConfidence: "professional_review_required",
          source: VALIDATION_ENGINE_SOURCE,
          ruleSetCode: COUNTRY_PACK_RULE_SET_CODE,
          ruleVersion: COUNTRY_PACK_RULE_VERSION
        }),
        makeEngineRule({
          code: "COUNTRY_PACK_CROSS_BORDER_CONTEXT",
          title: "EU cross-border country context",
          description:
            "Flags seller and buyer EU member-state country packs that differ, requiring professional review of cross-border treatment.",
          category: "COUNTRY_PACK",
          severity: "warning",
          fieldPath: "buyer.country",
          messageTemplate: "{countryPackCrossBorderMessage}",
          fixSuggestion:
            "Review seller and buyer country rules, VAT evidence, and transaction facts before relying on the invoice.",
          legalConfidence: "educational_simulation",
          source: VALIDATION_ENGINE_SOURCE,
          ruleSetCode: COUNTRY_PACK_RULE_SET_CODE,
          ruleVersion: COUNTRY_PACK_RULE_VERSION
        }),
        makeEngineRule({
          code: "COUNTRY_PACK_UNSUPPORTED_COUNTRY",
          title: "Unsupported country pack",
          description:
            "Flags country codes without an available country pack. No national VAT or e-invoicing simulation is inferred.",
          category: "COUNTRY_PACK",
          severity: "warning",
          fieldPath: "seller.country",
          messageTemplate: "{countryPackUnsupportedMessage}",
          fixSuggestion:
            "Check the country code, use an available EU country pack where appropriate, or route the invoice for professional review.",
          legalConfidence: "professional_review_required",
          source: VALIDATION_ENGINE_SOURCE,
          ruleSetCode: COUNTRY_PACK_RULE_SET_CODE,
          ruleVersion: COUNTRY_PACK_RULE_VERSION
        })
      ]
    }
  ];
}
