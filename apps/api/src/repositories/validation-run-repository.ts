import type { InvoiceValidationRequest } from "../schemas/invoice.js";
import { readJsonCollection, writeJsonCollection } from "../storage/json-store.js";

export type FindingSeverity = "info" | "warning" | "fatal";

export type Finding = {
  code: string;
  severity: FindingSeverity;
  field: string;
  message: string;
  legalConfidence: "technical" | "educational_simulation" | "review_required";
};

export type ValidationTotals = {
  lineExtensionAmount: number;
  taxExclusiveAmount: number;
  taxAmount: number;
  taxInclusiveAmount: number;
  payableAmount: number;
};

export type ValidationRunRecord = {
  id: string;
  invoiceNumber: string;
  buyer: string;
  seller: string;
  createdAt: string;
  technicalStatus: "passed" | "failed";
  standardStatus: "ready" | "warning";
  countrySimulationStatus: "not_relevant" | "review_required";
  vidaReadinessStatus: "not_relevant" | "relevant_simulation";
  confidence: "technical_preview" | "educational_simulation";
  profile: "API_VALIDATION";
  currency: string;
  totals: ValidationTotals;
  findings: Finding[];
  disclaimer: string;
};

const VALIDATION_RUNS_FILE = "validation-runs.json";
const MAX_STORED_VALIDATION_RUNS = 250;

export function calculateValidationTotals(
  payload: InvoiceValidationRequest
): ValidationTotals {
  const lineExtensionAmount = payload.lines.reduce((sum, line) => {
    return sum + line.quantity * line.unitPrice;
  }, 0);

  const taxAmount = payload.lines.reduce((sum, line) => {
    const lineNet = line.quantity * line.unitPrice;
    return sum + (lineNet * line.vatRate) / 100;
  }, 0);

  const taxInclusiveAmount = lineExtensionAmount + taxAmount;

  return {
    lineExtensionAmount: Number(lineExtensionAmount.toFixed(2)),
    taxExclusiveAmount: Number(lineExtensionAmount.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    taxInclusiveAmount: Number(taxInclusiveAmount.toFixed(2)),
    payableAmount: Number(taxInclusiveAmount.toFixed(2))
  };
}

export function buildValidationFindings(
  payload: InvoiceValidationRequest
): Finding[] {
  const findings: Finding[] = [];
  const isCrossBorder = payload.seller.country !== payload.buyer.country;

  if (isCrossBorder && !payload.buyer.vatId) {
    findings.push({
      code: "BUYER_VAT_ID_REQUIRED",
      severity: "fatal",
      field: "buyer.vatId",
      message: "Buyer VAT ID is required for this cross-border B2B simulation.",
      legalConfidence: "educational_simulation"
    });
  }

  if (isCrossBorder) {
    findings.push({
      code: "CROSS_BORDER_REVIEW_REQUIRED",
      severity: "warning",
      field: "buyer.country",
      message:
        "Seller and buyer countries differ. Country and VAT treatment require professional review.",
      legalConfidence: "review_required"
    });
  }

  const hasZeroValueLine = payload.lines.some(
    (line) => line.quantity * line.unitPrice === 0
  );

  if (hasZeroValueLine) {
    findings.push({
      code: "ZERO_VALUE_LINE_REVIEW",
      severity: "warning",
      field: "lines",
      message: "One or more invoice lines have zero value and should be reviewed.",
      legalConfidence: "technical"
    });
  }

  return findings;
}

export async function listValidationRuns() {
  return readJsonCollection<ValidationRunRecord>(VALIDATION_RUNS_FILE);
}

export async function getValidationRunById(id: string) {
  const runs = await listValidationRuns();

  return runs.find((run) => run.id === id) ?? null;
}

export async function saveValidationRun(record: ValidationRunRecord) {
  const currentRuns = await listValidationRuns();

  const nextRuns = [
    record,
    ...currentRuns.filter((existingRun) => existingRun.id !== record.id)
  ].slice(0, MAX_STORED_VALIDATION_RUNS);

  await writeJsonCollection(VALIDATION_RUNS_FILE, nextRuns);

  return record;
}
