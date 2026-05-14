import {
  buildCoreValidationFindings,
  calculateInvoiceTotals,
  type CanonicalInvoice
} from "@invoice-lantern/invoice-core";
import { validateVatFormat } from "@invoice-lantern/tax-engine";
import {
  buildValidationFindingSummary,
  buildViesFindingFromEvidence,
  buildViesFindingFromStatus,
  enrichValidationFindings,
  mapXmlValidationFindingToEnriched
} from "./validation-finding-enrichment.js";
import { buildVatFormatValidationFindings } from "./vat-format-validation-findings.js";
import {
  checkViesEvidence,
  VIES_EVIDENCE_DISCLAIMER,
  type ViesCheckResult
} from "./vies-check-service.js";
import type { XmlValidationJobFinding } from "./xml-validation-job-service.js";
import type {
  EnrichedValidationFinding,
  ValidationEngineSummary,
  ViesMode
} from "../schemas/validation-engine.js";

export const VALIDATION_ENGINE_DISCLAIMER =
  "Invoice Lantern validation results are independent, informational, technical, source-linked, and simulation-focused. They are not legal, tax, accounting, filing, Peppol, EN 16931, ViDA, government, or authority advice.";

export type ValidationEngineTotals = {
  lineExtensionAmount: string;
  taxExclusiveAmount: string;
  taxAmount: string;
  taxInclusiveAmount: string;
  payableAmount: string;
};

export type ValidationEngineInput = {
  invoice: CanonicalInvoice;
  organizationId?: string;
  createdBy?: string | null;
  viesMode?: ViesMode;
  xmlFindings?: XmlValidationJobFinding[];
};

export type ValidationEngineResult = {
  findings: EnrichedValidationFinding[];
  totals: ValidationEngineTotals;
  summary: ValidationEngineSummary;
  viesMode: ViesMode;
  viesChecks: ViesCheckResult[];
  disclaimer: string;
};

const LOCAL_VALIDATION_ORGANIZATION_ID = "local";

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function calculateValidationEngineTotals(
  invoice: CanonicalInvoice
): ValidationEngineTotals {
  const totals = calculateInvoiceTotals(invoice).totals;

  return {
    lineExtensionAmount: totals.lineExtensionAmount,
    taxExclusiveAmount: totals.taxExclusiveAmount,
    taxAmount: totals.taxAmount,
    taxInclusiveAmount: totals.taxInclusiveAmount,
    payableAmount: totals.payableAmount
  };
}

function getPartyVatInputs(invoice: CanonicalInvoice) {
  return [
    {
      role: "seller" as const,
      vatId: invoice.seller.vatId,
      countryCode: invoice.seller.country,
      fieldPath: "seller.vatId"
    },
    {
      role: "buyer" as const,
      vatId: invoice.buyer.vatId,
      countryCode: invoice.buyer.country,
      fieldPath: "buyer.vatId"
    }
  ].filter((party) => hasText(party.vatId));
}

async function buildViesFindings(input: {
  invoice: CanonicalInvoice;
  organizationId: string;
  createdBy: string | null;
  viesMode: ViesMode;
}) {
  const findings: EnrichedValidationFinding[] = [];
  const viesChecks: ViesCheckResult[] = [];

  if (input.viesMode === "skip") {
    return {
      findings,
      viesChecks
    };
  }

  for (const party of getPartyVatInputs(input.invoice)) {
    const formatCheck = validateVatFormat(party.vatId ?? "", party.countryCode);

    if (!formatCheck.formatValid) {
      continue;
    }

    const result = await checkViesEvidence({
      organizationId: input.organizationId,
      countryCode: party.countryCode,
      vatNumber: party.vatId ?? "",
      partyRole: party.role,
      createdBy: input.createdBy,
      useCacheOnly: input.viesMode === "use_cached"
    });

    viesChecks.push(result);

    if (result.evidence) {
      findings.push(
        buildViesFindingFromEvidence({
          record: result.evidence,
          fieldPath: party.fieldPath
        })
      );
      continue;
    }

    if (input.viesMode === "live") {
      findings.push(
        buildViesFindingFromStatus({
          status: result.status,
          countryCode: party.countryCode,
          vatNumberDisplay: party.vatId ?? "",
          fieldPath: party.fieldPath,
          checkedAt: result.checkedAt
        })
      );
    }
  }

  return {
    findings,
    viesChecks
  };
}

export async function runValidationEngine(
  input: ValidationEngineInput
): Promise<ValidationEngineResult> {
  const viesMode = input.viesMode ?? "skip";
  const baseFindings = enrichValidationFindings([
    ...buildCoreValidationFindings(input.invoice).map((finding) => ({
      ...finding,
      field: finding.fieldPath
    })),
    ...buildVatFormatValidationFindings(input.invoice)
  ]);
  const xmlFindings = (input.xmlFindings ?? []).map((finding) =>
    mapXmlValidationFindingToEnriched(finding)
  );
  const viesResult = await buildViesFindings({
    invoice: input.invoice,
    organizationId: input.organizationId ?? LOCAL_VALIDATION_ORGANIZATION_ID,
    createdBy: input.createdBy ?? null,
    viesMode
  });
  const findings = [...baseFindings, ...xmlFindings, ...viesResult.findings];
  const summary = buildValidationFindingSummary(findings);

  return {
    findings,
    totals: calculateValidationEngineTotals(input.invoice),
    summary,
    viesMode,
    viesChecks: viesResult.viesChecks,
    disclaimer:
      viesMode === "skip"
        ? VALIDATION_ENGINE_DISCLAIMER
        : `${VALIDATION_ENGINE_DISCLAIMER} ${VIES_EVIDENCE_DISCLAIMER}`
  };
}
