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

export const VAT_FORMAT_CHECK_SOURCE =
  "invoice_lantern_vat_format_rules" as const;

export const VAT_FORMAT_DISCLAIMER =
  "This is a local VAT ID format check only. It does not confirm that the VAT number exists, is active, belongs to a party, is registered for VAT, or is accepted by any authority. Use VIES or a competent authority for official confirmation.";

const TECHNICAL_ONLY_WARNING =
  "Format checks are technical only and do not determine VAT registration status.";

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
      warnings: [TECHNICAL_ONLY_WARNING]
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
          TECHNICAL_ONLY_WARNING
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
      warnings: [TECHNICAL_ONLY_WARNING]
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
        warnings: [TECHNICAL_ONLY_WARNING]
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
      TECHNICAL_ONLY_WARNING
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
    warnings: formatValid
      ? input.warnings
      : [...input.warnings, TECHNICAL_ONLY_WARNING]
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
    warnings: [...input.warnings],
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

  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
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
