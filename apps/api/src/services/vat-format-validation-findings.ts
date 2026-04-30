import {
  getVatFormatCountryName,
  validateVatFormat
} from "@invoice-lantern/tax-engine";
import type {
  CanonicalInvoice,
  ValidationFinding,
  ValidationFindingSeverity,
  ValidationRuleSetMetadata
} from "@invoice-lantern/invoice-core";

export type VatFormatValidationFinding = ValidationFinding & {
  field: string;
};

export const VAT_FORMAT_RULE_SET_CODE = "INVOICE_LANTERN_VAT_FORMAT";
export const VAT_FORMAT_RULE_VERSION = "2026.04.1";
export const VAT_FORMAT_SOURCE_LABEL = "Invoice Lantern VAT format rules";

const VAT_FORMAT_SOURCE = {
  sourceName: VAT_FORMAT_SOURCE_LABEL,
  sourceType: "internal_technical_policy" as const,
  jurisdiction: "platform",
  notes:
    "Local technical VAT ID format rules used by Invoice Lantern. These checks do not query VIES, do not prove VAT registration, and are not legal, tax, or accounting advice."
};

const VAT_FORMAT_FIX_SUGGESTION =
  "Check the country prefix, remove spaces, and verify the VAT number with VIES or a competent authority if needed.";

const VAT_FORMAT_HINT_FIX_SUGGESTION =
  "Confirm that the VAT ID prefix matches the party country or update the party country.";

const CHECK_ONLY_MESSAGE =
  "Invoice Lantern ran local VAT ID format checks for present party VAT IDs only. This is not a VIES check, does not confirm VAT registration, and is not legal, tax, or accounting advice.";

type PartyRole = "seller" | "buyer";

type PartyVatFindingInput = {
  role: PartyRole;
  vatId: string;
  countryHint: string;
};

function hasText(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function titleCaseRole(role: PartyRole) {
  return role === "seller" ? "Seller" : "Buyer";
}

function upperCaseRole(role: PartyRole) {
  return role.toUpperCase() as "SELLER" | "BUYER";
}

function buildFinding(input: {
  code: string;
  severity: ValidationFindingSeverity;
  fieldPath: string;
  message: string;
  fixSuggestion?: string;
}): VatFormatValidationFinding {
  const finding: VatFormatValidationFinding = {
    code: input.code,
    severity: input.severity,
    category: "VAT_ID",
    field: input.fieldPath,
    fieldPath: input.fieldPath,
    message: input.message,
    legalConfidence: "technical",
    ruleSetCode: VAT_FORMAT_RULE_SET_CODE,
    ruleVersion: VAT_FORMAT_RULE_VERSION,
    sourceLabels: [VAT_FORMAT_SOURCE_LABEL]
  };

  if (input.fixSuggestion) {
    finding.fixSuggestion = input.fixSuggestion;
  }

  return finding;
}

function hasCountryHintMismatch(warnings: string[], message: string) {
  const combined = `${message} ${warnings.join(" ")}`;

  return /country hint .*conflicts/i.test(combined);
}

function formatCountryLabel(countryCode: string | undefined) {
  if (!countryCode) {
    return "the selected country";
  }

  return getVatFormatCountryName(countryCode) ?? countryCode;
}

function buildPartyVatFormatFinding({
  role,
  vatId,
  countryHint
}: PartyVatFindingInput) {
  const result = validateVatFormat(vatId, countryHint);
  const roleLabel = titleCaseRole(role);
  const roleCode = upperCaseRole(role);
  const fieldPath = `${role}.vatId`;
  const countryLabel = formatCountryLabel(result.countryCode || countryHint);

  if (hasCountryHintMismatch(result.warnings, result.message)) {
    return buildFinding({
      code: `${roleCode}_VAT_ID_COUNTRY_HINT_MISMATCH`,
      severity: "warning",
      fieldPath,
      message: `${roleLabel} VAT ID country prefix ${result.countryCode ?? "detected"} does not match the party country hint ${countryHint}. This is a local format check only, not a VIES check, does not confirm VAT registration, and is not legal/tax advice.`,
      fixSuggestion: VAT_FORMAT_HINT_FIX_SUGGESTION
    });
  }

  if (result.formatValid) {
    return buildFinding({
      code: `${roleCode}_VAT_ID_LOCAL_FORMAT_VALID`,
      severity: "info",
      fieldPath,
      message: `${roleLabel} VAT ID appears to match the local format pattern for ${countryLabel}. This is a local format check only, not a VIES check, does not confirm VAT registration, and is not legal/tax advice.`
    });
  }

  return buildFinding({
    code: `${roleCode}_VAT_ID_LOCAL_FORMAT_INVALID`,
    severity: "warning",
    fieldPath,
    message: `${roleLabel} VAT ID does not match a supported expected local format pattern for ${countryLabel}. This is a technical format check only, not a VIES check, does not confirm VAT registration, and is not a legal/tax conclusion.`,
    fixSuggestion: VAT_FORMAT_FIX_SUGGESTION
  });
}

export function buildVatFormatValidationFindings(
  invoice: CanonicalInvoice
): VatFormatValidationFinding[] {
  const partyFindings: VatFormatValidationFinding[] = [];

  if (hasText(invoice.seller.vatId)) {
    partyFindings.push(
      buildPartyVatFormatFinding({
        role: "seller",
        vatId: invoice.seller.vatId,
        countryHint: invoice.seller.country
      })
    );
  }

  if (hasText(invoice.buyer.vatId)) {
    partyFindings.push(
      buildPartyVatFormatFinding({
        role: "buyer",
        vatId: invoice.buyer.vatId,
        countryHint: invoice.buyer.country
      })
    );
  }

  if (partyFindings.length === 0) {
    return [];
  }

  return [
    buildFinding({
      code: "VAT_ID_LOCAL_FORMAT_CHECK_ONLY",
      severity: "info",
      fieldPath: "parties.vatId",
      message: CHECK_ONLY_MESSAGE
    }),
    ...partyFindings
  ];
}

function vatRule(input: {
  code: string;
  title: string;
  description: string;
  severity: ValidationFindingSeverity;
  fieldPath: string;
  messageTemplate: string;
  fixSuggestion?: string;
}): ValidationRuleSetMetadata["rules"][number] {
  const rule: ValidationRuleSetMetadata["rules"][number] = {
    code: input.code,
    title: input.title,
    description: input.description,
    category: "VAT_ID",
    severity: input.severity,
    fieldPath: input.fieldPath,
    messageTemplate: input.messageTemplate,
    legalConfidence: "technical",
    version: VAT_FORMAT_RULE_VERSION,
    status: "published",
    ruleSetCode: VAT_FORMAT_RULE_SET_CODE,
    sourceLabels: [VAT_FORMAT_SOURCE_LABEL],
    sources: [VAT_FORMAT_SOURCE]
  };

  if (input.fixSuggestion) {
    rule.fixSuggestion = input.fixSuggestion;
  }

  return rule;
}

export function listVatFormatValidationRuleCatalog(): ValidationRuleSetMetadata[] {
  const partyRules = (["seller", "buyer"] as const).flatMap((role) => {
    const roleLabel = titleCaseRole(role);
    const roleCode = upperCaseRole(role);
    const fieldPath = `${role}.vatId`;

    return [
      vatRule({
        code: `${roleCode}_VAT_ID_LOCAL_FORMAT_VALID`,
        title: `${roleLabel} VAT ID local format valid`,
        description:
          "The party VAT ID matched an Invoice Lantern local technical format pattern. This is not a VIES check and does not confirm VAT registration.",
        severity: "info",
        fieldPath,
        messageTemplate:
          "{partyLabel} VAT ID appears to match the local format pattern for {countryLabel}. This is a local format check only, not a VIES check, does not confirm VAT registration, and is not legal/tax advice."
      }),
      vatRule({
        code: `${roleCode}_VAT_ID_LOCAL_FORMAT_INVALID`,
        title: `${roleLabel} VAT ID local format invalid`,
        description:
          "The party VAT ID did not match a supported Invoice Lantern local technical format pattern. This is not a legal or tax conclusion.",
        severity: "warning",
        fieldPath,
        messageTemplate:
          "{partyLabel} VAT ID does not match a supported expected local format pattern for {countryLabel}. This is a technical format check only, not a VIES check, does not confirm VAT registration, and is not a legal/tax conclusion.",
        fixSuggestion: VAT_FORMAT_FIX_SUGGESTION
      }),
      vatRule({
        code: `${roleCode}_VAT_ID_COUNTRY_HINT_MISMATCH`,
        title: `${roleLabel} VAT ID country hint mismatch`,
        description:
          "The detected VAT ID country prefix differs from the party country hint used for the local technical format check.",
        severity: "warning",
        fieldPath,
        messageTemplate:
          "{partyLabel} VAT ID country prefix {detectedCountryCode} does not match the party country hint {countryHint}. This is a local format check only, not a VIES check, does not confirm VAT registration, and is not legal/tax advice.",
        fixSuggestion: VAT_FORMAT_HINT_FIX_SUGGESTION
      })
    ];
  });

  return [
    {
      code: VAT_FORMAT_RULE_SET_CODE,
      name: "Invoice Lantern VAT Format Rules",
      description:
        "Local technical VAT ID format checks for present seller and buyer VAT IDs. These rules do not query VIES, do not prove VAT registration, and are not legal, tax, or accounting advice.",
      version: VAT_FORMAT_RULE_VERSION,
      status: "published",
      legalConfidence: "technical",
      rules: [
        vatRule({
          code: "VAT_ID_LOCAL_FORMAT_CHECK_ONLY",
          title: "VAT ID local format check boundary",
          description:
            "Finding-level notice that local VAT ID format checks are technical checks only and are not VIES, authority validation, or legal/tax advice.",
          severity: "info",
          fieldPath: "parties.vatId",
          messageTemplate: CHECK_ONLY_MESSAGE
        }),
        ...partyRules
      ]
    }
  ];
}
