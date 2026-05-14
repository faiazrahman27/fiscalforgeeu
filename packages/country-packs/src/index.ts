export type CountryPackStatus =
  | "eu_core_only"
  | "draft"
  | "beta"
  | "reviewed"
  | "professional_review_required"
  | "deprecated"
  | "suspended";

export type LegalConfidence =
  | "technical"
  | "standard_based"
  | "official_source_derived"
  | "educational_simulation"
  | "professional_review_required";

export type CountryPackSourceType =
  | "eu_law"
  | "eu_guidance"
  | "national_tax_authority"
  | "national_einvoicing_authority"
  | "standard"
  | "peppol"
  | "vies"
  | "country_pack"
  | "legal_notice"
  | "other";

export type CountryPackConfidenceStatus =
  | "reviewed"
  | "beta"
  | "draft"
  | "not_reviewed"
  | "unknown"
  | "professional_review_required"
  | "eu_core_only";

export type CountryPackWarning = {
  code: string;
  severity: "info" | "warning" | "fatal" | "blocked";
  message: string;
  legalConfidence: LegalConfidence;
  sourceRefIds?: string[];
};

export type CountryPackSourceReference = {
  id: string;
  title: string;
  jurisdiction: "EU" | string;
  publisher: string;
  url: string;
  sourceType: CountryPackSourceType;
  reviewedAt: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  effectiveUntil?: string;
  confidenceStatus: CountryPackConfidenceStatus;
  confidence: CountryPackStatus;
  notes?: string;
};

export type CountryPackVatNumberRule = {
  prefix: string;
  pattern: string;
  localFormatCheck: boolean;
  checksumCheck: boolean;
  exampleFormat?: string;
  notes: string;
  sourceRefs: string[];
  sourceRefIds: string[];
};

export type CountryPackVatRates = {
  standard: string | null;
  reduced: string[];
  superReduced: string[];
  parking: string[];
  zero: string[];
  notes: string;
  sourceRefs: string[];
  sourceRefIds: string[];
  lastReviewedAt: string | null;
  confidenceStatus: CountryPackConfidenceStatus;
};

export type CountryPackEInvoicingStatus = {
  b2g: "tracked" | "not_tracked" | "unknown";
  b2bDomestic: "tracked" | "not_tracked" | "unknown";
  b2bCrossBorder: "eu_core" | "tracked" | "not_tracked" | "unknown";
  clearanceModel: "country_specific" | "none_tracked" | "unknown";
  platformNotes: string;
  effectiveDateNotes: string;
  sourceRefs: string[];
  sourceRefIds: string[];
  confidenceStatus: CountryPackConfidenceStatus;
};

export type CountryPackRule = {
  code: string;
  title: string;
  message: string;
  description: string;
  category:
    | "VAT_ID"
    | "E_INVOICING"
    | "VIDA_SIMULATION"
    | "COUNTRY_PACK"
    | "LEGAL_LABEL";
  severity: "info" | "warning" | "fatal" | "blocked";
  legalConfidence: LegalConfidence;
  sourceRefs: string[];
  sourceRefIds: string[];
  version: string;
  effectiveFrom?: string;
  reviewStatus: CountryPackConfidenceStatus;
  professionalReviewRequired: boolean;
};

export type CountryPackSourceCoverageSummary = {
  vatNumber: CountryPackConfidenceStatus;
  vatRates: CountryPackConfidenceStatus;
  eInvoicing: CountryPackConfidenceStatus;
  rules: CountryPackConfidenceStatus;
  overall: CountryPackConfidenceStatus;
  missingSourceWarnings: string[];
};

export type CountryPack = {
  countryCode: string;
  countryName: string;
  euMemberState: boolean;
  defaultCurrency: string;
  status: CountryPackStatus;
  version: string;
  lastReviewedAt: string | null;
  reviewerLabel: string;
  vatNumber: CountryPackVatNumberRule;
  vatRates: CountryPackVatRates;
  eInvoicingStatus: CountryPackEInvoicingStatus;
  sourceReferences: CountryPackSourceReference[];
  sourceCoverageSummary: CountryPackSourceCoverageSummary;
  rules: CountryPackRule[];
  warnings: CountryPackWarning[];
  legalConfidence: LegalConfidence;
  disclaimer: string;
};

export const COUNTRY_PACK_DISCLAIMER =
  "Country rule packs in Invoice Lantern are independent educational simulations based on reviewed public sources where available. They are source-linked and versioned, but they do not provide legal, tax, accounting, financial, professional, filing, official, authority, Peppol certification, EN 16931 certification, or compliance advice. National VAT and e-invoicing rules may change, may require local interpretation, and may depend on facts not captured by this platform.";

export const COUNTRY_PACK_REVIEW_WARNING: CountryPackWarning = {
  code: "COUNTRY_PACK_REVIEW_REQUIRED",
  severity: "warning",
  message:
    "Country-specific VAT and e-invoicing obligations require professional review before real-world use. Invoice Lantern country packs are educational simulations only.",
  legalConfidence: "professional_review_required",
  sourceRefIds: ["invoice-lantern-country-pack-legal-notice"]
};

const REVIEWED_AT = "2026-05-14";
const PACK_VERSION = "2026.05.1";
const REVIEWER_LABEL = "Invoice Lantern internal public-source review";

const EU_MEMBER_STATE_CODES = [
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
] as const;

const COUNTRY_CODE_ALIASES: Record<string, string> = {
  EL: "GR"
};

const EU_CORE_SOURCE_REFERENCES: CountryPackSourceReference[] = [
  {
    id: "invoice-lantern-country-pack-legal-notice",
    title: "Invoice Lantern country-pack legal notice",
    jurisdiction: "platform",
    publisher: "Invoice Lantern",
    url: "https://example.invalid/invoice-lantern/country-pack-legal-notice",
    sourceType: "legal_notice",
    reviewedAt: REVIEWED_AT,
    confidenceStatus: "reviewed",
    confidence: "reviewed",
    notes:
      "Internal product boundary used to prevent official, legal, tax, accounting, filing, compliance, Peppol certification, or EN 16931 certification claims."
  },
  {
    id: "eu-directive-2014-55-eu",
    title: "Directive 2014/55/EU on electronic invoicing in public procurement",
    jurisdiction: "EU",
    publisher: "European Union",
    url: "https://eur-lex.europa.eu/eli/dir/2014/55/oj",
    sourceType: "eu_law",
    reviewedAt: REVIEWED_AT,
    effectiveFrom: "2014-05-26",
    confidenceStatus: "reviewed",
    confidence: "reviewed",
    notes:
      "Used as a public EU legal-source reference for e-invoicing context. Invoice Lantern does not claim official status or legal conclusions."
  },
  {
    id: "eu-en16931-einvoicing-standard",
    title: "European standard on eInvoicing semantic model and syntax bindings",
    jurisdiction: "EU",
    publisher: "European Commission",
    url: "https://digital-strategy.ec.europa.eu/en/policies/einvoicing-standard",
    sourceType: "eu_guidance",
    reviewedAt: REVIEWED_AT,
    confidenceStatus: "reviewed",
    confidence: "reviewed",
    notes:
      "Used for standards context only. Validation outputs remain technical and educational unless separately reviewed by qualified professionals."
  },
  {
    id: "eu-vat-identification-numbers",
    title: "VAT identification numbers",
    jurisdiction: "EU",
    publisher: "European Commission",
    url: "https://taxation-customs.ec.europa.eu/taxation/vat/vat-directive/vat-identification-numbers_en",
    sourceType: "eu_guidance",
    reviewedAt: REVIEWED_AT,
    confidenceStatus: "reviewed",
    confidence: "reviewed",
    notes:
      "Used to source the EU context for VAT identification number checks. Local format checks do not confirm registration, party ownership, or official acceptance."
  },
  {
    id: "eu-vies-vat-information-exchange-system",
    title: "VAT Information Exchange System (VIES)",
    jurisdiction: "EU",
    publisher: "European Commission",
    url: "https://ec.europa.eu/taxation_customs/vies/",
    sourceType: "vies",
    reviewedAt: REVIEWED_AT,
    confidenceStatus: "reviewed",
    confidence: "reviewed",
    notes:
      "Used to distinguish local format checks from optional VIES evidence checks. VIES evidence is time-of-check evidence only."
  },
  {
    id: "eu-vat-rates-overview",
    title: "VAT rates",
    jurisdiction: "EU",
    publisher: "European Commission",
    url: "https://taxation-customs.ec.europa.eu/taxation/vat/vat-rules/vat-rates_en",
    sourceType: "eu_guidance",
    reviewedAt: REVIEWED_AT,
    confidenceStatus: "reviewed",
    confidence: "reviewed",
    notes:
      "Used as a pointer to official public VAT-rate information. Country-pack rates remain null unless reviewed and represented explicitly."
  },
  {
    id: "eu-vat-country-specific-information",
    title: "Country-specific information on VAT",
    jurisdiction: "EU",
    publisher: "European Commission",
    url: "https://taxation-customs.ec.europa.eu/taxation/vat/vat-rules/country-specific-information-vat_en",
    sourceType: "eu_guidance",
    reviewedAt: REVIEWED_AT,
    confidenceStatus: "reviewed",
    confidence: "reviewed",
    notes:
      "Used as a public EU source index for country-specific VAT references. It is not used here to invent unreviewed national rules."
  },
  {
    id: "eu-einvoicing-country-factsheets",
    title: "eInvoicing country factsheets",
    jurisdiction: "EU",
    publisher: "European Commission Digital Building Blocks",
    url: "https://ec.europa.eu/digital-building-blocks/sites/display/DIGITAL/eInvoicing+Country+Factsheets+for+each+Member+State+and+other+countries",
    sourceType: "eu_guidance",
    reviewedAt: REVIEWED_AT,
    confidenceStatus: "reviewed",
    confidence: "reviewed",
    notes:
      "Used as a public factsheet index for national e-invoicing context. Country-specific implementation details remain professional-review required unless explicitly reviewed in a pack."
  },
  {
    id: "eu-vida-package-context",
    title: "VAT in the Digital Age package",
    jurisdiction: "EU",
    publisher: "European Commission",
    url: "https://taxation-customs.ec.europa.eu/taxation/vat/vat-digital-age_en",
    sourceType: "eu_guidance",
    reviewedAt: REVIEWED_AT,
    confidenceStatus: "reviewed",
    confidence: "reviewed",
    notes:
      "Used for ViDA-readiness simulation context. Invoice Lantern does not provide official ViDA filing or reporting."
  }
];

type MemberStatePackDefinition = {
  countryCode: (typeof EU_MEMBER_STATE_CODES)[number];
  countryName: string;
  defaultCurrency: string;
  vatPrefix: string;
  vatPattern: string;
  exampleFormat: string;
};

const EU_MEMBER_STATE_PACK_DEFINITIONS: readonly MemberStatePackDefinition[] = [
  {
    countryCode: "AT",
    countryName: "Austria",
    defaultCurrency: "EUR",
    vatPrefix: "AT",
    vatPattern: "^ATU[0-9]{8}$",
    exampleFormat: "ATU12345678"
  },
  {
    countryCode: "BE",
    countryName: "Belgium",
    defaultCurrency: "EUR",
    vatPrefix: "BE",
    vatPattern: "^BE[01][0-9]{9}$",
    exampleFormat: "BE0123456789"
  },
  {
    countryCode: "BG",
    countryName: "Bulgaria",
    defaultCurrency: "BGN",
    vatPrefix: "BG",
    vatPattern: "^BG[0-9]{9,10}$",
    exampleFormat: "BG123456789"
  },
  {
    countryCode: "HR",
    countryName: "Croatia",
    defaultCurrency: "EUR",
    vatPrefix: "HR",
    vatPattern: "^HR[0-9]{11}$",
    exampleFormat: "HR12345678901"
  },
  {
    countryCode: "CY",
    countryName: "Cyprus",
    defaultCurrency: "EUR",
    vatPrefix: "CY",
    vatPattern: "^CY[0-9]{8}[A-Z]$",
    exampleFormat: "CY12345678A"
  },
  {
    countryCode: "CZ",
    countryName: "Czechia",
    defaultCurrency: "CZK",
    vatPrefix: "CZ",
    vatPattern: "^CZ[0-9]{8,10}$",
    exampleFormat: "CZ12345678"
  },
  {
    countryCode: "DK",
    countryName: "Denmark",
    defaultCurrency: "DKK",
    vatPrefix: "DK",
    vatPattern: "^DK[0-9]{8}$",
    exampleFormat: "DK12345678"
  },
  {
    countryCode: "EE",
    countryName: "Estonia",
    defaultCurrency: "EUR",
    vatPrefix: "EE",
    vatPattern: "^EE[0-9]{9}$",
    exampleFormat: "EE123456789"
  },
  {
    countryCode: "FI",
    countryName: "Finland",
    defaultCurrency: "EUR",
    vatPrefix: "FI",
    vatPattern: "^FI[0-9]{8}$",
    exampleFormat: "FI12345678"
  },
  {
    countryCode: "FR",
    countryName: "France",
    defaultCurrency: "EUR",
    vatPrefix: "FR",
    vatPattern: "^FR[A-Z0-9]{2}[0-9]{9}$",
    exampleFormat: "FRAB123456789"
  },
  {
    countryCode: "DE",
    countryName: "Germany",
    defaultCurrency: "EUR",
    vatPrefix: "DE",
    vatPattern: "^DE[0-9]{9}$",
    exampleFormat: "DE123456789"
  },
  {
    countryCode: "GR",
    countryName: "Greece",
    defaultCurrency: "EUR",
    vatPrefix: "EL",
    vatPattern: "^EL[0-9]{9}$",
    exampleFormat: "EL123456789"
  },
  {
    countryCode: "HU",
    countryName: "Hungary",
    defaultCurrency: "HUF",
    vatPrefix: "HU",
    vatPattern: "^HU[0-9]{8}$",
    exampleFormat: "HU12345678"
  },
  {
    countryCode: "IE",
    countryName: "Ireland",
    defaultCurrency: "EUR",
    vatPrefix: "IE",
    vatPattern: "^IE(?:[0-9]{7}[A-Z]{1,2}|[0-9][A-Z0-9][0-9]{5}[A-Z])$",
    exampleFormat: "IE1234567A"
  },
  {
    countryCode: "IT",
    countryName: "Italy",
    defaultCurrency: "EUR",
    vatPrefix: "IT",
    vatPattern: "^IT[0-9]{11}$",
    exampleFormat: "IT12345678901"
  },
  {
    countryCode: "LV",
    countryName: "Latvia",
    defaultCurrency: "EUR",
    vatPrefix: "LV",
    vatPattern: "^LV[0-9]{11}$",
    exampleFormat: "LV12345678901"
  },
  {
    countryCode: "LT",
    countryName: "Lithuania",
    defaultCurrency: "EUR",
    vatPrefix: "LT",
    vatPattern: "^LT(?:[0-9]{9}|[0-9]{12})$",
    exampleFormat: "LT123456789"
  },
  {
    countryCode: "LU",
    countryName: "Luxembourg",
    defaultCurrency: "EUR",
    vatPrefix: "LU",
    vatPattern: "^LU[0-9]{8}$",
    exampleFormat: "LU12345678"
  },
  {
    countryCode: "MT",
    countryName: "Malta",
    defaultCurrency: "EUR",
    vatPrefix: "MT",
    vatPattern: "^MT[0-9]{8}$",
    exampleFormat: "MT12345678"
  },
  {
    countryCode: "NL",
    countryName: "Netherlands",
    defaultCurrency: "EUR",
    vatPrefix: "NL",
    vatPattern: "^NL[0-9]{9}B[0-9]{2}$",
    exampleFormat: "NL123456789B01"
  },
  {
    countryCode: "PL",
    countryName: "Poland",
    defaultCurrency: "PLN",
    vatPrefix: "PL",
    vatPattern: "^PL[0-9]{10}$",
    exampleFormat: "PL1234567890"
  },
  {
    countryCode: "PT",
    countryName: "Portugal",
    defaultCurrency: "EUR",
    vatPrefix: "PT",
    vatPattern: "^PT[0-9]{9}$",
    exampleFormat: "PT123456789"
  },
  {
    countryCode: "RO",
    countryName: "Romania",
    defaultCurrency: "RON",
    vatPrefix: "RO",
    vatPattern: "^RO[0-9]{2,10}$",
    exampleFormat: "RO123456789"
  },
  {
    countryCode: "SK",
    countryName: "Slovakia",
    defaultCurrency: "EUR",
    vatPrefix: "SK",
    vatPattern: "^SK[0-9]{10}$",
    exampleFormat: "SK1234567890"
  },
  {
    countryCode: "SI",
    countryName: "Slovenia",
    defaultCurrency: "EUR",
    vatPrefix: "SI",
    vatPattern: "^SI[0-9]{8}$",
    exampleFormat: "SI12345678"
  },
  {
    countryCode: "ES",
    countryName: "Spain",
    defaultCurrency: "EUR",
    vatPrefix: "ES",
    vatPattern: "^ES(?:[A-Z][0-9]{8}|[0-9]{8}[A-Z]|[A-Z][0-9]{7}[A-Z0-9])$",
    exampleFormat: "ESA12345678"
  },
  {
    countryCode: "SE",
    countryName: "Sweden",
    defaultCurrency: "SEK",
    vatPrefix: "SE",
    vatPattern: "^SE[0-9]{10}01$",
    exampleFormat: "SE123456789001"
  }
];

export const EU_CORE_COUNTRY_PACK: CountryPack = {
  countryCode: "EU",
  countryName: "European Union Core",
  euMemberState: false,
  defaultCurrency: "EUR",
  status: "reviewed",
  version: PACK_VERSION,
  lastReviewedAt: REVIEWED_AT,
  reviewerLabel: REVIEWER_LABEL,
  vatNumber: {
    prefix: "EU",
    pattern: "^[A-Z]{2}[A-Z0-9]+$",
    localFormatCheck: false,
    checksumCheck: false,
    exampleFormat: "DE123456789",
    notes:
      "EU core does not define a single VAT-number format. Country-specific packs and local format checks remain separate from VIES evidence.",
    sourceRefs: ["eu-vat-identification-numbers", "eu-vies-vat-information-exchange-system"],
    sourceRefIds: ["eu-vat-identification-numbers", "eu-vies-vat-information-exchange-system"]
  },
  vatRates: {
    standard: null,
    reduced: [],
    superReduced: [],
    parking: [],
    zero: [],
    notes:
      "No EU-wide invoice VAT rate is inferred. Country and transaction facts require separate reviewed source analysis.",
    sourceRefs: ["eu-vat-rates-overview", "eu-vat-country-specific-information"],
    sourceRefIds: ["eu-vat-rates-overview", "eu-vat-country-specific-information"],
    lastReviewedAt: REVIEWED_AT,
    confidenceStatus: "eu_core_only"
  },
  eInvoicingStatus: {
    b2g: "tracked",
    b2bDomestic: "unknown",
    b2bCrossBorder: "eu_core",
    clearanceModel: "country_specific",
    platformNotes:
      "EU e-invoicing standards context is tracked. National implementation, platform, clearance, and domestic B2B obligations are country-specific and professional-review required.",
    effectiveDateNotes:
      "EU source context is reviewed, but this pack does not determine national effective dates.",
    sourceRefs: [
      "eu-directive-2014-55-eu",
      "eu-en16931-einvoicing-standard",
      "eu-einvoicing-country-factsheets"
    ],
    sourceRefIds: [
      "eu-directive-2014-55-eu",
      "eu-en16931-einvoicing-standard",
      "eu-einvoicing-country-factsheets"
    ],
    confidenceStatus: "reviewed"
  },
  sourceReferences: EU_CORE_SOURCE_REFERENCES,
  sourceCoverageSummary: {
    vatNumber: "reviewed",
    vatRates: "eu_core_only",
    eInvoicing: "reviewed",
    rules: "reviewed",
    overall: "reviewed",
    missingSourceWarnings: [
      "EU core does not provide country-specific VAT rates or national e-invoicing implementation conclusions."
    ]
  },
  rules: [
    {
      code: "EU_STRUCTURED_EINVOICE_CONTEXT",
      title: "Structured e-invoice context",
      message:
        "Invoice Lantern treats structured data and XML as the validation basis. Image-only invoices are not treated as structured e-invoices for validation.",
      description:
        "Educational EU standards context for structured e-invoicing. This rule is not an official or certified EN 16931 result.",
      category: "E_INVOICING",
      severity: "info",
      legalConfidence: "official_source_derived",
      sourceRefs: ["eu-directive-2014-55-eu", "eu-en16931-einvoicing-standard"],
      sourceRefIds: ["eu-directive-2014-55-eu", "eu-en16931-einvoicing-standard"],
      version: PACK_VERSION,
      effectiveFrom: "2014-05-26",
      reviewStatus: "reviewed",
      professionalReviewRequired: true
    },
    {
      code: "EU_VIES_LOCAL_FORMAT_BOUNDARY",
      title: "Local VAT format is not VAT validity",
      message:
        "A local VAT ID format match is only a technical pattern check and does not confirm official VAT validity.",
      description:
        "VIES evidence, when requested and available, is separate from local VAT number formatting.",
      category: "VAT_ID",
      severity: "warning",
      legalConfidence: "educational_simulation",
      sourceRefs: ["eu-vies-vat-information-exchange-system"],
      sourceRefIds: ["eu-vies-vat-information-exchange-system"],
      version: PACK_VERSION,
      reviewStatus: "reviewed",
      professionalReviewRequired: true
    },
    {
      code: "EU_VIDA_SIMULATION_BOUNDARY",
      title: "ViDA-readiness output is simulation only",
      message:
        "ViDA-readiness results are non-official simulations and must not be treated as legal reporting or filing determinations.",
      description:
        "Country packs provide source-linked context that can support later ViDA-readiness simulations without determining compliance.",
      category: "VIDA_SIMULATION",
      severity: "warning",
      legalConfidence: "educational_simulation",
      sourceRefs: ["eu-vida-package-context"],
      sourceRefIds: ["eu-vida-package-context"],
      version: PACK_VERSION,
      reviewStatus: "reviewed",
      professionalReviewRequired: true
    }
  ],
  warnings: [
    COUNTRY_PACK_REVIEW_WARNING,
    {
      code: "EU_CORE_COUNTRY_SPECIFIC_LIMIT",
      severity: "warning",
      message:
        "EU core source metadata does not replace country-specific VAT, e-invoicing, clearance, accounting, or filing review.",
      legalConfidence: "professional_review_required",
      sourceRefIds: ["eu-vat-country-specific-information"]
    }
  ],
  legalConfidence: "educational_simulation",
  disclaimer: COUNTRY_PACK_DISCLAIMER
};

function createMissingSourceWarnings(countryCode: string) {
  return [
    `${countryCode}: national VAT rates are not represented because no country-specific reviewed rate table was encoded in this pack.`,
    `${countryCode}: domestic e-invoicing, clearance, B2B, and effective-date details are professional-review required.`
  ];
}

function createMemberStateWarnings(
  definition: MemberStatePackDefinition
): CountryPackWarning[] {
  return [
    COUNTRY_PACK_REVIEW_WARNING,
    {
      code: `${definition.countryCode}_SOURCE_COVERAGE_LIMITED`,
      severity: "warning",
      message:
        `${definition.countryName} has EU-level public-source context and local VAT format metadata, but detailed national VAT-rate and e-invoicing implementation fields remain professional-review required.`,
      legalConfidence: "professional_review_required",
      sourceRefIds: [
        "eu-vat-country-specific-information",
        "eu-einvoicing-country-factsheets"
      ]
    },
    {
      code: `${definition.countryCode}_VAT_RATE_NOT_REVIEWED`,
      severity: "warning",
      message:
        `${definition.countryName} VAT rates are intentionally left null/not reviewed in this pack rather than invented from incomplete source coverage.`,
      legalConfidence: "professional_review_required",
      sourceRefIds: ["eu-vat-rates-overview"]
    },
    {
      code: `${definition.countryCode}_EINVOICING_REVIEW_REQUIRED`,
      severity: "warning",
      message:
        `${definition.countryName} national e-invoicing obligations, platform rules, clearance model, and effective dates require reviewed national-source analysis before real-world reliance.`,
      legalConfidence: "professional_review_required",
      sourceRefIds: ["eu-einvoicing-country-factsheets"]
    }
  ];
}

function createMemberStateRules(
  definition: MemberStatePackDefinition
): CountryPackRule[] {
  return [
    {
      code: `${definition.countryCode}_VAT_ID_FORMAT_SIMULATION`,
      title: `${definition.countryName} VAT ID local format simulation`,
      message:
        "The country pack can support a local VAT-number pattern check. This is technical only and is not VIES evidence or authority acceptance.",
      description:
        "Local VAT-number syntax check aligned with Invoice Lantern tax-engine format rules. It does not prove registration, status, party ownership, or transaction treatment.",
      category: "VAT_ID",
      severity: "info",
      legalConfidence: "technical",
      sourceRefs: [
        "eu-vat-identification-numbers",
        "eu-vies-vat-information-exchange-system"
      ],
      sourceRefIds: [
        "eu-vat-identification-numbers",
        "eu-vies-vat-information-exchange-system"
      ],
      version: PACK_VERSION,
      reviewStatus: "reviewed",
      professionalReviewRequired: false
    },
    {
      code: `${definition.countryCode}_COUNTRY_PACK_REVIEW_REQUIRED`,
      title: `${definition.countryName} professional review boundary`,
      message:
        "Country-pack output is a source-linked educational simulation and must be reviewed by a qualified professional before real-world use.",
      description:
        "No country-pack finding is a legal, tax, accounting, filing, government, authority, Peppol, EN 16931, or compliance conclusion.",
      category: "COUNTRY_PACK",
      severity: "warning",
      legalConfidence: "professional_review_required",
      sourceRefs: ["invoice-lantern-country-pack-legal-notice"],
      sourceRefIds: ["invoice-lantern-country-pack-legal-notice"],
      version: PACK_VERSION,
      reviewStatus: "professional_review_required",
      professionalReviewRequired: true
    },
    {
      code: `${definition.countryCode}_EINVOICING_CONTEXT_REVIEW_REQUIRED`,
      title: `${definition.countryName} e-invoicing context requires review`,
      message:
        "National B2G/B2B e-invoicing, platform, clearance, and effective-date details are not concluded by this pack.",
      description:
        "EU e-invoicing context is source-linked, but national implementation details are intentionally marked unknown/professional-review required.",
      category: "E_INVOICING",
      severity: "warning",
      legalConfidence: "professional_review_required",
      sourceRefs: [
        "eu-directive-2014-55-eu",
        "eu-einvoicing-country-factsheets"
      ],
      sourceRefIds: [
        "eu-directive-2014-55-eu",
        "eu-einvoicing-country-factsheets"
      ],
      version: PACK_VERSION,
      reviewStatus: "professional_review_required",
      professionalReviewRequired: true
    }
  ];
}

function createMemberStateCountryPack(
  definition: MemberStatePackDefinition
): CountryPack {
  const missingSourceWarnings = createMissingSourceWarnings(definition.countryCode);

  return {
    countryCode: definition.countryCode,
    countryName: definition.countryName,
    euMemberState: true,
    defaultCurrency: definition.defaultCurrency,
    status: "beta",
    version: PACK_VERSION,
    lastReviewedAt: REVIEWED_AT,
    reviewerLabel: REVIEWER_LABEL,
    vatNumber: {
      prefix: definition.vatPrefix,
      pattern: definition.vatPattern,
      localFormatCheck: true,
      checksumCheck: false,
      exampleFormat: definition.exampleFormat,
      notes:
        "Local VAT-number format simulation only. Checksum, registration status, party ownership, and VIES evidence are separate and not inferred by this field.",
      sourceRefs: [
        "eu-vat-identification-numbers",
        "eu-vies-vat-information-exchange-system"
      ],
      sourceRefIds: [
        "eu-vat-identification-numbers",
        "eu-vies-vat-information-exchange-system"
      ]
    },
    vatRates: {
      standard: null,
      reduced: [],
      superReduced: [],
      parking: [],
      zero: [],
      notes:
        "Not reviewed in this pack. Values remain null/empty until specific rates are reviewed from suitable official/public sources.",
      sourceRefs: ["eu-vat-rates-overview", "eu-vat-country-specific-information"],
      sourceRefIds: ["eu-vat-rates-overview", "eu-vat-country-specific-information"],
      lastReviewedAt: null,
      confidenceStatus: "not_reviewed"
    },
    eInvoicingStatus: {
      b2g: "tracked",
      b2bDomestic: "unknown",
      b2bCrossBorder: "eu_core",
      clearanceModel: "unknown",
      platformNotes:
        "EU B2G e-invoicing context is tracked. Domestic B2B mandates, national platforms, clearance models, exemptions, and onboarding details are not concluded by this pack.",
      effectiveDateNotes:
        "Country-specific effective dates are not reviewed in this pack and require professional review.",
      sourceRefs: [
        "eu-directive-2014-55-eu",
        "eu-en16931-einvoicing-standard",
        "eu-einvoicing-country-factsheets"
      ],
      sourceRefIds: [
        "eu-directive-2014-55-eu",
        "eu-en16931-einvoicing-standard",
        "eu-einvoicing-country-factsheets"
      ],
      confidenceStatus: "professional_review_required"
    },
    sourceReferences: EU_CORE_SOURCE_REFERENCES,
    sourceCoverageSummary: {
      vatNumber: "reviewed",
      vatRates: "not_reviewed",
      eInvoicing: "professional_review_required",
      rules: "beta",
      overall: "professional_review_required",
      missingSourceWarnings
    },
    rules: createMemberStateRules(definition),
    warnings: createMemberStateWarnings(definition),
    legalConfidence: "professional_review_required",
    disclaimer: COUNTRY_PACK_DISCLAIMER
  };
}

export const COUNTRY_PACKS = [
  EU_CORE_COUNTRY_PACK,
  ...EU_MEMBER_STATE_PACK_DEFINITIONS.map(createMemberStateCountryPack)
] as const satisfies readonly CountryPack[];

export type CountryCode = (typeof COUNTRY_PACKS)[number]["countryCode"];

export function listCountryPacks(): CountryPack[] {
  return COUNTRY_PACKS.map(cloneCountryPack);
}

export function listCountryCodes(): string[] {
  return COUNTRY_PACKS.map((pack) => pack.countryCode);
}

export function getEuMemberStateCountryCodes(): string[] {
  return [...EU_MEMBER_STATE_CODES];
}

export function getCountryPack(countryCode: string): CountryPack | null {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  const pack = COUNTRY_PACKS.find(
    (countryPack) => countryPack.countryCode === normalizedCountryCode
  );

  return pack ? cloneCountryPack(pack) : null;
}

export function requireCountryPack(countryCode: string): CountryPack {
  const pack = getCountryPack(countryCode);

  if (!pack) {
    throw new Error(`Unsupported country pack: ${countryCode}`);
  }

  return pack;
}

export function isSupportedCountryPack(countryCode: string): boolean {
  return getCountryPack(countryCode) !== null;
}

export function normalizeCountryCode(countryCode: string): string {
  const normalized = countryCode.trim().toUpperCase();

  return COUNTRY_CODE_ALIASES[normalized] ?? normalized;
}

function cloneCountryPack(pack: CountryPack): CountryPack {
  return {
    ...pack,
    vatNumber: {
      ...pack.vatNumber,
      sourceRefs: [...pack.vatNumber.sourceRefs],
      sourceRefIds: [...pack.vatNumber.sourceRefIds]
    },
    vatRates: {
      ...pack.vatRates,
      reduced: [...pack.vatRates.reduced],
      superReduced: [...pack.vatRates.superReduced],
      parking: [...pack.vatRates.parking],
      zero: [...pack.vatRates.zero],
      sourceRefs: [...pack.vatRates.sourceRefs],
      sourceRefIds: [...pack.vatRates.sourceRefIds]
    },
    eInvoicingStatus: {
      ...pack.eInvoicingStatus,
      sourceRefs: [...pack.eInvoicingStatus.sourceRefs],
      sourceRefIds: [...pack.eInvoicingStatus.sourceRefIds]
    },
    sourceReferences: pack.sourceReferences.map((sourceReference) => ({
      ...sourceReference
    })),
    sourceCoverageSummary: {
      ...pack.sourceCoverageSummary,
      missingSourceWarnings: [
        ...pack.sourceCoverageSummary.missingSourceWarnings
      ]
    },
    rules: pack.rules.map((rule) => ({
      ...rule,
      sourceRefs: [...rule.sourceRefs],
      sourceRefIds: [...rule.sourceRefIds]
    })),
    warnings: pack.warnings.map((warning) => ({
      ...warning,
      ...(warning.sourceRefIds ? { sourceRefIds: [...warning.sourceRefIds] } : {})
    }))
  };
}
