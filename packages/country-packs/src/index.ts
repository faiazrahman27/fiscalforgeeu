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

export type CountryPackWarning = {
  code: string;
  severity: "info" | "warning" | "fatal" | "blocked";
  message: string;
  legalConfidence: LegalConfidence;
};

export type CountryPackSourceReference = {
  id: string;
  title: string;
  jurisdiction: "EU" | string;
  publisher: string;
  url: string;
  reviewedAt: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  confidence: CountryPackStatus;
  notes?: string;
};

export type CountryPackVatNumberRule = {
  prefix: string;
  pattern: string;
  localFormatCheck: boolean;
  checksumCheck: boolean;
  sourceRefIds: string[];
};

export type CountryPackVatRates = {
  standard: string | null;
  reduced: string[];
  sourceRefIds: string[];
  lastReviewedAt: string | null;
};

export type CountryPackEInvoicingStatus = {
  b2g: "tracked" | "not_tracked" | "unknown";
  b2bDomestic: "tracked" | "not_tracked" | "unknown";
  b2bCrossBorder: "eu_core" | "tracked" | "not_tracked" | "unknown";
  clearanceModel: "country_specific" | "none_tracked" | "unknown";
};

export type CountryPackRule = {
  code: string;
  title: string;
  description: string;
  category:
    | "VAT_ID"
    | "E_INVOICING"
    | "VIDA_SIMULATION"
    | "COUNTRY_PACK"
    | "LEGAL_LABEL";
  severity: "info" | "warning" | "fatal" | "blocked";
  legalConfidence: LegalConfidence;
  sourceRefIds: string[];
};

export type CountryPack = {
  countryCode: string;
  countryName: string;
  euMemberState: boolean;
  defaultCurrency: string;
  status: CountryPackStatus;
  version: string;
  lastReviewedAt: string | null;
  vatNumber: CountryPackVatNumberRule;
  vatRates: CountryPackVatRates;
  eInvoicingStatus: CountryPackEInvoicingStatus;
  sourceReferences: CountryPackSourceReference[];
  rules: CountryPackRule[];
  warnings: CountryPackWarning[];
  legalConfidence: LegalConfidence;
  disclaimer: string;
};

export const COUNTRY_PACK_DISCLAIMER =
  "Country rule packs in Invoice Lantern are educational simulations based on reviewed public sources where available. They do not provide legal, tax, accounting, filing, or compliance advice. National VAT and e-invoicing rules may change, may require local interpretation, and may depend on facts not captured by this platform.";

export const COUNTRY_PACK_REVIEW_WARNING: CountryPackWarning = {
  code: "COUNTRY_REVIEW_REQUIRED",
  severity: "warning",
  message:
    "Country-specific VAT and e-invoicing obligations require professional review before real-world use.",
  legalConfidence: "professional_review_required"
};

const EU_CORE_SOURCE_REFERENCES: CountryPackSourceReference[] = [
  {
    id: "eu-directive-2014-55-eu",
    title: "Directive 2014/55/EU on electronic invoicing in public procurement",
    jurisdiction: "EU",
    publisher: "European Union",
    url: "https://eur-lex.europa.eu/eli/dir/2014/55/oj",
    reviewedAt: "2026-05-11",
    confidence: "reviewed",
    notes:
      "Used as a public legal source for structured electronic invoicing context. Invoice Lantern does not claim official status."
  },
  {
    id: "eu-en16931-einvoicing-standard",
    title: "European standard on eInvoicing semantic model and syntax bindings",
    jurisdiction: "EU",
    publisher: "European Commission",
    url: "https://digital-strategy.ec.europa.eu/en/policies/einvoicing-standard",
    reviewedAt: "2026-05-11",
    confidence: "reviewed",
    notes:
      "Used for standards context only. Validation outputs remain technical and educational unless separately reviewed by qualified professionals."
  },
  {
    id: "eu-vies-vat-information-exchange-system",
    title: "VAT Information Exchange System (VIES)",
    jurisdiction: "EU",
    publisher: "European Commission",
    url: "https://ec.europa.eu/taxation_customs/vies/",
    reviewedAt: "2026-05-11",
    confidence: "reviewed",
    notes:
      "Used to distinguish local format checks from optional VIES checks. Local format checks must not be treated as official VAT validity confirmation."
  },
  {
    id: "eu-vida-package-context",
    title: "VAT in the Digital Age package",
    jurisdiction: "EU",
    publisher: "European Commission",
    url: "https://taxation-customs.ec.europa.eu/taxation/vat/vat-digital-age_en",
    reviewedAt: "2026-05-11",
    confidence: "reviewed",
    notes:
      "Used for ViDA-readiness simulation context. Invoice Lantern does not provide official ViDA filing or reporting."
  }
];

const EU_MEMBER_STATE_PACK_DEFINITIONS = [
  ["AT", "Austria", "EUR", "^ATU[0-9]{8}$"],
  ["BE", "Belgium", "EUR", "^BE[01][0-9]{9}$"],
  ["BG", "Bulgaria", "BGN", "^BG[0-9]{9,10}$"],
  ["HR", "Croatia", "EUR", "^HR[0-9]{11}$"],
  ["CY", "Cyprus", "EUR", "^CY[0-9]{8}[A-Z]$"],
  ["CZ", "Czechia", "CZK", "^CZ[0-9]{8,10}$"],
  ["DK", "Denmark", "DKK", "^DK[0-9]{8}$"],
  ["EE", "Estonia", "EUR", "^EE[0-9]{9}$"],
  ["FI", "Finland", "EUR", "^FI[0-9]{8}$"],
  ["FR", "France", "EUR", "^FR[A-Z0-9]{2}[0-9]{9}$"],
  ["DE", "Germany", "EUR", "^DE[0-9]{9}$"],
  ["EL", "Greece", "EUR", "^EL[0-9]{9}$"],
  ["HU", "Hungary", "HUF", "^HU[0-9]{8}$"],
  ["IE", "Ireland", "EUR", "^IE(?:[0-9]{7}[A-Z]{1,2}|[0-9][A-Z0-9][0-9]{5}[A-Z])$"],
  ["IT", "Italy", "EUR", "^IT[0-9]{11}$"],
  ["LV", "Latvia", "EUR", "^LV[0-9]{11}$"],
  ["LT", "Lithuania", "EUR", "^LT(?:[0-9]{9}|[0-9]{12})$"],
  ["LU", "Luxembourg", "EUR", "^LU[0-9]{8}$"],
  ["MT", "Malta", "EUR", "^MT[0-9]{8}$"],
  ["NL", "Netherlands", "EUR", "^NL[0-9]{9}B[0-9]{2}$"],
  ["PL", "Poland", "PLN", "^PL[0-9]{10}$"],
  ["PT", "Portugal", "EUR", "^PT[0-9]{9}$"],
  ["RO", "Romania", "RON", "^RO[0-9]{2,10}$"],
  ["SK", "Slovakia", "EUR", "^SK[0-9]{10}$"],
  ["SI", "Slovenia", "EUR", "^SI[0-9]{8}$"],
  ["ES", "Spain", "EUR", "^ES(?:[A-Z][0-9]{8}|[0-9]{8}[A-Z]|[A-Z][0-9]{7}[A-Z0-9])$"],
  ["SE", "Sweden", "SEK", "^SE[0-9]{10}01$"]
] as const;

export const EU_CORE_COUNTRY_PACK: CountryPack = {
  countryCode: "EU",
  countryName: "European Union Core",
  euMemberState: false,
  defaultCurrency: "EUR",
  status: "eu_core_only",
  version: "2026.05.1",
  lastReviewedAt: "2026-05-11",
  vatNumber: {
    prefix: "EU",
    pattern: "^[A-Z]{2}[A-Z0-9]+$",
    localFormatCheck: false,
    checksumCheck: false,
    sourceRefIds: ["eu-vies-vat-information-exchange-system"]
  },
  vatRates: {
    standard: null,
    reduced: [],
    sourceRefIds: [],
    lastReviewedAt: null
  },
  eInvoicingStatus: {
    b2g: "tracked",
    b2bDomestic: "unknown",
    b2bCrossBorder: "eu_core",
    clearanceModel: "country_specific"
  },
  sourceReferences: EU_CORE_SOURCE_REFERENCES,
  rules: [
    {
      code: "EU_STRUCTURED_EINVOICE_CONTEXT",
      title: "Structured e-invoice context",
      description:
        "Invoice Lantern treats structured data and XML as the validation basis. Image-only invoices are not treated as structured e-invoices for validation.",
      category: "E_INVOICING",
      severity: "info",
      legalConfidence: "official_source_derived",
      sourceRefIds: ["eu-directive-2014-55-eu"]
    },
    {
      code: "EU_VIES_LOCAL_FORMAT_BOUNDARY",
      title: "Local VAT format is not VAT validity",
      description:
        "A local VAT ID format match is only a technical pattern check and does not confirm official VAT validity.",
      category: "VAT_ID",
      severity: "warning",
      legalConfidence: "educational_simulation",
      sourceRefIds: ["eu-vies-vat-information-exchange-system"]
    },
    {
      code: "EU_VIDA_SIMULATION_BOUNDARY",
      title: "ViDA-readiness output is simulation only",
      description:
        "ViDA-readiness results are non-official simulations and must not be treated as legal reporting or filing determinations.",
      category: "VIDA_SIMULATION",
      severity: "warning",
      legalConfidence: "educational_simulation",
      sourceRefIds: ["eu-vida-package-context"]
    }
  ],
  warnings: [COUNTRY_PACK_REVIEW_WARNING],
  legalConfidence: "educational_simulation",
  disclaimer: COUNTRY_PACK_DISCLAIMER
};

export const COUNTRY_PACKS = [
  EU_CORE_COUNTRY_PACK,
  ...EU_MEMBER_STATE_PACK_DEFINITIONS.map(
    ([countryCode, countryName, defaultCurrency, pattern]): CountryPack => ({
      countryCode,
      countryName,
      euMemberState: true,
      defaultCurrency,
      status: "eu_core_only",
      version: "2026.05.1",
      lastReviewedAt: null,
      vatNumber: {
        prefix: countryCode,
        pattern,
        localFormatCheck: true,
        checksumCheck: false,
        sourceRefIds: ["eu-vies-vat-information-exchange-system"]
      },
      vatRates: {
        standard: null,
        reduced: [],
        sourceRefIds: [],
        lastReviewedAt: null
      },
      eInvoicingStatus: {
        b2g: "tracked",
        b2bDomestic: "unknown",
        b2bCrossBorder: "eu_core",
        clearanceModel: "country_specific"
      },
      sourceReferences: EU_CORE_SOURCE_REFERENCES,
      rules: [
        {
          code: `${countryCode}_VAT_FORMAT_LOCAL_CHECK`,
          title: `${countryName} VAT ID local format check`,
          description:
            "This country pack contains a local VAT ID pattern check only. It does not confirm that the VAT number exists, is active, belongs to a party, or is accepted by any authority.",
          category: "VAT_ID",
          severity: "info",
          legalConfidence: "technical",
          sourceRefIds: ["eu-vies-vat-information-exchange-system"]
        }
      ],
      warnings: [COUNTRY_PACK_REVIEW_WARNING],
      legalConfidence: "educational_simulation",
      disclaimer: COUNTRY_PACK_DISCLAIMER
    })
  )
] as const satisfies readonly CountryPack[];

export type CountryCode = (typeof COUNTRY_PACKS)[number]["countryCode"];

export function listCountryPacks(): CountryPack[] {
  return COUNTRY_PACKS.map(cloneCountryPack);
}

export function listCountryCodes(): string[] {
  return COUNTRY_PACKS.map((pack) => pack.countryCode);
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
  return countryCode.trim().toUpperCase();
}

function cloneCountryPack(pack: CountryPack): CountryPack {
  return {
    ...pack,
    vatNumber: { ...pack.vatNumber, sourceRefIds: [...pack.vatNumber.sourceRefIds] },
    vatRates: {
      ...pack.vatRates,
      reduced: [...pack.vatRates.reduced],
      sourceRefIds: [...pack.vatRates.sourceRefIds]
    },
    eInvoicingStatus: { ...pack.eInvoicingStatus },
    sourceReferences: pack.sourceReferences.map((sourceReference) => ({
      ...sourceReference
    })),
    rules: pack.rules.map((rule) => ({
      ...rule,
      sourceRefIds: [...rule.sourceRefIds]
    })),
    warnings: pack.warnings.map((warning) => ({ ...warning }))
  };
}
